import { reactive, ref } from 'vue';

// ─── 应用状态 ───────────────────────────────────────────────
export const appState = reactive({
  // 主题: 'light' | 'dark'
  theme: 'dark' as 'light' | 'dark',
  // 科幻 3D 效果开关（低性能模式关闭）
  sciFi3D: true,
  // 侧栏显示
  showSidebar: true,
  // 设置面板显示
  showSettings: false,
  // 设置面板子 tab
  settingsTab: 'models' as 'models' | 'clean-rules' | 'about'
});

// ─── 模型配置状态 ───────────────────────────────────────────
export interface ModelConfig {
  id: number;
  name: string;
  apiUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
  timeout: number;
  isDefault: boolean;
}

export const models = ref<ModelConfig[]>([]);
export const activeModel = ref<ModelConfig | null>(null);

export async function loadModels() {
  const list = await window.api.listModels();
  models.value = list;
  const def = list.find((m: any) => m.isDefault) || list[0];
  activeModel.value = def || null;
}

// ─── 会话状态 ───────────────────────────────────────────────
export interface Conversation {
  id: number;
  title: string;
  modelId: number | null;
  modelName: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  pinned: boolean;
  created_at: number;
  updated_at: number;
}

export const conversations = ref<Conversation[]>([]);
export const activeConversation = ref<Conversation | null>(null);
export const conversationMessages = ref<any[]>([]);
export const convSearchKeyword = ref('');

export async function loadConversations() {
  const list = await (convSearchKeyword.value
    ? window.api.searchConversations(convSearchKeyword.value)
    : window.api.listConversations());
  conversations.value = list;
}

export async function loadConversationMessages(convId: number) {
  conversationMessages.value = await window.api.listMessages(convId);
}

// ─── 发送状态 ───────────────────────────────────────────────
export const isSending = ref(false);
export const sendingError = ref<string | null>(null);
export const lastUsage = ref<{ prompt: number; completion: number; total: number } | null>(null);
