<template>
  <div class="chat-area" ref="chatContainer">
    <!-- 空状态 -->
    <div v-if="!activeConversation" class="empty-state">
      <div class="empty-icon">🤖</div>
      <div class="empty-title">欢迎使用 OpenWebUI AI</div>
      <div class="empty-desc">请在左侧新建或选择一个对话开始</div>
    </div>

    <template v-else>
      <!-- 消息列表 -->
      <div class="messages-list" ref="messagesList">
        <!-- 系统提示（如果有） -->
        <div v-if="activeConversation?.systemPrompt" class="system-bubble">
          <div class="sys-label">📋 系统提示词</div>
          <div class="sys-content">{{ activeConversation.systemPrompt }}</div>
        </div>

        <MessageBubble
          v-for="msg in conversationMessages"
          :key="msg.id"
          :message="msg"
          @regenerate="regenerateMessage"
          @delete="deleteMessage"
        />

        <!-- Loading -->
        <div v-if="isSending" class="loading-container">
          <div class="message-bubble assistant loading-bubble">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <span class="loading-text">AI 思考中...</span>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="sendingError" class="error-bubble">
          <span class="error-icon">⚠️</span>
          <span>{{ sendingError }}</span>
          <button class="retry-btn" @click="retrySend">重试</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { activeConversation, conversationMessages, isSending, sendingError } from '../store/state';
import MessageBubble from './MessageBubble.vue';

const chatContainer = ref<HTMLElement | null>(null);
const messagesList = ref<HTMLElement | null>(null);

// 自动滚动到底部
watch(
  () => [conversationMessages.value.length, isSending.value],
  async () => {
    await nextTick();
    scrollToBottom();
  },
  { deep: true }
);

function scrollToBottom() {
  if (messagesList.value) {
    messagesList.value.scrollTop = messagesList.value.scrollHeight;
  }
}

// 暴露给父组件
defineExpose({ scrollToBottom });

async function regenerateMessage(msg: any) {
  // 实际逻辑在 InputArea 中处理
  sendingError.value = null;
}

async function deleteMessage(msg: any) {
  if (!confirm('删除这条消息？')) return;
  await window.api.deleteMessage(msg.id);
  // 重新加载
  if (activeConversation.value) {
    conversationMessages.value = await window.api.listMessages(activeConversation.value.id);
  }
}

function retrySend() {
  sendingError.value = null;
  // 触发 InputArea 的 retry 逻辑
  window.dispatchEvent(new CustomEvent('retry-chat'));
}
</script>

<style scoped>
.chat-area {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-dim);
}

.empty-icon {
  font-size: 56px;
  filter: drop-shadow(0 0 20px rgba(0, 212, 255, 0.4));
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-light);
}

.empty-desc {
  font-size: 14px;
  opacity: 0.7;
}

.system-bubble {
  background: rgba(255, 215, 0, 0.08);
  border: 1px solid rgba(255, 215, 0, 0.25);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
}

.sys-label {
  font-weight: 600;
  color: #ffd666;
  margin-bottom: 4px;
}

.sys-content {
  color: var(--text-dim);
  white-space: pre-wrap;
}

.loading-bubble {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
}

.loading-text {
  margin-left: 4px;
  color: var(--text-dim);
  font-size: 13px;
}

.error-bubble {
  background: rgba(255, 80, 80, 0.12);
  border: 1px solid rgba(255, 80, 80, 0.3);
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #ff9999;
}

.error-icon {
  font-size: 16px;
}

.retry-btn {
  margin-left: auto;
  padding: 4px 10px;
  background: rgba(255, 80, 80, 0.2);
  border: 1px solid rgba(255, 80, 80, 0.4);
  border-radius: 5px;
  color: #ffcccc;
  font-size: 12px;
}

.retry-btn:hover {
  background: rgba(255, 80, 80, 0.35);
}
</style>
