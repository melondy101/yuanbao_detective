// 冒烟测试：验证腾讯云密钥与 SearchPro 链路是否打通（GET /api/smoke?q=可选查询词）
import { NextRequest, NextResponse } from "next/server";
import { searchProRaw } from "@/lib/tencent";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "元宝搜索";
  try {
    const out = await searchProRaw(q);
    const first = out.pages[0];
    let parsed: { title?: string; url?: string } = {};
    try {
      parsed = typeof first === "string" ? JSON.parse(first) : ((first ?? {}) as object);
    } catch {}
    return NextResponse.json({
      ok: true,
      query: q,
      requestId: out.requestId,
      resultCount: out.pages.length,
      firstTitle: parsed.title ?? null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
