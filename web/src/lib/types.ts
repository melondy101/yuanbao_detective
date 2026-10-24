// 全局类型定义（AI 侦探社）
import type { CredTier } from "./credibility";

/** 元宝搜索 SearchPro 单条结果（Response.Pages 内 JSON 字符串解析后） */
export interface SearchPage {
  title: string;
  url: string;
  site?: string;
  passage?: string;
  date?: string;
  score?: number;
  vr?: boolean;
  vr_category?: string;
  vrid?: string;
}

export interface SourceRef {
  id: number;
  title: string;
  /** 原样透传，禁止改写（docs/接口规则.md 二） */
  url: string;
  site?: string;
  date?: string;
  vr: boolean;
  /** 来源可信度分级（确定性域名判定，见 lib/credibility.ts） */
  cred: CredTier;
}

export interface FactItem {
  text: string;
  refs: number[];
}

export interface InferenceItem {
  text: string;
  basis: string;
}

export interface ConflictItem {
  topic: string;
  detail: string;
  refs: number[];
}

export interface RoundInfo {
  subQuery: string;
  resultCount: number;
  topTitles: string[];
  cached: boolean;
}

export type Confidence = "high" | "medium" | "low";

/** 调查自评：全部为确定性统计（服务端算好），不依赖模型自述 */
export interface SelfEval {
  /** 来源总数 */
  sources: number;
  /** 独立注册域数量 */
  independentDomains: number;
  /** 各可信度分级数量 */
  credMix: { tier: CredTier; count: number }[];
  /** 权威 VR 信源数量 */
  vrSources: number;
  /** 事实条目总数 */
  facts: number;
  /** 被 ≥2 个独立域名支撑的事实条数 */
  crossVerifiedFacts: number;
  /** 主动弃答条目数（查不到而明说的部分） */
  unverified: number;
  /** 弃答占可答项（事实+推断+弃答）的百分比，0-100 */
  abstainRate: number;
  /** 被拦截的越界来源编号条数（模型幻觉编号防线） */
  droppedBadRefs: number;
}

export interface InvestigationReport {
  question: string;
  conclusion: string;
  confidence: Confidence;
  /** 最新信息时效，取自来源 date，无则 "unknown" */
  asOf: string;
  evidence: {
    fact: FactItem[];
    inference: InferenceItem[];
    unverified: string[];
  };
  conflicts: ConflictItem[];
  sourceNotes: string;
  sources: SourceRef[];
  selfEval: SelfEval;
  rounds: RoundInfo[];
  meta: {
    generatedAt: string;
    elapsedMs: number;
    searchCalls: number;
    cachedRounds: number;
    droppedByRedline: number;
    model: string;
  };
}

export interface WatchSnapshot {
  at: string;
  top: { title: string; url: string; site?: string; date?: string; vr?: boolean }[];
  resultCount: number;
}

export interface WatchTask {
  id: string;
  question: string;
  createdAt: string;
  intervalMin: number;
  auto: boolean;
  snapshots: WatchSnapshot[];
}
