// 盯梢任务的浏览器本地存储（localStorage），无需数据库即可演示
import type { WatchTask } from "./types";

const KEY = "detective-watch-tasks-v1";

export function loadTasks(): WatchTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as WatchTask[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: WatchTask[]) {
  window.localStorage.setItem(KEY, JSON.stringify(tasks));
}

export function addTask(question: string, intervalMin = 30): WatchTask {
  const task: WatchTask = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    question,
    createdAt: new Date().toISOString(),
    intervalMin,
    auto: false,
    snapshots: [],
  };
  const tasks = loadTasks();
  tasks.unshift(task);
  saveTasks(tasks);
  return task;
}
