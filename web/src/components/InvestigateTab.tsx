"use client";

import { useEffect, useRef, useState } from "react";
import ReportView from "./ReportView";
import Spinner from "./Spinner";
import { archiveReport } from "@/lib/historyStore";
import type { InvestigationReport } from "@/lib/types";

const EXAMPLES = [
  "罗小黑战记 2 院线票房如何？后续有流媒体上线计划吗？",
  "腾讯元宝搜索和普通搜索引擎有什么区别？",
  "近期有哪些适合大学生参加的 AI 线上活动？",
];

const PHASES = [
  { title: "拆解问题", detail: "拟定 3~5 条检索线索" },
  { title: "全网检索", detail: "多轮真实联网，权威信源优先" },
  { title: "交叉比对", detail: "不同来源相互印证，冲突标出" },
  { title: "撰写报告", detail: "结论 / 依据 / 来源，三分法成稿" },
];
const PHASE_MS = 14_000;

interface ErrorUi {
  pill: string;
  title: string;
  box: string;
  guidance: string;
  retry: boolean;
}

const ERROR_UI: Record<string, ErrorUi> = {
  redline: {
    pill: "pill pill-ochre",
    title: "这个题目接不了",
    box: "border-[rgba(138,107,45,0.35)] bg-[rgba(138,107,45,0.06)]",
    guidance: "按赛道红线，不调查时政与个人隐私。换个题材再试：作品、活动、技术、生活消费类问题都可以，下方示例直接可点。",
    retry: false,
  },
  search: {
    pill: "pill pill-rust",
    title: "搜索通道出了问题",
    box: "border-[rgba(138,74,58,0.35)] bg-[rgba(138,74,58,0.05)]",
    guidance: "依次检查：① web/.env.local 里腾讯云密钥是否正确；② 腾讯云控制台余额与 6000 次额度是否可用；③ 服务端日志 [search-call] 行的错误码。修复后点“重试”。",
    retry: true,
  },
  llm: {
    pill: "pill pill-blue",
    title: "摘要模型连不上",
    box: "border-[rgba(83,107,131,0.35)] bg-[rgba(83,107,131,0.05)]",
    guidance: "检查 web/.env.local 里 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 三项是否属于同一家服务商，改完重启服务再试。",
    retry: true,
  },
  network: {
    pill: "pill pill-rust",
    title: "网络中断",
    box: "border-[rgba(138,74,58,0.35)] bg-[rgba(138,74,58,0.05)]",
    guidance: "确认服务还在运行（localhost:3000）且本机网络正常，然后点“重试”。",
    retry: true,
  },
};

/* 卷宗加载态：仪式流水线（参考 Gradus 规划仪式的分阶段加载模式）
   节点三态 + 阶段卡（诚实百分比，完成前封顶 96%）+ 方法论轮播 + 来源白名单信任行 */
const DOSSIER_TIPS = [
  { k: "交叉比对", t: "同一事实至少两个独立信源印证；说法冲突时并列双方并标注各自时效。" },
  { k: "三分法", t: "报告把结论分成「已证实 / 推断 / 查不到」——查不到就明说，不编答案。" },
  { k: "来源分级", t: "每条来源按官方 / 学术 / 百科 / 媒体分级展示，报告附独立域名数与弃答率自评。" },
  { k: "来源白名单", t: "链接全部原样取自元宝搜索结果，模型只引用编号、不经手 URL。" },
  { k: "检索策略", t: "难题先拆成 3~5 条检索线并行搜索，官网 / 媒体 / 百科等权威信源优先。" },
  { k: "额度缓存", t: "10 分钟内相同查询命中本地缓存，不重复消耗检索额度。" },
];

