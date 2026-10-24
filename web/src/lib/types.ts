// 全局类型定义（AI 侦探社）

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
