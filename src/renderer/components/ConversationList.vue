<template>
  <aside class="sidebar">
    <!-- 新建对话 -->
    <button class="new-chat-btn" @click="createNewConversation">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>新建对话</span>
    </button>

    <!-- 搜索 -->
    <div class="search-box">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        v-model="keyword"
        type="text"
        placeholder="搜索会话..."
        @keyup.enter="doSearch"
        @input="onInput"
      />
      <button v-if="keyword" class="clear-btn" @click="clearSearch">×</button>
    </div>

    <!-- 会话列表 -->
    <div class="conv-list">
      <div
        v-for="conv in conversations"
        :key="conv.id"
        :class="['conv-item', { active: activeConversation?.id === conv.id, pinned: conv.pinned }]"
        @click="selectConversation(conv)"
      >
        <div class="conv-title truncate">{{ conv.pinned ? '📌 ' : '' }}{{ conv.title }}</div>
        <div class="conv-meta truncate">
          <span class="conv-model">{{ conv.modelName || '未选模型' }}</span>
          <span class="conv-time">{{ formatTime(conv.updated_at) }}</span>
        </div>

        <!-- 悬浮操作 -->
        <div class="conv-actions">
          <button class="mini-btn" title="重命名" @click.stop="renameConv(conv)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="mini-btn" :title="conv.pinned ? '取消置顶' : '置顶'" @click.stop="togglePin(conv)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 17v5M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V7a1 1 0 011-1 2 2 0 000-4H8a2 2 0 000 4 1 1 0 011 1z"/>
            </svg>
          </button>
          <button class="mini-btn danger" title="删除" @click.stop="deleteConv(conv)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="conversations.length === 0" class="empty-hint">
        还没有会话，点击上方"新建对话"开始
      </div>
    </div>

    <!-- 底部：清空/导出 -->
    <div class="sidebar-footer">
      <button class="mini-btn full-width" title="导出当前会话" :disabled="!activeConversation" @click="exportCurrent">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        <span>导出会话</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { conversations, activeConversation, convSearchKeyword, loadConversations, loadConversationMessages, appState } from '../store/state';

const keyword = ref('');

function onInput() {
  convSearchKeyword.value = keyword.value.trim();
  debounceSearch();
}

let searchTimer: any;
function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(doSearch, 300);
}

async function doSearch() {
  await loadConversations();
}

async function clearSearch() {
  keyword.value = '';
  convSearchKeyword.value = '';
  await loadConversations();
}

async function selectConversation(conv: any) {
  activeConversation.value = conv;
  await loadConversationMessages(conv.id);
}

async function createNewConversation() {
  const conv = await window.api.createConversation({
    title: '新对话',
    modelId: null,
    modelName: '',
    systemPrompt: '',
    temperature: 0.6,
    topP: 1.0,
    maxTokens: 4096
  });
  await loadConversations();
  activeConversation.value = conv;
  await loadConversationMessages(conv.id);
}

async function renameConv(conv: any) {
  const newTitle = prompt('重命名会话：', conv.title);
  if (newTitle && newTitle.trim()) {
    await window.api.updateConversation(conv.id, { title: newTitle.trim() });
    await loadConversations();
  }
}

async function togglePin(conv: any) {
  await window.api.pinConversation(conv.id, !conv.pinned);
  await loadConversations();
}

async function deleteConv(conv: any) {
  if (!confirm(`确定删除会话「${conv.title}」？此操作不可恢复。`)) return;
  await window.api.deleteConversation(conv.id);
  if (activeConversation.value?.id === conv.id) {
    activeConversation.value = null;
  }
  await loadConversations();
  // 自动选中第一个
  if (conversations.value.length > 0) {
    await selectConversation(conversations.value[0]);
  }
}

async function exportCurrent() {
  if (!activeConversation.value) return;
  const format = prompt('导出格式：json / md / txt', 'md');
  if (!['json', 'md', 'txt'].includes(format || '')) {
    alert('格式无效，请输入 json / md / txt');
    return;
  }
  const result = await window.api.exportConversation(activeConversation.value.id, format!);
  if (result.success) {
    alert(`导出成功：\n${result.filePath}`);
  } else {
    alert(`导出失败：${result.error}`);
  }
}

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

onMounted(async () => {
  // 自动选中第一个会话
  if (conversations.value.length > 0 && !activeConversation.value) {
    await selectConversation(conversations.value[0]);
  }
});
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-dark-2);
  border-right: 1px solid var(--border-dark);
  overflow: hidden;
}

.new-chat-btn {
  margin: 14px 14px 10px;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--color-primary-dim) 0%, var(--color-primary) 100%);
  color: #000;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(0, 212, 255, 0.25);
}

.new-chat-btn:hover {
  box-shadow: 0 6px 22px rgba(0, 212, 255, 0.4);
  transform: translateY(-1px);
}

.search-box {
  margin: 0 14px 10px;
  position: relative;
}

.search-box input {
  width: 100%;
  padding: 8px 28px 8px 30px;
  border-radius: 8px;
  border: 1px solid var(--border-dark);
  background: rgba(15, 25, 55, 0.6);
  color: var(--text-light);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.search-box input:focus {
  border-color: var(--color-primary);
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 16px;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.conv-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px;
}

.conv-item {
  position: relative;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.conv-item:hover {
  background: rgba(0, 212, 255, 0.08);
  border-color: rgba(0, 212, 255, 0.15);
}

.conv-item.active {
  background: rgba(0, 212, 255, 0.15);
  border-color: rgba(0, 212, 255, 0.3);
}

.conv-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 3px;
  color: var(--text-light);
}

.conv-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-dim);
}

.conv-model {
  max-width: 120px;
}

.conv-time {
  flex-shrink: 0;
}

.conv-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: none;
  gap: 2px;
}

.conv-item:hover .conv-actions {
  display: flex;
}

.mini-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 11px;
}

.mini-btn:hover {
  background: rgba(0, 212, 255, 0.15);
  color: var(--color-primary);
}

.mini-btn.danger:hover {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}

.mini-btn.full-width {
  width: auto;
  height: 30px;
  gap: 6px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 12px;
}

.empty-hint {
  padding: 30px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.sidebar-footer {
  padding: 10px 14px;
  border-top: 1px solid var(--border-dark);
}
</style>
