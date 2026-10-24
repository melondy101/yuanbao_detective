import { NextRequest, NextResponse } from "next/server";
import { investigate, RedlineError, RefuseError } from "@/lib/orchestrator";
import { SearchError } from "@/lib/tencent";
import { LlmError } from "@/lib/llm";

export async function POST(req: NextRequest) {
  let question: string;
  try {
    const body = (await req.json()) as { question?: string };
    question = (body.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  if (!question) return NextResponse.json({ error: "问题不能为空" }, { status: 400 });
  if (question.length > 300) return NextResponse.json({ error: "问题太长了，请精简到 300 字以内" }, { status: 400 });

  try {
    const report = await investigate(question);
    return NextResponse.json(report);
  } catch (e) {
    if (e instanceof RedlineError || e instanceof RefuseError) {
      return NextResponse.json({ error: e.message, kind: "redline" }, { status: 422 });
    }
    if (e instanceof SearchError) {
      return NextResponse.json({ error: e.message, kind: "search", code: e.code }, { status: 502 });
    }
    if (e instanceof LlmError) {
      return NextResponse.json({ error: e.message, kind: "llm" }, { status: 502 });
    }
    console.error("[investigate] 未知错误", e);
    return NextResponse.json({ error: "调查失败，请稍后重试" }, { status: 500 });
  }
}
