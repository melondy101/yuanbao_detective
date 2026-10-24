"use client";

import { useCallback, useEffect, useState } from "react";
import InvestigateTab from "@/components/InvestigateTab";
import WatchTab from "@/components/WatchTab";
import { addTask } from "@/lib/watchStore";

type TabId = "investigate" | "watch";

const TABS: { id: TabId; num: string; label: string }[] = [
  { id: "investigate", num: "01", label: "深度调查" },
  { id: "watch", num: "02", label: "持续盯梢" },
];

const tabLabel = (id: TabId) => (id === "watch" ? "持续盯梢" : "深度调查");

export default function Home() {
  const [tab, setTabState] = useState<TabId>("investigate");
  const [watchVersion, setWatchVersion] = useState(0);
  const [toast, setToast] = useState("");

  // Tab 状态放进 URL，刷新 / 分享 / 前进后退都能还原
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q === "watch" || q === "investigate") {
      setTabState(q);
      document.title = `${tabLabel(q)} · AI 侦探社`;
    }
  }, []);

  const setTab = useCallback((next: TabId) => {
    setTabState(next);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", next);
      window.history.replaceState(null, "", u);
    } catch {
      /* replaceState 不可用时静默降级，仅内存切换 */
    }
    document.title = `${tabLabel(next)} · AI 侦探社`;
  }, []);

  const onKeyDownTabs = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const idx = TABS.findIndex((t) => t.id === tab);
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = TABS[(idx + dir + TABS.length) % TABS.length].id;
      setTab(next);
      document.getElementById(`tab-${next}`)?.focus();
    },
    [tab, setTab],
  );

  const handleAddWatch = useCallback((question: string) => {
    addTask(question);
    setWatchVersion((v) => v + 1);
    setToast(`已加入盯梢：「${question}」，到「持续盯梢」查看`);
    window.setTimeout(() => setToast(""), 4000);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col sm:flex-row">
      {/* 左侧固定窄栏：品牌 · 分区导航 · 状态（移动端折叠为顶栏） */}
      <aside className="flex shrink-0 flex-col border-b border-[var(--rule)] px-5 pb-4 pt-5 sm:sticky sm:top-0 sm:h-screen sm:w-56 sm:border-b-0 sm:border-r sm:px-6 sm:py-8">
        <h1 className="font-serif text-lg leading-7 tracking-wide">AI 侦探社</h1>
        <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">腾讯元宝搜索驱动</p>

        <nav
          role="tablist"
          aria-label="功能区"
          onKeyDown={onKeyDownTabs}
          className="mt-3 flex flex-row gap-1 sm:mt-7 sm:flex-col sm:gap-1.5"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={
                  "flex min-h-9 items-baseline gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3 " +
                  (active
                    ? "bg-white text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--rule)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]")
                }
              >
                <span aria-hidden="true" className="text-[11px] tabular-nums text-[var(--muted)]">
                  {t.num}
                </span>
                <span className={active ? "font-medium" : ""}>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto hidden text-xs leading-5 text-[var(--muted)] sm:block">
          <p>活动期 6000 次检索额度</p>
          <p>每次调查 3~5 轮真实联网</p>
          <p className="mt-3 border-t border-[var(--rule-soft)] pt-3">来源可点开 · 查不到就说不知道</p>
        </div>
      </aside>

      {/* 内容列：窄阅读栏 */}
      <main className="min-w-0 flex-1 px-5 pb-16 pt-8 sm:px-10 sm:pt-14">
        <div className="max-w-[760px]">
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 rounded-md bg-[var(--ink)] px-4 py-2 text-center text-sm text-white"
          >
            {toast}
          </div>
        )}

        <div
          role="tabpanel"
          id="panel-investigate"
          aria-labelledby="tab-investigate"
          hidden={tab !== "investigate"}
        >
          <header className="mb-7">
            <h2 className="max-w-xl font-serif text-[26px] leading-[1.35] tracking-[0.01em]">
              把一个问题，查到有证据为止。
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
              拆解 · 检索 · 比对 · 成稿，每条结论都带可点开的来源。
            </p>
          </header>
          <InvestigateTab onAddWatch={handleAddWatch} />
        </div>

        <div role="tabpanel" id="panel-watch" aria-labelledby="tab-watch" hidden={tab !== "watch"}>
          <header className="mb-7">
            <h2 className="max-w-xl font-serif text-[26px] leading-[1.35] tracking-[0.01em]">
              盯住会变的事。
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
              周期快照、逐条比对，有变化就提醒，无变化就安静记录。
            </p>
          </header>
          <WatchTab refreshKey={watchVersion} />
        </div>

        <footer className="mt-14 border-t border-[var(--rule)] pt-4 text-xs leading-5 text-[var(--muted)]">
          <p>
            不调查时政与个人隐私 · WaytoAGI 1024 切磋大会 · 侦探赛道作品 #元宝搜索 #WaytoAGI
            #AI切磋大会 #1024超能Coding周末
          </p>
        </footer>
        </div>
      </main>
    </div>
  );
}
