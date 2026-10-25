// 深度调查历史卷宗（localStorage），无需数据库即可演示
// 只存完整报告 JSON：重看时直接复用 ReportView，数据与当时一致，不重新检索
import type { InvestigationReport } from "./types";

const KEY = "detective-history-v1";
const MAX_ENTRIES = 20;

export interface HistoryEntry {
  id: string;
  savedAt: string;
  report: InvestigationReport;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw as string) as HistoryEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  window.localStorage.setItem(KEY, JSON.stringify(entries));
}

/** 报告完成后归档；超出上限裁掉最旧的。存储满时逐条裁旧重试，最终静默失败（不影响报告展示） */
export function archiveReport(report: InvestigationReport): HistoryEntry | null {
  if (typeof window === "undefined") return null;
  const entry: HistoryEntry = {
    id: report.meta.generatedAt,
    savedAt: report.meta.generatedAt,
    report,
  };
  let tasks = loadHistory().filter((e) => e.id !== entry.id);
  tasks.unshift(entry);
  tasks = tasks.slice(0, MAX_ENTRIES);
  while (tasks.length > 0) {
    try {
      saveHistory(tasks);
      return entry;
    } catch {
      tasks = tasks.slice(0, -1); // 配额溢出：丢最旧的再试
    }
  }
  return null;
}

export function removeHistoryEntry(id: string) {
  saveHistory(loadHistory().filter((e) => e.id !== id));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
