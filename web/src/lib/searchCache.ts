// 搜索结果缓存（TTL ≥10 分钟，docs/接口规则.md 五）与调用审计日志
import type { SearchPage } from "./types";
import { searchProRaw, SearchError } from "./tencent";

const TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  ts: number;
  pages: SearchPage[];
  requestId: string;
}

const cache = new Map<string, CacheEntry>();

export interface CallLogEntry {
  ts: string;
  query: string;
  cacheHit: boolean;
  ok: boolean;
  errorCode?: string;
}

const callLog: CallLogEntry[] = [];
const MAX_LOG = 200;

function log(entry: CallLogEntry) {
  callLog.push(entry);
  if (callLog.length > MAX_LOG) callLog.shift();
  // 结构化输出一行，便于对账（不含密钥）
  console.info("[search-call]", JSON.stringify(entry));
}

export function getCallLog() {
  return callLog;
}

function parsePages(rawPages: unknown[]): { pages: SearchPage[]; dropped: number } {
  const pages: SearchPage[] = [];
  let dropped = 0;
  for (const p of rawPages) {
    try {
      const obj = typeof p === "string" ? (JSON.parse(p) as SearchPage) : (p as SearchPage);
      if (obj && typeof obj.url === "string" && obj.url) pages.push(obj);
      else dropped++;
    } catch {
      dropped++;
    }
  }
  return { pages, dropped };
}

export interface CachedSearchResult {
  pages: SearchPage[];
  requestId: string;
  cached: boolean;
  dropped: number;
}

export async function cachedSearchPro(query: string): Promise<CachedSearchResult> {
  const key = query.trim();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    log({ ts: new Date().toISOString(), query: key, cacheHit: true, ok: true });
    return { pages: hit.pages, requestId: hit.requestId, cached: true, dropped: 0 };
  }
  try {
    const out = await searchProRaw(key);
    const { pages, dropped } = parsePages(out.pages);
    cache.set(key, { ts: Date.now(), pages, requestId: out.requestId });
    log({ ts: new Date().toISOString(), query: key, cacheHit: false, ok: true });
    return { pages, requestId: out.requestId, cached: false, dropped };
  } catch (e) {
    const errorCode = e instanceof SearchError ? e.code : "network";
    log({ ts: new Date().toISOString(), query: key, cacheHit: false, ok: false, errorCode });
    throw e;
  }
}
