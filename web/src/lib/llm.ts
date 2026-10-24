// LLM 封装：任意 OpenAI 兼容 chat/completions 接口（DeepSeek / 硅基流动 / 百炼等）
// 仅用于「拆题」和「汇总」，事实一律来自搜索结果，模型不生成 url

export class LlmError extends Error {}

export function llmConfig() {
  const baseURL = (process.env.LLM_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "deepseek-chat";
  return { baseURL, apiKey, model };
}

export async function chatJSON<T>(system: string, user: string): Promise<T> {
  const { baseURL, apiKey, model } = llmConfig();
  if (!apiKey) {
    throw new LlmError("未配置 LLM_API_KEY：请在 web/.env.local 填入（任意 OpenAI 兼容服务均可）");
  }
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmError(`LLM 接口返回 ${res.status}：${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    return extractJson<T>(content);
  } catch {
    throw new LlmError("LLM 返回内容无法解析为 JSON，请重试或更换模型");
  }
}

/** 从模型输出中稳健提取第一个完整 JSON 对象/数组（容忍 markdown 代码块与前后缀文本） */
function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[{[]/);
  if (start === -1) throw new Error("no json");
  const open = raw[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return JSON.parse(raw.slice(start, i + 1)) as T;
      }
    }
  }
  throw new Error("incomplete json");
}
