// 深度调查编排：拆题 → 并行元宝搜索 → 交叉比对 → 三分法报告
// 设计原则（对齐赛道评审）：结论必有来源、查不到明说、url 只来自搜索结果
import { cachedSearchPro } from "./searchCache";
import { chatJSON } from "./llm";
import { redlineCheckQuery, filterPagesByRedline } from "./redline";
import type {
  ConflictItem,
  FactItem,
  InferenceItem,
  InvestigationReport,
  RoundInfo,
  SearchPage,
  SourceRef,
} from "./types";

export class RedlineError extends Error {}
export class RefuseError extends Error {}

const MAX_PAGES_PER_ROUND = 8;
const MAX_SOURCES = 20;
const PASSAGE_LIMIT = 240;
const CONCURRENCY = 3;

interface DecomposeResult {
  refuse?: boolean;
  reason?: string;
  subQueries: string[];
}

const DECOMPOSE_SYSTEM = `你是一名侦探社的调查组长。用户会给你一个要调查的问题，你要把它拆成 3-5 条互不重复、适合搜索引擎的中文检索词。
规则：
1. 检索词要短（一般不超过 20 字）、具体、覆盖问题的不同侧面（官方信息 / 数据佐证 / 最新动态 / 交叉口径）。
2. 如果问题涉及时政（选举、领导人、政策立场、军事等）或个人隐私（联系方式、住址、私人生活等），不要拆题，输出 {"refuse": true, "reason": "简短说明"}。
3. 只输出 JSON，格式：{"refuse": false, "subQueries": ["...", "..."]}`;

interface SummaryLLMOutput {
  conclusion: string;
  confidence: "high" | "medium" | "low";
  asOf: string;
  evidence: { fact: { text: string; refs: number[] }[]; inference: { text: string; basis: string }[]; unverified: string[] };
  conflicts: { topic: string; detail: string; refs: number[] }[];
  sourceNotes: string;
}

