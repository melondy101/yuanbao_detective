// 腾讯云元宝搜索（wsa）SearchPro 客户端：TC3-HMAC-SHA256 手写签名
// 接口约束以 docs/接口规则.md 为准：POST wsa.tencentcloudapi.com Version=2025-05-08
import crypto from "node:crypto";

const ENDPOINT = "wsa.tencentcloudapi.com";
const SERVICE = "wsa";
const VERSION = "2025-05-08";
const ACTION = "SearchPro";

export class SearchError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface SearchProOk {
  pages: unknown[];
  requestId: string;
}

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmac(key: crypto.BinaryLike, msg: string): Buffer {
  return crypto.createHmac("sha256", key).update(msg).digest();
}

async function callSearchPro(body: string): Promise<SearchProOk> {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new SearchError(
      "missing_credentials",
      "未配置腾讯云密钥：请在 web/.env.local 填入 TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY",
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalRequest = [
    "POST",
    "/",
    "",
    "content-type:application/json; charset=utf-8",
    `host:${ENDPOINT}`,
    `x-tc-action:${ACTION.toLowerCase()}`,
    "",
    "content-type;host;x-tc-action",
    sha256hex(body),
  ].join("\n");
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n");
  const kDate = hmac("TC3" + secretKey, date);
  const kService = hmac(kDate, SERVICE);
  const kSigning = hmac(kService, "tc3_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;

  const res = await fetch(`https://${ENDPOINT}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Host: ENDPOINT,
      "X-TC-Action": ACTION,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Version": VERSION,
      Authorization: authorization,
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await res.json()) as {
    Response?: {
      Pages?: string[];
      RequestId?: string;
      Error?: { Code?: string; Message?: string };
    };
  };

  const err = data.Response?.Error;
  if (err) {
    throw new SearchError(err.Code ?? "Unknown", err.Message ?? "元宝搜索接口返回错误");
  }
  if (!data.Response?.Pages) {
    throw new SearchError("BadResponse", "元宝搜索返回缺少 Pages 字段");
  }
  return { pages: data.Response.Pages, requestId: data.Response.RequestId ?? "" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 单次 SearchPro 调用（含重试与降级策略，docs/接口规则.md 四）：
 * - 限流：指数退避 1s/2s/4s，最多重试 3 次
 * - 鉴权失败：立即停止
 * - Mode 参数不被当前版本接受时：去掉 Mode 重试 1 次
 */
export async function searchProRaw(query: string): Promise<SearchProOk> {
  const modeEnv = process.env.WSA_MODE;
  let mode: number | null = modeEnv === "" ? null : Number(modeEnv ?? 2);
  if (mode !== null && !Number.isFinite(mode)) mode = 2;

  let body = mode === null ? { Query: query } : { Query: query, Mode: mode };

  for (let attempt = 0; ; attempt++) {
    let out: SearchProOk;
    try {
      out = await callSearchPro(JSON.stringify(body));
    } catch (e) {
      if (!(e instanceof SearchError)) throw e;
      const code = e.code;
      if (/AuthFailure|InvalidSecretId|SecretIdNotFound|InvalidCredential/i.test(code)) {
        throw new SearchError("auth", `鉴权失败（${code}）：请检查密钥是否正确、是否开通元宝搜索服务`);
      }
      if (/InsufficientBalance|ResourceInsufficient|LimitExceeded.Balance/i.test(code)) {
        throw new SearchError("balance", `余额/额度不足（${code}）：请到控制台确认额度`);
      }
      if (/InvalidParameter|InvalidParameterValue|UnsupportedParameter/i.test(code)) {
        if ("Mode" in body) {
          body = { Query: query };
          continue;
        }
        throw new SearchError("param", `参数错误（${code}）：${e.message}`);
      }
      if (attempt < 3 && (/Limit/i.test(code) || /RequestLimitExceeded|RequestThrottled/i.test(code))) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw e;
    }
    return out;
  }
}
