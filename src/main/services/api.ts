import fetch from 'node-fetch';

export interface ChatRequest {
  apiUrl: string;
  apiKey: string;
  modelName: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  systemPrompt?: string;
  timeout?: number; // 秒
}

export interface ChatResponse {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface TestResult {
  ok: boolean;
  message: string;
  latency?: number;
}

/**
 * API 服务 - OpenAI Chat Completions 兼容接口
 * 支持 IPv6 地址格式 http://[IPv6]:port/path
 */
export class ApiService {
  /**
   * 发送聊天请求
   */
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const { apiUrl, apiKey, modelName, messages, temperature, topP, maxTokens, systemPrompt, timeout } = req;

    // 构造消息列表，systemPrompt 注入 system 角色
    const finalMessages: any[] = [];
    if (systemPrompt) {
      finalMessages.push({ role: 'system', content: systemPrompt });
    }
    // 输入规范化：多行 -> 单行
    for (const m of messages) {
      finalMessages.push({
        role: m.role,
        content: normalizeInput(m.content)
      });
    }

    const body: any = {
      model: modelName,
      messages: finalMessages,
      temperature: temperature ?? 0.6,
      stream: false
    };
    if (topP !== undefined && topP !== null) body.top_p = topP;
    if (maxTokens !== undefined && maxTokens !== null) body.max_tokens = maxTokens;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), (timeout ?? 60) * 1000);

    try {
      const start = Date.now();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal as any
      });
      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      const data = await response.json() as any;
      const latency = Date.now() - start;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('响应中无 choices 字段');
      }

      const content: string = data.choices[0].message?.content ?? '';
      const usage = data.usage;

      return {
        content,
        model: modelName, // 展示请求时配置的模型名
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        usage
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('请求超时，请检查网络或增大超时时间');
      }
      // 网络错误、鉴权错误、IPv6 格式等
      const msg = err?.message || String(err);
      if (msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET')) {
        throw new Error(`连接失败：${msg}`);
      }
      if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
        throw new Error('鉴权失败：Token 无效或已过期');
      }
      if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
        throw new Error(`DNS 解析失败：请检查 API 地址是否正确`);
      }
      throw new Error(`请求失败：${msg}`);
    }
  }

  /**
   * 测试连接（发送一条最小化请求）
   */
  async testConnection(model: any): Promise<TestResult> {
    const start = Date.now();
    try {
      await this.chat({
        apiUrl: model.apiUrl,
        apiKey: model.apiKey,
        modelName: model.modelName,
        messages: [{ role: 'user', content: 'ping/no_think' }],
        temperature: 0.1,
        timeout: 15
      });
      return { ok: true, message: '连接成功', latency: Date.now() - start };
    } catch (err: any) {
      return { ok: false, message: err?.message || '连接失败' };
    }
  }
}

/**
 * 输入规范化：多行文本 -> 单行
 * - \r\n \n \r 替换为空格
 * - 合并连续空白
 */
export function normalizeInput(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
