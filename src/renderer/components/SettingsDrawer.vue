<template>
  <div class="drawer-mask" @click.self="close">
    <div class="drawer">
      <!-- 头部 -->
      <div class="drawer-header">
        <h2>设置</h2>
        <button class="icon-btn close" @click="close">×</button>
      </div>

      <!-- Tab 切换 -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab', { active: appState.settingsTab === tab.key }]"
          @click="appState.settingsTab = tab.key as any"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 内容区 -->
      <div class="drawer-body">
        <!-- ===== 模型管理 ===== -->
        <div v-if="appState.settingsTab === 'models'">
          <div class="section-header">
            <span class="section-title">AI 模型配置</span>
            <button class="glow-btn" @click="openEditor(null)">+ 新增模型</button>
          </div>

          <div class="model-list">
            <div v-for="m in models" :key="m.id" class="model-card">
              <div class="model-info">
                <div class="model-name-row">
                  <span class="model-name">{{ m.name }}</span>
                  <span v-if="m.isDefault" class="default-tag">默认</span>
                </div>
                <div class="model-url truncate">{{ m.apiUrl }}</div>
                <div class="model-meta">
                  <span>model: {{ m.modelName }}</span>
                  <span>·</span>
                  <span>temp: {{ m.temperature }}</span>
                  <span>·</span>
                  <span>timeout: {{ m.timeout }}s</span>
                </div>
              </div>
              <div class="model-actions">
                <button class="mini-btn" title="测试连接" @click="testConn(m)">
                  🔗
                </button>
                <button class="mini-btn" title="设为默认" @click="setDefault(m)" :disabled="m.isDefault">
                  ⭐
                </button>
                <button class="mini-btn" title="编辑" @click="openEditor(m)">
                  ✏️
                </button>
                <button class="mini-btn danger" title="删除" @click="deleteModel(m)">
                  🗑️
                </button>
              </div>
            </div>

            <div v-if="models.length === 0" class="empty-hint">
              还没有模型配置，点击"新增模型"添加一个
            </div>
          </div>
        </div>

        <!-- ===== 关于 ===== -->
        <div v-else-if="appState.settingsTab === 'about'">
          <div class="about-section">
            <h3>OpenWebUI AI</h3>
            <p>内网大模型桌面客户端</p>
            <div class="about-grid">
              <div><strong>版本：</strong>1.0.0</div>
              <div><strong>接口：</strong>OpenAI Chat Completions 兼容</div>
              <div><strong>平台：</strong>Windows Server 2016 / Win10 / Win11</div>
              <div><strong>数据目录：</strong>exe 同目录 data/</div>
            </div>
            <h4>当前环境</h4>
            <div class="about-grid">
              <div><strong>Node：</strong>{{ nodeVersion }}</div>
              <div><strong>Electron：</strong>{{ electronVersion }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 模型编辑弹窗 -->
  <ModelEditor
    v-if="editing"
    :model="editing"
    @save="onModelSave"
    @close="editing = null"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { appState, models, loadModels, activeModel } from '../store/state';
import ModelEditor from './ModelEditor.vue';

const tabs = [
  { key: 'models', label: '🤖 AI 模型' },
  { key: 'about', label: 'ℹ️ 关于' }
];

const editing = ref<any>(null);
const nodeVersion = ref(process.versions?.node || '-');
const electronVersion = ref((process as any).versions?.electron || '-');

function close() {
  appState.showSettings = false;
}

function openEditor(m: any) {
  editing.value = m ? { ...m, apiKey: '' } : null;
  // 如果编辑，需要加载已解密的 apiKey
  if (m && m.apiKey?.startsWith('enc:')) {
    window.api.decryptKey(m.apiKey).then((key) => {
      if (editing.value) editing.value.apiKey = key;
    });
  }
}

async function onModelSave(model: any) {
  await window.api.saveModel(model);
  editing.value = null;
  await loadModels();
  // 如果保存的是当前激活的模型，更新 activeModel
  const saved = models.value.find((m: any) => m.id === model.id);
  if (saved && activeModel.value?.id === saved.id) {
    activeModel.value = saved;
  }
}

async function testConn(m: any) {
  let apiKey = m.apiKey;
  if (apiKey?.startsWith('enc:')) {
    apiKey = await window.api.decryptKey(apiKey);
  }
  const result = await window.api.testConnection({ ...m, apiKey });
  alert(result.ok
    ? `✅ 连接成功！延迟 ${result.latency}ms`
    : `❌ 连接失败：${result.message}`);
}

async function setDefault(m: any) {
  await window.api.setDefaultModel(m.id);
  await loadModels();
  // 更新 activeModel
  activeModel.value = models.value.find((x: any) => x.id === m.id) || null;
}

async function deleteModel(m: any) {
  if (!confirm(`确定删除模型「${m.name}」？`)) return;
  await window.api.deleteModel(m.id);
  await loadModels();
  if (activeModel.value?.id === m.id) {
    activeModel.value = models.value[0] || null;
  }
}

onMounted(async () => {
  await loadModels();
});
</script>

<style scoped>
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drawer {
  width: 520px;
  max-width: 90vw;
  height: 100%;
  background: linear-gradient(180deg, #0c1230 0%, #050a20 100%);
  border-left: 1px solid var(--border-dark);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.25s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  height: 56px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-dark);
  flex-shrink: 0;
}

.drawer-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.icon-btn.close {
  font-size: 20px;
  width: 32px;
  height: 32px;
}

.tabs {
  display: flex;
  padding: 10px 20px 0;
  gap: 4px;
  border-bottom: 1px solid var(--border-dark);
  flex-shrink: 0;
}

.tab {
  padding: 8px 16px;
  border-radius: 8px 8px 0 0;
  font-size: 13px;
  color: var(--text-dim);
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.tab:hover { color: var(--text-light); }

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-light);
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.model-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  background: rgba(15, 25, 55, 0.5);
  border: 1px solid var(--border-dark);
  border-radius: 10px;
  transition: all 0.15s;
}

.model-card:hover {
  border-color: rgba(0, 212, 255, 0.3);
  background: rgba(15, 25, 55, 0.75);
}

.model-info { flex: 1; min-width: 0; }

.model-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.model-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-light);
}

.default-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(0, 212, 255, 0.2);
  border: 1px solid rgba(0, 212, 255, 0.4);
  border-radius: 4px;
  color: var(--color-primary);
}

.model-url {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.model-meta {
  font-size: 11px;
  color: var(--text-dim);
  display: flex;
  gap: 6px;
}

.model-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mini-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-btn:hover:not(:disabled) {
  background: rgba(0, 212, 255, 0.15);
  color: var(--color-primary);
}

.mini-btn.danger:hover {
  background: rgba(255, 80, 80, 0.2);
  color: #ff6b6b;
}

.empty-hint {
  padding: 30px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.about-section {
  padding: 10px;
}

.about-section h3 {
  font-size: 18px;
  margin-bottom: 4px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.about-section > p {
  color: var(--text-dim);
  font-size: 13px;
  margin-bottom: 20px;
}

.about-section h4 {
  margin: 16px 0 8px;
  font-size: 13px;
  color: var(--text-light);
}

.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
  font-size: 12px;
  color: var(--text-dim);
}

.about-grid strong {
  color: var(--text-muted);
  font-weight: 500;
}
</style>
