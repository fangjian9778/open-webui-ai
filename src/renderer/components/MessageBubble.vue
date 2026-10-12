<template>
  <div :class="['message-bubble', message.role]">
    <!-- 角色图标 -->
    <div class="avatar">
      <template v-if="message.role === 'user'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </template>
      <template v-else>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <circle cx="12" cy="5" r="2"/>
          <path d="M12 7v4M8 16h.01M16 16h.01"/>
        </svg>
      </template>
    </div>

    <!-- 消息内容 -->
    <div class="message-body">
      <div class="role-label">
        <span v-if="message.role === 'user'">你</span>
        <span v-else-if="message.role === 'assistant'">{{ message.modelName || 'AI' }}</span>
        <span v-else>系统</span>
        <span class="time">{{ formatTime(message.created_at) }}</span>
      </div>

      <!-- Markdown 渲染 -->
      <div class="message-content markdown-body" v-html="renderedContent"></div>

      <!-- Usage 信息 -->
      <div v-if="message.role === 'assistant' && hasUsage(message)" class="usage-info">
        <span>tokens: {{ message.usage_prompt || 0 }}↑ / {{ message.usage_completion || 0 }}↓ · total {{ message.usage_total || 0 }}</span>
      </div>

      <!-- 操作按钮 -->
      <div class="message-actions">
        <button class="action-btn" title="复制" @click="copyContent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
        <button v-if="message.role === 'assistant'" class="action-btn" title="重新生成" @click="$emit('regenerate', message)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>
        <button class="action-btn danger" title="删除" @click="$emit('delete', message)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{
  message: {
    id: number;
    role: string;
    content: string;
    modelName?: string;
    usage_prompt?: number;
    usage_completion?: number;
    usage_total?: number;
    created_at: number;
  };
}>();

defineEmits(['regenerate', 'delete']);

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
});

const renderedContent = computed(() => {
  try {
    return marked.parse(props.message.content) as string;
  } catch {
    return props.message.content;
  }
});

function hasUsage(msg: any) {
  return msg.usage_prompt || msg.usage_completion || msg.usage_total;
}

function copyContent() {
  navigator.clipboard.writeText(props.message.content).then(
    () => alert('已复制到剪贴板'),
    () => alert('复制失败')
  );
}

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped>
.message-bubble {
  display: flex;
  gap: 12px;
  max-width: 85%;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-bubble.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-bubble.assistant {
  align-self: flex-start;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-bubble.user .avatar {
  background: linear-gradient(135deg, var(--color-primary-dim) 0%, var(--color-primary) 100%);
  color: #000;
}

.message-bubble.assistant .avatar {
  background: linear-gradient(135deg, #1a2a5a 0%, #2a3a7a 100%);
  color: var(--color-primary);
  border: 1px solid rgba(0, 212, 255, 0.3);
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.2);
}

.message-body {
  position: relative;
  padding: 12px 16px;
  border-radius: 12px;
  min-width: 60px;
}

.message-bubble.user .message-body {
  border-top-right-radius: 4px;
}

.message-bubble.assistant .message-body {
  border-top-left-radius: 4px;
}

.role-label {
  font-size: 12px;
  margin-bottom: 6px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 8px;
}

.time {
  font-size: 11px;
  opacity: 0.6;
}

.message-content {
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Markdown 样式 */
:deep(.markdown-body) { font-size: 14px; line-height: 1.65; }
:deep(.markdown-body h1), :deep(.markdown-body h2), :deep(.markdown-body h3) {
  margin: 12px 0 8px;
  font-weight: 600;
}
:deep(.markdown-body h1) { font-size: 18px; }
:deep(.markdown-body h2) { font-size: 16px; }
:deep(.markdown-body h3) { font-size: 15px; }
:deep(.markdown-body p) { margin: 6px 0; }
:deep(.markdown-body ul), :deep(.markdown-body ol) { padding-left: 20px; margin: 6px 0; }
:deep(.markdown-body li) { margin: 2px 0; }
:deep(.markdown-body code:not(pre code)) {
  background: rgba(0, 0, 0, 0.25);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  font-family: var(--font-mono);
}
:deep(.markdown-body pre) {
  background: rgba(0, 0, 0, 0.35);
  padding: 12px 14px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
  border: 1px solid rgba(0, 212, 255, 0.15);
}
:deep(.markdown-body pre code) {
  font-family: var(--font-mono);
  font-size: 13px;
}
:deep(.markdown-body blockquote) {
  border-left: 3px solid var(--color-primary);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--text-dim);
}
:deep(.markdown-body a) {
  color: var(--color-primary);
  text-decoration: underline;
}

.usage-info {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.message-actions {
  position: absolute;
  top: -12px;
  right: 8px;
  display: none;
  gap: 2px;
  background: var(--bg-card-solid);
  border: 1px solid var(--border-dark);
  border-radius: 6px;
  padding: 2px;
}

.message-bubble:hover .message-actions {
  display: flex;
}

.action-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

.action-btn:hover {
  background: rgba(0, 212, 255, 0.15);
  color: var(--color-primary);
}

.action-btn.danger:hover {
  background: rgba(255, 80, 80, 0.2);
  color: #ff6b6b;
}
</style>
