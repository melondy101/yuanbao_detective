"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadTasks, saveTasks } from "@/lib/watchStore";
import Spinner from "./Spinner";
import type { WatchSnapshot, WatchTask } from "@/lib/types";

const INTERVAL_OPTIONS = [
  { value: 1, label: "每 1 分钟（演示）" },
  { value: 5, label: "每 5 分钟" },
  { value: 30, label: "每 30 分钟" },
  { value: 60, label: "每 1 小时" },
  { value: 1440, label: "每天" },
];

function diffWith(prev: WatchSnapshot | undefined, cur: WatchSnapshot): { added: number; dateChanged: number } | null {
  if (!prev) return null;
  const prevTitles = new Map(prev.top.map((t) => [t.title, t.date ?? ""]));
  let added = 0;
  let dateChanged = 0;
  for (const t of cur.top) {
    if (!prevTitles.has(t.title)) added++;
    else if (prevTitles.get(t.title) !== (t.date ?? "") && (t.date ?? "") !== "") dateChanged++;
  }
  return { added, dateChanged };
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function WatchTab({ refreshKey }: { refreshKey: number }) {
  const [tasks, setTasks] = useState<WatchTask[]>([]);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState("");
  const tasksRef = useRef<WatchTask[]>([]);
  const runningRef = useRef<Set<string>>(new Set());
  const runOneRef = useRef<(id: string) => Promise<void>>(async () => {});

  useEffect(() => {
    setTasks(loadTasks());
  }, [refreshKey]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const updateTasks = useCallback((fn: (prev: WatchTask[]) => WatchTask[]) => {
    setTasks((prev) => {
      const next = fn(prev);
      saveTasks(next);
      return next;
    });
  }, []);

  const runOne = useCallback(async (id: string) => {
    const task = tasksRef.current.find((t) => t.id === id);
    if (!task || runningRef.current.has(id)) return;
    runningRef.current.add(id);
    setRunning(new Set(runningRef.current));
    try {
      const res = await fetch("/api/watch/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: task.question }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((prev) => ({ ...prev, [id]: typeof data.error === "string" ? data.error : "快照失败" }));
        return;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      const snapshot = data.snapshot as WatchSnapshot;
      updateTasks((prev) => prev.map((t) => (t.id === id ? { ...t, snapshots: [...t.snapshots, snapshot] } : t)));
    } catch {
      setErrors((prev) => ({ ...prev, [id]: "网络错误" }));
    } finally {
      runningRef.current.delete(id);
      setRunning(new Set(runningRef.current));
    }
  }, [updateTasks]);

  useEffect(() => {
    runOneRef.current = runOne;
  }, [runOne]);

  // 自动盯梢：本页面打开期间，每 30 秒检查一次到期任务（每次最多跑一个，避免并发冲击额度）
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      for (const t of tasksRef.current) {
        if (!t.auto) continue;
        const lastIso = t.snapshots.length ? t.snapshots[t.snapshots.length - 1].at : t.createdAt;
        const last = Date.parse(lastIso);
        if (Number.isFinite(last) && now - last >= t.intervalMin * 60_000) {
          await runOneRef.current(t.id);
          break;
        }
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // 两步删除确认的自动复位
  useEffect(() => {
    if (!confirmDelete) return;
    const t = window.setTimeout(() => setConfirmDelete(""), 3000);
    return () => window.clearTimeout(t);
  }, [confirmDelete]);

  const emptyList = tasks.length === 0;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-3">
        <QuickAdd onAdd={(q, m) => updateTasks((prev) => [makeTask(q, m), ...prev])} />
      </div>
      <p className="text-xs leading-5 text-[var(--muted)]">
        自动盯梢在本页面打开时运行；每次快照消耗 1 次真实搜索额度（活动期共 6000 次）。
      </p>

      {emptyList && (
        <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-10 text-center text-[13px] leading-6 text-[var(--muted)]">
          还没有盯梢任务。先到「深度调查」发起一次调查，完成后点报告里的「加入盯梢」；
          也可以直接在上方输入想跟踪的问题。
        </div>
      )}

      {tasks.map((t, taskIdx) => {
        const lastDiff = diffWith(t.snapshots[t.snapshots.length - 2], t.snapshots[t.snapshots.length - 1]);
        const busy = running.has(t.id);
        return (
          <div key={t.id} className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-sm font-medium leading-6" title={t.question}>
                  <span aria-hidden="true" className="text-[11px] tabular-nums text-[var(--muted)]">
                    {String(taskIdx + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">{t.question}</span>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs tabular-nums leading-5 text-[var(--muted)]">
                  <span>
                    创建于 {fmtTime(t.createdAt)} · 已 {t.snapshots.length} 次快照
                    {t.snapshots.length > 0 && ` · 最近 ${fmtTime(t.snapshots[t.snapshots.length - 1].at)}`}
                  </span>
                  {lastDiff && (lastDiff.added > 0 || lastDiff.dateChanged > 0) && (
                    <span className="pill pill-ochre">
                      有变化：新增 {lastDiff.added} · 日期更新 {lastDiff.dateChanged}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => runOne(t.id)}
                  disabled={busy}
                  className="inline-flex h-9 min-w-24 items-center justify-center rounded-md border border-[var(--rule)] bg-[var(--paper)] px-3 text-[13px] font-medium transition-colors hover:border-[#c9cac4] disabled:opacity-40"
                >
                  {busy ? (
                    <>
                      <Spinner />
                      <span className="ml-1.5">快照中</span>
                    </>
                  ) : (
                    "立即快照"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDelete === t.id) {
                      setConfirmDelete("");
                      updateTasks((prev) => prev.filter((x) => x.id !== t.id));
                    } else {
                      setConfirmDelete(t.id);
                    }
                  }}
                  className={
                    "inline-flex h-9 items-center rounded-md border px-3 text-[13px] transition-colors " +
                    (confirmDelete === t.id
                      ? "border-[rgba(138,74,58,0.4)] bg-[rgba(138,74,58,0.06)] font-medium text-[var(--rust)]"
                      : "border-transparent text-[var(--muted)] hover:border-[var(--rule)] hover:text-[var(--rust)]")
                  }
                >
                  {confirmDelete === t.id ? "确认删除" : "删除"}
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[var(--ink)]">
              <label className="flex min-h-9 items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={t.auto}
                  onChange={(e) => updateTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, auto: e.target.checked } : x)))}
                  className="accent-[var(--ink)]"
                />
                自动盯梢
              </label>
              <label className="flex min-h-9 items-center gap-1.5">
                快照间隔
                <select
                  value={t.intervalMin}
                  onChange={(e) => updateTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, intervalMin: Number(e.target.value) } : x)))}
                  className="h-8 rounded-md border border-[var(--rule)] bg-white px-2 text-[13px]"
                >
                  {INTERVAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {errors[t.id] && (
              <p role="alert" className="mt-2 text-[13px] leading-6 text-[var(--rust)]">
                {errors[t.id]}
              </p>
            )}

            {t.snapshots.length > 0 && (
              <div className="mt-3 border-t border-[var(--rule-soft)] pt-2">
                {[...t.snapshots].reverse().slice(0, 5).map((snap, idx) => {
                  const realIndex = t.snapshots.length - 1 - idx;
                  const prev = realIndex > 0 ? t.snapshots[realIndex - 1] : undefined;
                  const d = diffWith(prev, snap);
                  return (
                    <div key={snap.at} className="border-b border-[var(--rule-soft)] py-2.5 text-[13px] last:border-b-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                        <span className="text-[var(--muted)]">{fmtTime(snap.at)}</span>
                        <span className="text-[#a8a9a4]">{snap.resultCount} 条结果</span>
                        {d && (
                          <span className={d.added > 0 || d.dateChanged > 0 ? "text-[var(--ochre)]" : "text-[#a8a9a4]"}>
                            {d.added > 0 || d.dateChanged > 0
                              ? `较上次：新增 ${d.added} · 日期更新 ${d.dateChanged}`
                              : "较上次无变化"}
                          </span>
                        )}
                        {!d && <span className="text-[#a8a9a4]">首次快照</span>}
                      </div>
                      <ul className="mt-1 space-y-0.5 leading-6">
                        {snap.top.map((item) => (
                          <li key={item.url} className="truncate">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--blue)] transition-colors hover:text-[var(--ink)]"
                            >
                              {item.title}
                              <span className="sr-only">（新标签打开）</span>
                            </a>
                            {item.date && <span className="ml-1.5 text-xs text-[#a8a9a4]">（{item.date}）</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function makeTask(question: string, intervalMin: number): WatchTask {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    question,
    createdAt: new Date().toISOString(),
    intervalMin,
    auto: false,
    snapshots: [],
  };
}

function QuickAdd({ onAdd }: { onAdd: (question: string, intervalMin: number) => void }) {
  const [q, setQ] = useState("");
  const [m, setM] = useState(30);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="watch-quick-add" className="sr-only">
        盯梢问题
      </label>
      <input
        id="watch-quick-add"
        name="watch-question"
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="直接输入要盯梢的问题，例：某某活动还有名额吗…"
        maxLength={120}
        className="min-h-9 min-w-0 flex-1 rounded-md border border-[var(--rule)] bg-white px-3 py-2 text-base leading-6 outline-none placeholder:text-[#a8a9a4] focus:border-[var(--blue)] sm:text-sm"
      />
      <label htmlFor="watch-quick-interval" className="sr-only">
        快照间隔
      </label>
      <select
        id="watch-quick-interval"
        value={m}
        onChange={(e) => setM(Number(e.target.value))}
        className="h-9 rounded-md border border-[var(--rule)] bg-white px-2 text-[13px]"
      >
        {INTERVAL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!q.trim()}
        onClick={() => {
          onAdd(q.trim(), m);
          setQ("");
        }}
        className="inline-flex h-9 items-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-40"
      >
        添加盯梢
      </button>
    </div>
  );
}
