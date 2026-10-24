"use client";

import { useState } from "react";
import type { InvestigationReport } from "@/lib/types";

const CONF_LABEL: Record<string, string> = { high: "高置信", medium: "中置信", low: "低置信" };
const CONF_PILL: Record<string, string> = {
  high: "pill pill-teal",
  medium: "pill pill-blue",
  low: "pill pill-ochre",
};

function Refs({ ids }: { ids: number[] }) {
  if (!ids.length) return null;
  return (
    <span className="ml-1.5 inline-flex gap-1 align-middle">
      {ids.map((n) => (
        <a
          key={n}
          href={`#src-${n}`}
          aria-label={`跳到来源 ${n}`}
          title={`查看来源 ${n}`}
          className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-[var(--rule)] bg-white px-1 text-[11px] font-medium leading-none tabular-nums transition-colors hover:border-[var(--blue)] hover:text-[var(--blue)]"
        >
          {n}
        </a>
      ))}
    </span>
  );
}

function SectionHead({
  num,
  pill,
  pillText,
  title,
  hint,
}: {
  num: string;
  pill: string;
  pillText: string;
  title: string;
  hint?: string;
}) {
  return (
    <h3 className="mb-2.5 flex flex-wrap items-baseline gap-2">
      <span aria-hidden="true" className="text-[11px] tabular-nums text-[var(--muted)]">
        {num}
      </span>
      <span className={`pill ${pill}`}>{pillText}</span>
      <span className="text-sm font-medium">{title}</span>
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
    </h3>
  );
}

