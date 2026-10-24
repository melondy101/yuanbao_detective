// 盯梢快照：对单个查询跑一轮元宝搜索，返回最新结果头部（客户端负责存历史与比对）
import { NextRequest, NextResponse } from "next/server";
import { cachedSearchPro } from "@/lib/searchCache";
import { redlineCheckQuery, filterPagesByRedline } from "@/lib/redline";
import { SearchError } from "@/lib/tencent";
import type { WatchSnapshot } from "@/lib/types";

export async function POST(req: NextRequest) {
  let question = "";
  try {
    const body = (await req.json()) as { question?: string };
    question = (body.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  if (!question) return NextResponse.json({ error: "缺少 question" }, { status: 400 });

  const gate = redlineCheckQuery(question);
  if (!gate.ok) return NextResponse.json({ error: gate.reason, kind: "redline" }, { status: 422 });

  try {
    const out = await cachedSearchPro(question);
    const { kept, dropped } = filterPagesByRedline(out.pages);
    const snapshot: WatchSnapshot = {
      at: new Date().toISOString(),
      top: kept.slice(0, 5).map((p) => ({ title: p.title ?? p.url, url: p.url, site: p.site, date: p.date, vr: Boolean(p.vr) })),
      resultCount: kept.length,
    };
    return NextResponse.json({ snapshot, droppedByRedline: dropped, cached: out.cached });
  } catch (e) {
    if (e instanceof SearchError) {
      return NextResponse.json({ error: e.message, kind: "search", code: e.code }, { status: 502 });
    }
    throw e;
  }
}
