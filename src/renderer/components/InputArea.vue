<template>
  <div class="input-area">
    <!-- 附件区 -->
    <div v-if="attachmentContent" class="attachment-preview">
      <div class="attachment-info">
        <span class="attach-icon">📎</span>
        <span class="attach-name">{{ attachmentName }}</span>
        <span v-if="attachmentTruncated" class="attach-hint">(已截断)</span>
      </div>
      <button class="remove-attach" @click="clearAttachment">×</button>
    </div>

    <div class="input-row">
      <!-- 左：附件按钮 -->
      <button class="icon-btn" title="添加附件（提取文本后发送）" @click="pickAttachment">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>

      <!-- 模型切换 -->
      <div class="model-select" @click="appState.showSettings = true; appState.settingsTab = 'models'" title="点击切换模型">
        <span class="dot" />
        <span>{{ activeModel?.modelName || '未选择模型' }}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      <!-- 输入框 -->
      <textarea
        id="chat-input"
        ref="inputRef"
        v-model="inputText"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行..."
        rows="2"
        @keydown="onKeydown"
        :disabled="isSending"
      />

      <!-- 右：发送按钮 -->
      <button
        class="send-btn"
        :class="{ sending: isSending }"
        :disabled="isSending || !canSend"
        @click="sendMessage"
      >
        <template v-if="isSending">
          <svg width="18" height="18" viewBox="0 0 24 24" class="spin">
            <circle cx="12" cy="12" r="10" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
          </svg>
        </template>
        <template v-else>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </template>
      </button>
    </div>

    <!-- 底部提示栏 -->
    <div class="input-hint">
      <span>Enter 发送 · Shift+Enter 换行</span>
      <span class="usage-hint" v-if="lastUsage">
        · tokens: {{ lastUsage.prompt }}↑ / {{ lastUsage.completion }}↓
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  appState, activeModel, activeConversation, conversationMessages,
  isSending, sendingError, lastUsage, loadConversations, loadConversationMessages
} from '../store/state';

const inputRef = ref<HTMLTextAreaElement | null>(null);
const inputText = ref('');
const attachmentContent = ref('');
const attachmentName = ref('');
const attachmentTruncated = ref(false);

const canSend = computed(() => inputText.value.trim().length > 0 || attachmentContent.value.length > 0);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  if (isSending.value || !activeConversation.value) return;
  if (!activeModel.value) {
    alert('请先在设置中配置一个 AI 模型');
    appState.showSettings = true;
    appState.settingsTab = 'models';
    return;
  }

  const userInput = inputText.value.trim();
  const attachText = attachmentContent.value;
  let fullContent = userInput;
  if (attachText) {
    fullContent = `${userInput}\n\n[附件文本]\n${attachmentName.value}:\n${attachText}`.trim();
  }
  if (!fullContent) return;

  // 清空输入
  inputText.value = '';
  clearAttachment();
  sendingError.value = null;

  isSending.value = true;
  try {
    // 1. 保存用户消息到数据库
    await window.api.addMessage({
      conversationId: activeConversation.value.id,
      role: 'user',
      content: fullContent
    });

    // 2. 获取完整历史，构造 API messages
    const history = await window.api.listMessages(activeConversation.value.id);
    const apiMessages = history.map((m: any) => ({
      role: m.role,
      content: m.content
    }));

    // 3. 刷新消息列表（让用户消息显示在界面）
    conversationMessages.value = [...history];

    // 4. 发送 AI 请求
    const result = await window.api.sendChat({
      model: activeModel.value,
      messages: apiMessages,
      options: {}
    });

    // 5. 保存 AI 回复
    await window.api.addMessage({
      conversationId: activeConversation.value.id,
      role: 'assistant',
      content: result.content,
      modelName: activeModel.value.modelName,
      usagePrompt: result.promptTokens,
      usageCompletion: result.completionTokens,
      usageTotal: result.totalTokens
    });

    // 6. 更新会话元数据
    await window.api.updateConversation(activeConversation.value.id, {
      modelName: activeModel.value.modelName,
      temperature: activeModel.value.temperature,
      topP: activeModel.value.topP,
      maxTokens: activeModel.value.maxTokens,
      systemPrompt: activeModel.value.systemPrompt
    });

    // 7. 更新 usage 显示
    if (result.promptTokens !== undefined) {
      lastUsage.value = {
        prompt: result.promptTokens,
        completion: result.completionTokens || 0,
        total: result.totalTokens || 0
      };
    }

    // 8. 刷新消息列表 + 会话列表
    conversationMessages.value = await window.api.listMessages(activeConversation.value.id);
    await loadConversations();
  } catch (err: any) {
    sendingError.value = err?.message || String(err);
  } finally {
    isSending.value = false;
  }
}

// 附件
async function pickAttachment() {
  const filePath = await window.api.openFileDialog();
  if (!filePath) return;

  const result = await window.api.extractAttachment(filePath);
  if (!result.success) {
    alert(result.error);
    return;
  }

  attachmentContent.value = result.content;
  attachmentName.value = result.filename || filePath;
  attachmentTruncated.value = !!result.truncated;
}

function clearAttachment() {
  attachmentContent.value = '';
  attachmentName.value = '';
  attachmentTruncated.value = false;
}

// retry 事件监听
function handleRetry() {
  if (activeConversation.value && conversationMessages.value.length > 0) {
    // 找到最后一条用户消息并重新发送
    const lastUserIdx = [...conversationMessages.value].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx !== -1) {
      // 简单处理：复制最后一条 user content 到输入框
      const lastUserMsg = conversationMessages.value[conversationMessages.value.length - 1 - lastUserIdx];
      inputText.value = lastUserMsg.content;
      sendingError.value = null;
      setTimeout(() => sendMessage(), 50);
    }
  }
}

onMounted(() => {
  window.addEventListener('retry-chat', handleRetry);
  setTimeout(() => inputRef.value?.focus(), 100);
});

onBeforeUnmount(() => {
  window.removeEventListener('retry-chat', handleRetry);
});
</script>

<style scoped>
.input-area {
  flex-shrink: 0;
  border-top: 1px solid var(--border-dark);
  background: rgba(8, 12, 30, 0.92);
  padding: 12px 16px 8px;
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attachment-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.25);
  border-radius: 6px;
  font-size: 12px;
}

.attachment-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.attach-icon { font-size: 14px; }
.attach-name { color: var(--color-primary); font-weight: 500; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attach-hint { color: #ffd666; font-size: 11px; }

.remove-attach {
  color: var(--text-dim);
  font-size: 16px;
  width: 20px;
  height: 20px;
  line-height: 18px;
  border-radius: 4px;
}

.remove-attach:hover {
  background: rgba(255, 80, 80, 0.2);
  color: #ff6b6b;
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.model-select {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(0, 212, 255, 0.08);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.model-select:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 6px var(--color-glow);
}

textarea#chat-input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-dark);
  background: rgba(15, 25, 55, 0.6);
  color: var(--text-light);
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  min-height: 44px;
  max-height: 160px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

textarea#chat-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.15);
}

textarea#chat-input:disabled {
  opacity: 0.7;
}

.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-dim) 0%, var(--color-primary) 100%);
  color: #000;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  box-shadow: 0 0 16px var(--color-glow);
  transform: scale(1.05);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn.sending {
  background: linear-gradient(135deg, #4a5a8a 0%, #6a7aaa 100%);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}

.input-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  padding: 2px 4px;
}

.usage-hint {
  color: var(--text-dim);
}
</style>
