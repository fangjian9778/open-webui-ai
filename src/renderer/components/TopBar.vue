<template>
  <div class="topbar">
    <!-- 左：Logo + 标题 -->
    <div class="topbar-left">
      <div class="logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="title">OpenWebUI AI</span>
    </div>

    <!-- 中：当前模型 -->
    <div class="topbar-center" v-if="activeModel">
      <span class="current-model">{{ activeModel.modelName }}</span>
      <span class="model-hint">· {{ activeModel.apiUrl }}</span>
    </div>

    <!-- 右：操作 -->
    <div class="topbar-right">
      <!-- 主题切换 -->
      <div class="icon-btn" :title="appState.theme === 'dark' ? '切换到亮色' : '切换到暗色'" @click="toggleTheme">
        <svg v-if="appState.theme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      </div>

      <!-- 科幻 3D 开关 -->
      <div class="icon-btn" :title="appState.sciFi3D ? '关闭 3D 效果（低性能模式）' : '开启 3D 效果'" @click="appState.sciFi3D = !appState.sciFi3D">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
          <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>
        </svg>
      </div>

      <!-- 设置按钮 -->
      <div class="icon-btn" title="设置" @click="appState.showSettings = true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { appState, activeModel } from '../store/state';

function toggleTheme() {
  appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
  document.body.classList.remove('theme-dark', 'theme-light');
  document.body.classList.add(`theme-${appState.theme}`);
}
</script>

<style scoped>
.topbar {
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-dark);
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 10;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  color: var(--color-primary);
  display: flex;
  align-items: center;
  filter: drop-shadow(0 0 6px var(--color-glow));
}

.title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 14px;
  background: rgba(0, 212, 255, 0.08);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 20px;
  font-size: 13px;
}

.current-model {
  color: var(--color-primary);
  font-weight: 500;
}

.model-hint {
  color: var(--text-dim);
  font-size: 12px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
