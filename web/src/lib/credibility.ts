// 来源可信度分级（来源：调研报告最佳实践「来源可信标签」，对标 Perplexity Source Labels）
// 纯函数、无副作用：同一 URL 在服务端统计与客户端渲染必然得到同一分级，模型不经手分级结果。

export type CredTier = "gov" | "academic" | "reference" | "media" | "community" | "other";

export const CRED_LABEL: Record<CredTier, string> = {
  gov: "官方",
  academic: "学术",
  reference: "百科",
  media: "媒体",
  community: "社区",
  other: "其他",
};

/** 复用既有分区编码药丸：官方=teal（同事实区）、学术=blue、媒体=plum、百科/社区/其他=neutral */
export const CRED_PILL: Record<CredTier, string> = {
  gov: "pill-teal",
  academic: "pill-blue",
  reference: "pill-neutral",
  media: "pill-plum",
  community: "pill-neutral",
  other: "pill-neutral",
};

const CRED_ORDER: CredTier[] = ["gov", "academic", "reference", "media", "community", "other"];

/** 常见二级伪后缀：取「注册域」时保留三段 */
const MULTIPART_SUFFIX = new Set([
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn", "ac.cn",
  "co.uk", "ac.uk", "com.hk", "com.tw", "org.tw",
]);

const MEDIA_DOMAINS = new Set([
  // 中央与主要官方媒体
  "xinhuanet.com", "xinhua.org", "news.cn", "people.com.cn", "cctv.com", "cntv.cn",
  "chinanews.com", "chinanews.com.cn", "chinadaily.com.cn", "gmw.cn", "cnr.cn",
  "china.com.cn", "ce.cn", "yicai.com", "thepaper.cn", "caixin.com",
  "youth.cn", "cyol.com", "cyol.net",
  "jiemian.com", "21jingji.com", "ifeng.com", "zaobao.com",
  // 主要门户与科技媒体
  "sina.com.cn", "sohu.com", "163.com", "qq.com", "cnbeta.com.tw",
  "36kr.com", "huxiu.com", "ifanr.com", "geekpark.net", "ithome.com",
]);

/** 以主机名后缀匹配的站点（注册域不能表达的部分） */
const REFERENCE_SUFFIXES = [
  "baike.baidu.com", "wikipedia.org", "wikisource.org", "wikimedia.org",
  "britannica.com", "moegirl.org.cn",
];

const ACADEMIC_EXTRA = new Set(["arxiv.org", "ssrn.com", "springer.com", "nature.com", "science.org"]);

/** 高质量社区/平台（用户生成内容为主，但主流、可点开验证） */
const COMMUNITY_DOMAINS = new Set([
  "zhihu.com", "douban.com", "maoyan.com", "doubanio.com",
  "csdn.net", "juejin.cn", "segmentfault.com", "cnblogs.com", "51cto.com",
  "jianshu.com", "v2ex.com", "sspai.com",
]);

/** 从 URL 取主机名（小写、去端口、去 www）；解析失败返回空串 */
export function hostnameOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 注册域核心：输入为裸主机名（如 new.qq.com → qq.com）；gov.cn 等二级伪后缀保留三段 */
function registrableDomainOfHost(host: string): string {
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join(".");
  return MULTIPART_SUFFIX.has(last2) ? parts.slice(-3).join(".") : last2;
}

/** 注册域：baike.baidu.com → baidu.com；www.gov.cn → gov.cn；无法解析返回空串 */
export function registrableDomain(url: string): string {
  return registrableDomainOfHost(hostnameOf(url));
}

/** 来源可信度分级：官方 > 学术 > 百科 > 媒体 > 社区 > 其他（按注册域/主机后缀确定性判定） */
export function classifySource(url: string): CredTier {
  const host = hostnameOf(url);
  if (!host) return "other";
  const domain = registrableDomainOfHost(host);
  if (/(\.|^)gov\.cn$/.test(host) || /\.gov$/.test(host)) return "gov";
  if (/(^|\.)edu\.cn$/.test(host) || /\.edu$/.test(host) || /(^|\.)ac\.cn$/.test(host) || /\.ac\.uk$/.test(host)) return "academic";
  if (ACADEMIC_EXTRA.has(domain)) return "academic";
  if (REFERENCE_SUFFIXES.some((s) => host === s || host.endsWith("." + s))) return "reference";
  if (MEDIA_DOMAINS.has(domain)) return "media";
  if (COMMUNITY_DOMAINS.has(domain)) return "community";
  return "other";
}

/** 一组 URL 中独立注册域的数量（交叉验证口径：≥2 个独立域名才算多源印证） */
export function distinctDomains(urls: string[]): number {
  return new Set(urls.map(registrableDomain).filter(Boolean)).size;
}

/** 按 CRED_ORDER 汇总各分级数量（仅返回 >0 的项） */
export function credMix(tiers: CredTier[]): { tier: CredTier; count: number }[] {
  return CRED_ORDER.map((tier) => ({ tier, count: tiers.filter((t) => t === tier).length })).filter(
    (x) => x.count > 0,
  );
}
