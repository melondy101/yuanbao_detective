"use client";

// 证据链地图：问题 → 检索线 → 来源 → 事实/冲突 的四列 SVG 分层图（方案 B，零依赖自绘）
// 颜色语义沿用分区编码：青=交叉验证、灰=单一来源、赭石=冲突；来源节点点击直达原文
import { CRED_DOT, distinctDomains } from "@/lib/credibility";
import type { InvestigationReport } from "@/lib/types";

const W = 760;
const TOP = 36; // 列标题下首行节点的 y 起点
const COL = {
  q: { x: 8, w: 118 },
  r: { x: 172, w: 138 },
  s: { x: 354, w: 206 },
  f: { x: 602, w: 150 },
};
const ROW = { r: 48, s: 26, f: 40 };
const INK = "#171716";
const MUTED = "#6b6c67";
const FAINT = "#a8a9a4";
const TEAL = "#3f7774";
const OCHRE = "#8a6b2d";
const EDGE_BASE = "#d5d6d1";

function trunc(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/** 贝塞尔连边 */
function edge(x1: number, y1: number, x2: number, y2: number, stroke: string, dashed = false) {
  const mx = (x1 + x2) / 2;
  return (
    <path
      d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
      fill="none"
      stroke={stroke}
      strokeWidth={1.2}
      strokeDasharray={dashed ? "3 3" : undefined}
      opacity={stroke === TEAL ? 0.5 : stroke === OCHRE ? 0.55 : 1}
    />
  );
}

export default function RetrievalGraph({ report }: { report: InvestigationReport }) {
  const { rounds, sources, evidence, conflicts } = report;
  if (!sources.length || !rounds.length) return null;

  // 旧归档数据缺 roundSources：按来源顺序均分到各轮，仅为兼容显示
  const roundSources: number[][] =
    report.roundSources ??
    rounds.map((_, i) =>
      sources.filter((_, j) => Math.floor((j * rounds.length) / sources.length) === i).map((s) => s.id),
    );

  // 右列节点：事实（带交叉判定）+ 冲突
  const factNodes = [
    ...evidence.fact.map((f) => {
      const domains = distinctDomains(f.refs.map((n) => sources[n - 1]?.url ?? ""));
      return { kind: "fact" as const, text: f.text, refs: f.refs, domains, cross: domains >= 2 };
    }),
    ...conflicts.map((c) => ({ kind: "conflict" as const, text: `${c.topic}：${c.detail}`, refs: c.refs, domains: 0, cross: false })),
  ];
  const referenced = new Set(factNodes.flatMap((f) => f.refs));

  // 各列纵向排布
  const qCy = TOP + 24;
  const rCy = rounds.map((_, i) => TOP + i * ROW.r + ROW.r / 2);
  const sCy = sources.map((_, i) => TOP + 4 + i * ROW.s + ROW.s / 2);
  const fCy = factNodes.map((_, i) => TOP + i * ROW.f + ROW.f / 2);
  const bodyH = Math.max(qCy, ...rCy, ...sCy, ...fCy);
  const H = bodyH + TOP + 26; // 底部留图例

  const sx = COL.s.x + COL.s.w; // 来源右缘
  const fx = COL.f.x; // 事实左缘

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[680px]" role="img" aria-label="证据链地图：检索路径与来源印证关系">
        {/* 列标题 */}
        {[
          ["问题", COL.q],
          ["检索线", COL.r],
          ["来源", COL.s],
          ["事实 · 冲突", COL.f],
        ].map(([label, col]) => (
          <text key={label as string} x={(col as { x: number; w: number }).x} y={20} fontSize={10} fill={MUTED}>
            {label as string}
          </text>
        ))}

        {/* 结构边：问题→检索线→来源 */}
        {rounds.map((_, i) => edge(COL.q.x + COL.q.w, qCy, COL.r.x, rCy[i], EDGE_BASE))}
        {rounds.map((_, i) =>
          (roundSources[i] ?? []).map((sid) =>
            sid <= sources.length ? edge(COL.r.x + COL.r.w, rCy[i], COL.s.x, sCy[sid - 1], EDGE_BASE) : null,
          ),
        )}

        {/* 印证边：来源→事实（青=交叉验证 / 灰=单一）/ 来源→冲突（赭石虚线） */}
        {factNodes.map((f, fi) =>
          f.refs.map((sid) => {
            if (sid > sources.length) return null;
            const stroke = f.kind === "conflict" ? OCHRE : f.cross ? TEAL : EDGE_BASE;
            return edge(sx, sCy[sid - 1], fx, fCy[fi], stroke, f.kind === "conflict");
          }),
        )}

        {/* 问题节点 */}
        <g>
          <rect x={COL.q.x} y={qCy - 22} width={COL.q.w} height={44} rx={6} className="fill-white" stroke={INK} strokeWidth={1} />
          <text x={COL.q.x + 10} y={qCy - 5} fontSize={10} fill={MUTED}>调查问题</text>
          <text x={COL.q.x + 10} y={qCy + 11} fontSize={11.5} fill={INK} fontFamily="Georgia, Songti SC, serif">
            {trunc(report.question, 10)}
          </text>
        </g>

        {/* 检索线节点 */}
        {rounds.map((r, i) => (
          <g key={`r-${i}`}>
            <rect x={COL.r.x} y={rCy[i] - ROW.r / 2 + 2} width={COL.r.w} height={ROW.r - 4} rx={5} className="fill-white" stroke="#e4e5e1" />
            <text x={COL.r.x + 8} y={rCy[i] - 4} fontSize={10} fill={FAINT}>{String(i + 1).padStart(2, "0")}</text>
            <text x={COL.r.x + 26} y={rCy[i] - 4} fontSize={11} fill={INK}>{trunc(r.subQuery, 11)}</text>
            <text x={COL.r.x + 26} y={rCy[i] + 10} fontSize={10} fill={MUTED}>{r.resultCount} 条结果</text>
          </g>
        ))}

        {/* 来源节点：可信度色点 + 标题，点击直达原文；未被引用的降灰 */}
        {sources.map((s, i) => {
          const dim = !referenced.has(s.id);
          const y = sCy[i] - ROW.s / 2 + 2;
          return (
            <a key={`s-${s.id}`} href={s.url} target="_blank" rel="noreferrer" className="cursor-pointer">
              <title>{`${s.title}（${s.site ?? s.url}${s.date ? " · " + s.date : ""}）`}</title>
              <rect x={COL.s.x} y={y} width={COL.s.w} height={ROW.s - 4} rx={4} className="fill-white" stroke="#eeeee9" />
              <circle cx={COL.s.x + 10} cy={sCy[i]} r={3} fill={CRED_DOT[s.cred]} />
              <text x={COL.s.x + 19} y={sCy[i] + 3.5} fontSize={10.5} fill={dim ? FAINT : INK}>
                {s.id}. {trunc(s.title, 15)}
              </text>
            </a>
          );
        })}

        {/* 事实 / 冲突节点 */}
        {factNodes.map((f, i) => (
          <g key={`f-${i}`}>
            <rect x={COL.f.x} y={fCy[i] - ROW.f / 2 + 2} width={COL.f.w} height={ROW.f - 4} rx={5} className="fill-white"
              stroke={f.kind === "conflict" ? "rgba(138,107,45,0.4)" : f.cross ? "rgba(63,119,116,0.4)" : "#e4e5e1"} />
            <text x={COL.f.x + 8} y={fCy[i] - 4} fontSize={10.5} fill={INK}>{trunc(f.text, 13)}</text>
            <text x={COL.f.x + 8} y={fCy[i] + 10} fontSize={9.5}
              fill={f.kind === "conflict" ? OCHRE : f.cross ? TEAL : MUTED}>
              {f.kind === "conflict"
                ? "冲突 · 双方说法并列"
                : f.cross
                  ? `交叉验证 · ${f.domains} 源`
                  : "单一来源"}
            </text>
          </g>
        ))}

        {/* 图例 */}
        <g transform={`translate(${COL.q.x}, ${bodyH + TOP + 8})`} fontSize={9.5} fill={MUTED}>
          <line x1={0} y1={-3} x2={22} y2={-3} stroke={TEAL} strokeWidth={1.2} opacity={0.6} />
          <text x={27} y={0}>交叉验证（≥2 个独立域名）</text>
          <line x1={170} y1={-3} x2={192} y2={-3} stroke={EDGE_BASE} strokeWidth={1.2} />
          <text x={197} y={0}>单一来源</text>
          <line x1={265} y1={-3} x2={287} y2={-3} stroke={OCHRE} strokeWidth={1.2} strokeDasharray="3 3" />
          <text x={292} y={0}>来源冲突</text>
          <text x={370} y={0}>来源色点：官方/学术/媒体/百科按分区色编码 · 点击来源直达原文</text>
        </g>
      </svg>
    </div>
  );
}