function summarySystem(sourceCount: number): string {
  return `你是一名严谨的调查报告撰写人。根据给定的检索结果回答用户的调查问题，输出一份中文报告（JSON）。
铁律：
1. "事实"条目必须直接来自来源，标注 refs（来源编号数组，范围 1..${sourceCount}）；不得引入来源之外的知识。
2. 无法从来源确认的判断放入"推断"，并写明依据（basis）；问题中根本没有来源能回答的部分，放入"unverified"（敢说不知道，不编造）。
3. 不同来源信息冲突时写入 conflicts，说明各方说法与来源编号。
4. conclusion 用 2-4 句话给出总结论；如果来源不足以回答问题，必须直说"目前查不到足够信息"。asOf 填来源里最新的日期（如 2026-10），没有则填 "unknown"。
5. sourceNotes 用一句话评估来源整体可信度（是否含权威/VR 信源、时效如何）。
6. 只输出 JSON，不要输出任何其他文字。JSON 结构：
{"conclusion": "...", "confidence": "high|medium|low", "asOf": "...", "evidence": {"fact": [{"text": "...", "refs": [1]}], "inference": [{"text": "...", "basis": "..."}], "unverified": ["..."]}, "conflicts": [{"topic": "...", "detail": "...", "refs": [1,2]}], "sourceNotes": "..."}`;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function investigate(question: string): Promise<InvestigationReport> {
  const started = Date.now();

  const gate = redlineCheckQuery(question);
  if (!gate.ok) throw new RedlineError(gate.reason!);

  // 1. 拆题（LLM 语义复审红线）
  const decomp = await chatJSON<DecomposeResult>(
    DECOMPOSE_SYSTEM,
    `调查问题：${question}\n今天是 ${new Date().toISOString().slice(0, 10)}。`,
  );
  if (decomp.refuse || !decomp.subQueries?.length) {
    throw new RefuseError(decomp.reason || "该问题不适合调查（可能涉及时政或个人隐私），请换个题材。");
  }
  const subQueries = decomp.subQueries.slice(0, 5);

  // 2. 并行检索（并发 3，远低于 QPS 20；命中缓存不消耗额度）
  const roundsResults: SearchPage[][] = new Array(subQueries.length);
  const rounds: RoundInfo[] = new Array(subQueries.length);
  let searchCalls = 0;
  let cachedRounds = 0;
  await mapLimit(subQueries, CONCURRENCY, async (sq, i) => {
    const out = await cachedSearchPro(sq);
    if (out.cached) cachedRounds++;
    else searchCalls++;
    roundsResults[i] = out.pages;
    rounds[i] = {
      subQuery: sq,
      resultCount: out.pages.length,
      topTitles: out.pages.slice(0, 3).map((p) => p.title ?? ""),
      cached: out.cached,
    };
  });

  // 3. 输出层红线过滤（docs/接口规则.md 六.2），再截取每轮头部结果
  let droppedByRedline = 0;
  const filteredRounds = roundsResults.map((pages) => {
    const { kept, dropped } = filterPagesByRedline(pages);
    droppedByRedline += dropped;
    return kept.slice(0, MAX_PAGES_PER_ROUND);
  });

  // 4. 汇总来源清单（按 url 去重、统一编号）
  const sources: SourceRef[] = [];
  const byUrl = new Map<string, number>();
  for (const pages of filteredRounds) {
    for (const p of pages) {
      if (sources.length >= MAX_SOURCES) break;
      if (!byUrl.has(p.url)) {
        byUrl.set(p.url, sources.length + 1);
        sources.push({
          id: sources.length + 1,
          title: p.title ?? p.url,
          url: p.url,
          site: p.site,
          date: p.date,
          vr: Boolean(p.vr),
        });
      }
    }
  }

  // 5. 交叉比对与成稿
  let summary: SummaryLLMOutput;
  if (sources.length === 0) {
    summary = {
      conclusion: "目前查不到能回答该问题的信息。",
      confidence: "low",
      asOf: "unknown",
      evidence: { fact: [], inference: [], unverified: [`多个检索词（${subQueries.join("；")}）均无有效结果`] },
      conflicts: [],
      sourceNotes: "无可用来源。",
    };
  } else {
    const urlToId = new Map(sources.map((s) => [s.url, s.id]));
    const context = filteredRounds
      .map((pages, i) => {
        const lines = pages
          .map((p) => {
            const id = urlToId.get(p.url);
            const passage = (p.passage ?? "").slice(0, PASSAGE_LIMIT).replace(/\s+/g, " ");
            return `- [${id}] ${p.title ?? ""}（${p.site ?? ""}${p.date ? "，" + p.date : ""}${p.vr ? "，权威VR信源" : ""}）：${passage}`;
          })
          .join("\n");
        return `检索轮次 ${i + 1}：「${subQueries[i]}」\n${lines || "（本轮无结果）"}`;
      })
      .join("\n\n");
    const sourceList = sources
      .map((s) => `[${s.id}] ${s.title} ${s.url}${s.date ? "（" + s.date + "）" : ""}`)
      .join("\n");
    summary = await chatJSON<SummaryLLMOutput>(
      summarySystem(sources.length),
      `调查问题：${question}\n\n=== 检索结果（[n] 为来源编号）===\n${context}\n\n=== 来源清单 ===\n${sourceList}`,
    );
  }

  // 校验 refs 越界与空结构，防止模型幻觉编号
  const validId = (n: number) => Number.isInteger(n) && n >= 1 && n <= sources.length;
  const facts: FactItem[] = (summary.evidence?.fact ?? [])
    .map((f) => ({ text: String(f.text ?? ""), refs: (f.refs ?? []).filter(validId) }))
    .filter((f) => f.text);
  const inferences: InferenceItem[] = (summary.evidence?.inference ?? [])
    .map((f) => ({ text: String(f.text ?? ""), basis: String(f.basis ?? "") }))
    .filter((f) => f.text);
  const unverified: string[] = (summary.evidence?.unverified ?? []).map(String).filter(Boolean);
  const conflicts: ConflictItem[] = (summary.conflicts ?? [])
    .map((c) => ({ topic: String(c.topic ?? ""), detail: String(c.detail ?? ""), refs: (c.refs ?? []).filter(validId) }))
    .filter((c) => c.topic || c.detail);

  return {
    question,
    conclusion: String(summary.conclusion ?? ""),
    confidence: summary.confidence === "high" || summary.confidence === "medium" ? summary.confidence : "low",
    asOf: String(summary.asOf ?? "unknown"),
    evidence: { fact: facts, inference: inferences, unverified },
    conflicts,
    sourceNotes: String(summary.sourceNotes ?? ""),
    sources,
    rounds,
    meta: {
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      searchCalls,
      cachedRounds,
      droppedByRedline,
      model: process.env.LLM_MODEL || "deepseek-chat",
    },
  };
}