export default function ReportView({
  report,
  onAddWatch,
}: {
  report: InvestigationReport;
  onAddWatch: (question: string) => void;
}) {
  const [added, setAdded] = useState(false);
  const { evidence, meta } = report;
  const emptyResult = evidence.fact.length === 0 && evidence.inference.length === 0;

  return (
    <article className="space-y-5">
      {/* 结论：档案首页 */}
      <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`pill ${CONF_PILL[report.confidence]}`}>{CONF_LABEL[report.confidence]}</span>
          {report.asOf !== "unknown" && (
            <span className="pill pill-neutral">信息时效 {report.asOf}</span>
          )}
        </div>
        <p className="max-w-[62ch] font-serif text-[17px] leading-[1.75]">{report.conclusion}</p>
        <p className="mt-3 border-t border-[var(--rule-soft)] pt-3 text-xs leading-5 text-[var(--muted)]">
          来源可信度：{report.sourceNotes}
        </p>
      </div>

      {/* 三分法证据：三张编码卡 */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
          <SectionHead num="01" pill="pill-teal" pillText="事实" title="已知事实" hint="直接来自来源" />
          {evidence.fact.length ? (
            <ul className="space-y-2.5 text-[13px] leading-6">
              {evidence.fact.map((f, i) => (
                <li key={i}>
                  {f.text}
                  <Refs ids={f.refs} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] leading-6 text-[var(--muted)]">本轮没有可直接确认的事实。</p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
          <SectionHead num="02" pill="pill-plum" pillText="推断" title="合理推断" hint="基于来源" />
          {evidence.inference.length ? (
            <ul className="space-y-2.5 text-[13px] leading-6">
              {evidence.inference.map((f, i) => (
                <li key={i}>
                  {f.text}
                  <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">依据：{f.basis}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] leading-6 text-[var(--muted)]">没有需要推断的部分。</p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
          <SectionHead num="03" pill="pill-ochre" pillText="待验证" title="查不到 / 待验证" hint="敢说不知道" />
          {evidence.unverified.length ? (
            <ul className="list-inside list-disc space-y-2.5 text-[13px] leading-6">
              {evidence.unverified.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] leading-6 text-[var(--muted)]">这个问题的每个部分都查到了结果。</p>
          )}
        </div>
      </div>

      {emptyResult && (
        <p className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4 text-center text-sm text-[var(--muted)]">
          对这个问题，目前查不到足够信息，不编造答案。
        </p>
      )}

      {/* 冲突 */}
      {report.conflicts.length > 0 && (
        <div className="rounded-lg border border-[rgba(138,107,45,0.35)] bg-[rgba(138,107,45,0.05)] p-4">
          <SectionHead num="04" pill="pill-ochre" pillText="冲突" title="来源冲突" hint="不同信源说法不一" />
          <ul className="space-y-2.5 text-[13px] leading-6">
            {report.conflicts.map((c, i) => (
              <li key={i}>
                <span className="font-medium text-[var(--ochre)]">{c.topic}：</span>
                {c.detail}
                <Refs ids={c.refs} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 盯梢入口 */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-4 py-3">
        <p className="text-[13px] leading-6 text-[var(--muted)]">
          这个问题值得持续跟踪？加入盯梢，有变化就提醒。
        </p>
        <button
          type="button"
          disabled={added}
          onClick={() => {
            onAddWatch(report.question);
            setAdded(true);
          }}
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-[var(--rule)] bg-[var(--paper)] px-4 text-sm font-medium transition-colors hover:border-[#c9cac4] disabled:opacity-50"
        >
          {added ? "已加入盯梢" : "加入盯梢"}
        </button>
      </div>

      {/* 检索轮次 */}
      <details className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
        <summary className="cursor-pointer text-sm font-medium">
          <span aria-hidden="true" className="mr-2 text-[11px] tabular-nums text-[var(--muted)]">
            05
          </span>
          调查过程 · {report.rounds.length} 轮检索（点击展开）
        </summary>
        <ol className="mt-3 divide-y divide-[var(--rule-soft)] text-[13px] leading-6">
          {report.rounds.map((r, i) => (
            <li key={i} className="py-2 first:pt-0 last:pb-0">
              <span className="text-[11px] tabular-nums text-[var(--muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="ml-2">「{r.subQuery}」</span>
              <span className="tabular-nums text-[var(--muted)]"> {r.resultCount} 条结果</span>
              {r.cached && <span className="text-[var(--muted)]">（命中缓存，未消耗额度）</span>}
              {r.topTitles.length > 0 && (
                <span className="block text-xs leading-5 text-[var(--muted)]">
                  {r.topTitles.join(" / ")}
                </span>
              )}
            </li>
          ))}
        </ol>
      </details>

      {/* 来源清单 */}
      <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
        <SectionHead
          num="06"
          pill="pill-blue"
          pillText="来源"
          title={`来源清单（${report.sources.length} 条，均可点开）`}
        />
        <ol className="divide-y divide-[var(--rule-soft)] text-[13px] leading-6">
          {report.sources.map((s) => (
            <li key={s.id} id={`src-${s.id}`} className="flex flex-wrap items-baseline gap-1.5 py-2 first:pt-0 last:pb-0 scroll-mt-8">
              <span className="text-[11px] font-medium tabular-nums text-[var(--muted)]">
                {String(s.id).padStart(2, "0")}
              </span>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--blue)] transition-colors hover:text-[var(--ink)]"
              >
                {s.title}
                <span className="sr-only">（新标签打开）</span>
              </a>
              <span className="text-xs text-[var(--muted)]">
                {s.site ?? ""}
                {s.date ? ` · ${s.date}` : ""}
                {s.vr ? " · 权威VR信源" : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* 元信息：小号元数据行 */}
      <p className="text-center text-xs tabular-nums leading-5 text-[var(--muted)]">
        联网搜索 {meta.searchCalls} 次 · 缓存命中 {meta.cachedRounds} 轮 · 耗时{" "}
        {(meta.elapsedMs / 1000).toFixed(1)} 秒 · 摘要模型 {meta.model}
        {meta.droppedByRedline > 0 ? ` · 按红线过滤 ${meta.droppedByRedline} 条结果` : ""} · 生成于{" "}
        {new Date(meta.generatedAt).toLocaleString("zh-CN")}
      </p>
    </article>
  );
}
