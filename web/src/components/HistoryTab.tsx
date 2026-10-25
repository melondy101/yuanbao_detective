"use client";

import { useEffect, useState } from "react";
import ReportView from "./ReportView";
import { clearHistory, loadHistory, removeHistoryEntry, type HistoryEntry } from "@/lib/historyStore";

const CONF_LABEL: Record<string, string> = { high: "高置信", medium: "中置信", low: "低置信" };
const CONF_PILL: Record<string, string> = {
  high: "pill pill-teal",
  medium: "pill pill-blue",
  low: "pill pill-ochre",
};

function EntryCard({
  entry,
  onAddWatch,
  onDelete,
}: {
  entry: HistoryEntry;
  onAddWatch: (question: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { report } = entry;
  const se = report.selfEval;
  const crossPct = se.facts > 0 ? Math.round((se.crossVerifiedFacts / se.facts) * 100) : 0;

  return (
    <li className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left font-serif text-[15px] leading-6 transition-colors hover:text-[var(--blue)]"
          title={open ? "收起报告" : "展开报告"}
        >
          {report.question}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs leading-5 text-[var(--blue)] transition-colors hover:text-[var(--ink)]"
          >
            {open ? "收起" : "重看报告"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="text-xs leading-5 text-[var(--muted)] transition-colors hover:text-[var(--rust)]"
          >
            删除
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs leading-5 text-[var(--muted)]">
        <span className={`pill ${CONF_PILL[report.confidence]}`}>{CONF_LABEL[report.confidence]}</span>
        <span className="tabular-nums">
          {se.sources} 来源 · {se.independentDomains} 独立域名 · 交叉 {crossPct}% · 弃答 {se.unverified} 项
        </span>
        <span aria-hidden="true">·</span>
        <span>{new Date(entry.savedAt).toLocaleString("zh-CN")}</span>
      </div>

      {/* 检索路径预览：当轮拆题的检索线（后续可视化将把它画成路径图） */}
      {report.rounds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {report.rounds.map((r, i) => (
            <span
              key={i}
              className="pill pill-neutral max-w-full truncate"
              title={`检索 ${r.resultCount} 条结果`}
            >
              {String(i + 1).padStart(2, "0")} {r.subQuery}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 border-t border-[var(--rule-soft)] pt-4">
          <ReportView report={report} onAddWatch={onAddWatch} />
        </div>
      )}
    </li>
  );
}

export default function HistoryTab({
  refreshKey,
  onAddWatch,
}: {
  refreshKey: number;
  onAddWatch: (question: string) => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setEntries(loadHistory());
  }, [refreshKey]);

  const handleDelete = (id: string) => {
    removeHistoryEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    clearHistory();
    setEntries([]);
    setConfirmClear(false);
  };

  return (
    <section>
      {entries.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-[var(--muted)]">
            报告完成即自动归档（本机浏览器保存，最多 20 份），重看不重新检索、不消耗额度。
          </p>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-xs leading-5 text-[var(--muted)] transition-colors hover:text-[var(--rust)]"
          >
            {confirmClear ? "再点一次确认清空" : "清空全部"}
          </button>
        </div>
      )}

      {entries.length ? (
        <ol className="space-y-3">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} onAddWatch={onAddWatch} onDelete={handleDelete} />
          ))}
        </ol>
      ) : (
        <p className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-6 text-center text-sm leading-6 text-[var(--muted)]">
          还没有归档的调查。
          <br />
          完成一次深度调查后，报告会自动存入这里，随时可以重看证据链。
        </p>
      )}
    </section>
  );
}
