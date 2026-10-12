<template>
  <div :class="['app-container', { 'app-light': appState.theme === 'light' }]">
    <!-- 3D 粒子背景层 -->
    <ParticleBackground v-if="appState.sciFi3D && appState.theme === 'dark'" />

    <!-- 顶部栏 -->
    <TopBar />

    <!-- 主体区 -->
    <div class="main-layout">
      <!-- 左侧会话列表 -->
      <ConversationList />

      <!-- 右侧聊天区 -->
      <div class="chat-wrapper">
        <ChatArea />
        <InputArea />
      </div>
    </div>

    <!-- 设置面板（抽屉） -->
    <SettingsDrawer v-if="appState.showSettings" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { appState, loadModels, loadConversations } from './store/state';
import TopBar from './components/TopBar.vue';
import ConversationList from './components/ConversationList.vue';
import ChatArea from './components/ChatArea.vue';
import InputArea from './components/InputArea.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import ParticleBackground from './components/ParticleBackground.vue';

function applyTheme() {
  document.body.classList.remove('theme-dark', 'theme-light');
  document.body.classList.add(`theme-${appState.theme}`);
}

onMounted(async () => {
  applyTheme();
  await Promise.all([loadModels(), loadConversations()]);

  // 默认创建一个会话
  const convs = (await window.api.listConversations()) as any[];
  if (convs.length === 0) {
    await window.api.createConversation({
      title: '新对话',
      modelId: null,
      modelName: appState.activeModel?.modelName || '',
      systemPrompt: '',
      temperature: appState.activeModel?.temperature ?? 0.6,
      topP: appState.activeModel?.topP ?? 1.0,
      maxTokens: appState.activeModel?.maxTokens ?? 4096
    });
    await loadConversations();
  }
});

onUnmounted(() => {
  // cleanup
});
</script>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.main-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.chat-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