function DossierLoader({
  question,
  phase,
  elapsed,
}: {
  question: string;
  phase: number;
  elapsed: number;
}) {
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const [tipIdx, setTipIdx] = useState(0);

  // 等待期轮播调查方法论（约 5 秒一条）
  useEffect(() => {
    const timer = setInterval(() => setTipIdx((i) => (i + 1) % DOSSIER_TIPS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  // 诚实进度：阶段基线 + 阶段内耗时折算，封顶 96%，完成前绝不显示 100%
  const phaseSec = PHASE_MS / 1000;
  const intra = Math.max(0, elapsed - phase * phaseSec);
  const pct = Math.min(96, Math.max(6, Math.round(6 + phase * 22 + Math.min(intra / phaseSec, 1) * 22)));
  const remaining = PHASES.length - phase - 1;
  // 连接线三态：右节点完成→墨色；左完成右进行→赭石；否则浅规则色
  const lineState = (i: number) => (i + 1 < phase ? "done" : i < phase ? "live" : "todo");

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-5 rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-5"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--rule-soft)] pb-3">
        <p className="font-serif text-[15px] leading-6">
          案卷调取中
          <span aria-hidden="true" className="caret-blink ml-1.5 inline-block h-[15px] w-[2px] translate-y-[2px] bg-[var(--ink)]" />
        </p>
        <span className="pill pill-neutral tabular-nums">
          已进行 {mm}:{ss}
        </span>
      </div>
      <p className="mt-3 truncate text-[13px] leading-6 text-[var(--muted)]" title={question}>
        正在调查：{question}
      </p>

      {/* 流水线：节点三态（完成墨底反白 / 进行赭石光晕 / 待办细描边）+ 连接线 */}
      <ol className="mt-4 flex items-start" aria-label="调查阶段">
        {PHASES.map((p, i) => {
          const state = i < phase ? "done" : i === phase ? "live" : "todo";
          return (
            <li key={p.title} className="flex min-w-0 flex-1 items-start last:flex-none">
              <div className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={
                    "grid h-7 w-7 place-items-center rounded-full border text-[11px] font-medium tabular-nums transition-colors duration-300 " +
                    (state === "done"
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : state === "live"
                        ? "border-[var(--ochre)] bg-[rgba(138,107,45,0.08)] text-[var(--ochre)] shadow-[0_0_0_4px_rgba(138,107,45,0.12)]"
                        : "border-[var(--rule)] bg-white text-[var(--muted)]")
                  }
                >
                  {state === "done" ? "✓" : String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={
                    "text-xs leading-4 " +
                    (state === "live"
                      ? "font-medium text-[var(--ink)]"
                      : state === "done"
                        ? "text-[var(--muted)]"
                        : "text-[#a8a9a4]")
                  }
                >
                  {p.title}
                </span>
                <span className="sr-only">
                  {state === "done" ? "（已完成）" : state === "live" ? "（进行中）" : "（待进行）"}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={
                    "mx-1 mt-[14px] h-px min-w-2 flex-1 rounded-full transition-colors duration-500 " +
                    (lineState(i) === "done"
                      ? "bg-[var(--ink)]"
                      : lineState(i) === "live"
                        ? "bg-[var(--ochre)]"
                        : "bg-[var(--rule)]")
                  }
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* 阶段卡：眉题 + 百分比 + 细进度条 + 三项统计（只放真实持有的量） */}
      <div className="mt-4 rounded-md border border-[var(--rule)] bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs leading-5 text-[var(--muted)]">
            <span aria-hidden="true" className="dot-breathe h-1.5 w-1.5 rounded-full bg-[var(--ochre)]" />
            第 {String(phase + 1).padStart(2, "0")} 步 · {PHASES[phase].title}
          </p>
          <p className="font-serif text-xl leading-7 tabular-nums">
            {pct}
            <span className="ml-0.5 text-xs text-[var(--muted)]">%</span>
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="调查进度"
          className="mt-2 h-[3px] overflow-hidden rounded-full bg-[var(--rule)]"
        >
          <span
            style={{ width: `${pct}%` }}
            className="block h-full rounded-full bg-[var(--ink)] transition-[width] duration-700 ease-out"
          />
        </div>
        <p className="mt-2.5 text-[13px] leading-6 text-[var(--ink)]">{PHASES[phase].detail}…</p>
        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-[var(--rule)] bg-[var(--rule)]">
          <div className="bg-[var(--paper)] px-2 py-2 text-center">
            <b className="block font-serif text-lg font-normal leading-7 tabular-nums">
              {phase + 1}
              <span className="text-xs font-normal text-[var(--muted)]"> / {PHASES.length}</span>
            </b>
            <span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">调查阶段</span>
          </div>
          <div className="bg-[var(--paper)] px-2 py-2 text-center">
            <b className="block font-serif text-lg font-normal leading-7 tabular-nums">
              {mm}:{ss}
            </b>
            <span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">已耗时</span>
          </div>
          <div className="bg-[var(--paper)] px-2 py-2 text-center">
            <b className="block font-serif text-lg font-normal leading-7 tabular-nums">{remaining}</b>
            <span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">剩余阶段</span>
          </div>
        </div>
      </div>

      {/* 方法论轮播：等待期增值信息，逐条淡入 */}
      <div className="mt-3 flex items-start gap-2 border-t border-[var(--rule-soft)] pt-3">
        <span className="pill pill-teal shrink-0">{DOSSIER_TIPS[tipIdx].k}</span>
        <p key={tipIdx} className="animate-[fadeSlideUp_.4s_ease_forwards] text-xs leading-5 text-[var(--muted)]">
          {DOSSIER_TIPS[tipIdx].t}
        </p>
      </div>

      {/* 信任行：来源白名单（对齐 Gradus 的「模型不经手链接」设计） */}
      <p className="mt-3 border-t border-[var(--rule-soft)] pt-3 text-xs leading-5 text-[var(--muted)]">
        全程通常 20~60 秒 · 每一步都是真实联网检索 · 来源链接原样取自搜索结果，模型不经手 URL
      </p>
    </div>
  );
}

export default function InvestigateTab({
  onAddWatch,
  onReportSaved,
}: {
  onAddWatch: (question: string) => void;
  onReportSaved: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState("");
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // 桌面指针环境自动聚焦唯一主输入框；移动端不聚焦，避免键盘弹出顶起布局
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) boxRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!loading) return;
    setPhase(0);
    setElapsed(0);
    document.title = "调查中 · 元宝探长";
    const phaseTimer = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), PHASE_MS);
    const tickTimer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(phaseTimer);
      clearInterval(tickTimer);
      document.title = "深度调查 · 元宝探长";
    };
  }, [loading]);

  async function run(q?: string) {
    const target = (q ?? question).trim();
    if (!target || loading) return;
    setQuestion(target);
    setLoading(true);
    setError("");
    setErrorKind("");
    setReport(null);
    try {
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "调查失败，请稍后重试");
        setErrorKind(typeof data.kind === "string" ? data.kind : "");
        return;
      }
      setReport(data as InvestigationReport);
      // 报告完成即归档到「调查历史」（localStorage，失败不影响展示）
      archiveReport(data as InvestigationReport);
      onReportSaved();
    } catch {
      setError("请求没有到达服务端");
      setErrorKind("network");
    } finally {
      setLoading(false);
    }
  }

  const errorUi = error ? (ERROR_UI[errorKind] ?? ERROR_UI.network) : null;

  return (
    <section>
      <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
        <label htmlFor="investigate-input" className="sr-only">
          调查问题
        </label>
        <textarea
          id="investigate-input"
          name="question"
          ref={boxRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
          }}
          rows={3}
          maxLength={300}
          placeholder="想查什么？例：只记得剧情想找一部动画，或查某场活动还有没有名额…"
          className="w-full resize-none rounded-md border border-[var(--rule)] bg-white px-3 py-2 text-base leading-7 outline-none placeholder:text-[#a8a9a4] focus:border-[var(--blue)] sm:text-sm"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs leading-5 text-[var(--muted)]">
            {"Ctrl\u00A0+\u00A0Enter"} 发起调查 · 全程真实联网检索
          </span>
          <button
            type="button"
            onClick={() => run()}
            disabled={loading || !question.trim()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--ink)] px-5 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <Spinner />
                <span className="ml-1.5">开始调查</span>
              </>
            ) : (
              "开始调查"
            )}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--muted)]">示例</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={loading}
            onClick={() => run(ex)}
            className="rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-1 text-xs leading-5 text-[var(--muted)] transition-colors hover:border-[#c9cac4] hover:text-[var(--ink)] disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* 调查流程：细线索引（参考语言的 fine-line diagram，落到本产品的真实流程） */}
      <div className="mt-6 rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-5 py-4">
        <ol className="grid gap-3 sm:grid-cols-4 sm:gap-0">
          {PHASES.map((p, i) => (
            <li
              key={p.title}
              className="flex items-baseline gap-2.5 sm:flex-col sm:gap-1 sm:border-l sm:border-[var(--rule-soft)] sm:pl-4 sm:first:border-l-0 sm:first:pl-0"
            >
              <span
                aria-hidden="true"
                className="font-serif text-[15px] leading-6 tabular-nums text-[var(--muted)]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[13px] font-medium leading-5">{p.title}</span>
              <span className="hidden text-xs leading-5 text-[var(--muted)] sm:block">{p.detail}</span>
            </li>
          ))}
        </ol>
      </div>

      {loading && <DossierLoader question={question} phase={phase} elapsed={elapsed} />}

      {error && errorUi && (
        <div role="alert" className={`mt-5 rounded-lg border p-4 text-sm ${errorUi.box}`}>
          <p className="flex items-center gap-2 font-medium">
            <span className={errorUi.pill}>{errorKind === "redline" ? "红线" : "故障"}</span>
            <span>{errorUi.title}</span>
          </p>
          <p className="mt-1.5 leading-6 text-[var(--ink)]">{error}</p>
          <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{errorUi.guidance}</p>
          {errorUi.retry && (
            <button
              type="button"
              onClick={() => run()}
              className="mt-3 inline-flex h-8 items-center rounded-md border border-[var(--rule)] bg-[var(--paper)] px-3 text-[13px] font-medium transition-colors hover:border-[#c9cac4]"
            >
              重试这次调查
            </button>
          )}
        </div>
      )}

      {report && (
        <div className="mt-6">
          <ReportView report={report} onAddWatch={onAddWatch} />
        </div>
      )}
    </section>
  );
}
