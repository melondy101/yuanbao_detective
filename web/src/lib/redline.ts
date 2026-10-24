// 赛道红线过滤：不碰时政、不涉及个人隐私（docs/接口规则.md 六）
// 两层防线：本文件的关键词初筛 + 拆题 LLM 的语义复审

const SENSITIVE_PATTERNS: RegExp[] = [
  /选举|竞选|投票/,
  /总统|首相|主席|总书记|总理/,
  /政党|执政|反对党|议会|国会/,
  /游行|示威|抗议|罢工/,
  /战争|军事|武器|制裁/,
  /手机号|电话号|身份证|银行卡号|家庭住址|病历|户口/,
  /某人的.*(隐私|住址|感情|收入)/,
];

export function redlineCheckQuery(query: string): { ok: boolean; reason?: string } {
  for (const p of SENSITIVE_PATTERNS) {
    if (p.test(query)) {
      return {
        ok: false,
        reason: "该问题可能涉及时政或个人隐私，按赛道红线不能调查。换个题材试试（作品、活动、技术、生活消费类问题都可以）。",
      };
    }
  }
  return { ok: true };
}

/** 输出侧过滤：命中敏感词的结果不展示（docs/接口规则.md 六.2），返回被丢弃条数 */
export function filterPagesByRedline<T extends { title?: string; passage?: string }>(pages: T[]): {
  kept: T[];
  dropped: number;
} {
  const kept = pages.filter((p) => {
    const text = `${p.title ?? ""}${p.passage ?? ""}`;
    return !SENSITIVE_PATTERNS.some((p2) => p2.test(text));
  });
  return { kept, dropped: pages.length - kept.length };
}
