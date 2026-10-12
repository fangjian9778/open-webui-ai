<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>{{ isEdit ? '编辑模型' : '新增模型' }}</h3>
        <button class="icon-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <!-- 基础信息 -->
        <div class="form-row">
          <label>名称 *</label>
          <input v-model="form.name" placeholder="如：内网 DeepSeek" />
        </div>

        <div class="form-row">
          <label>API 地址 *</label>
          <input v-model="form.apiUrl" placeholder="http://host:port/v1/chat/completions" />
        </div>

        <div class="form-row">
          <label>API Token</label>
          <input v-model="form.apiKey" type="password" placeholder="Bearer Token（长期有效）" show-password />
        </div>

        <div class="form-row">
          <label>模型名 *</label>
          <input v-model="form.modelName" placeholder="如：deepseek-v3.1" />
        </div>

        <!-- 参数 -->
        <div class="param-grid">
          <div class="form-row compact">
            <label>temperature</label>
            <input v-model.number="form.temperature" type="number" step="0.1" min="0" max="2" />
          </div>
          <div class="form-row compact">
            <label>top_p</label>
            <input v-model.number="form.topP" type="number" step="0.05" min="0" max="1" />
          </div>
          <div class="form-row compact">
            <label>max_tokens</label>
            <input v-model.number="form.maxTokens" type="number" step="100" min="1" />
          </div>
          <div class="form-row compact">
            <label>超时(秒)</label>
            <input v-model.number="form.timeout" type="number" step="5" min="5" max="300" />
          </div>
        </div>

        <!-- 系统提示词 -->
        <div class="form-row">
          <label>系统提示词</label>
          <textarea v-model="form.systemPrompt" rows="3" placeholder="可选，作为 system 角色注入每次请求"></textarea>
        </div>

        <!-- 默认 -->
        <div class="form-row checkbox">
          <label>
            <input type="checkbox" v-model="form.isDefault" />
            设为默认模型
          </label>
        </div>

        <!-- 流式说明 -->
        <div class="info-note">
          ℹ️ 接口固定 <code>stream: false</code>，不支持流式输出
        </div>
      </div>

      <div class="modal-footer">
        <button class="glow-btn secondary" @click="$emit('close')">取消</button>
        <button class="glow-btn" @click="save" :disabled="!canSave">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';

const props = defineProps<{
  model: any | null;
}>();

const emit = defineEmits(['save', 'close']);

const isEdit = computed(() => !!props.model?.id);

const form = reactive({
  id: props.model?.id || undefined,
  name: props.model?.name || '',
  apiUrl: props.model?.apiUrl || '',
  apiKey: props.model?.apiKey || '',
  modelName: props.model?.modelName || '',
  temperature: props.model?.temperature ?? 0.6,
  topP: props.model?.topP ?? 1.0,
  maxTokens: props.model?.maxTokens ?? 4096,
  systemPrompt: props.model?.systemPrompt || '',
  timeout: props.model?.timeout ?? 60,
  isDefault: props.model?.isDefault ?? false
});

const canSave = computed(() =>
  form.name.trim() &&
  form.apiUrl.trim() &&
  form.modelName.trim()
);

function save() {
  if (!canSave.value) return;
  emit('save', {
    ...form,
    apiKey: form.apiKey?.trim() || ''
  });
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.modal {
  width: 520px;
  max-height: 88vh;
  background: linear-gradient(180deg, #0c1230 0%, #050a20 100%);
  border: 1px solid var(--border-dark);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 212, 255, 0.2);
}

.modal-header {
  height: 48px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-dark);
  flex-shrink: 0;
}

.modal-header h3 { font-size: 15px; font-weight: 600; }

.modal-body {
  padding: 18px;
  overflow-y: auto;
  flex: 1;
}

.form-row {
  margin-bottom: 12px;
}

.form-row > label {
  display: block;
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.form-row.compact { margin-bottom: 0; }
.form-row.checkbox > label { display: flex; align-items: center; gap: 8px; cursor: pointer; }

.form-row input[type="text"],
.form-row input[type="password"],
.form-row input[type="number"],
.form-row textarea {
  width: 100%;
  padding: 8px 12px;
  background: rgba(15, 25, 55, 0.6);
  border: 1px solid var(--border-dark);
  border-radius: 6px;
  color: var(--text-light);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-row textarea { resize: vertical; min-height: 60px; }

.form-row input:focus,
.form-row textarea:focus {
  border-color: var(--color-primary);
}

.form-row input[type="number"] {
  font-family: var(--font-mono);
}

.form-row.compact input {
  padding: 6px 10px;
}

.form-row.checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.info-note {
  font-size: 11px;
  padding: 8px 12px;
  background: rgba(0, 212, 255, 0.06);
  border: 1px dashed rgba(0, 212, 255, 0.2);
  border-radius: 6px;
  color: var(--text-dim);
  margin-top: 8px;
}

.info-note code {
  font-family: var(--font-mono);
  color: var(--color-primary);
  font-size: 11px;
}

.modal-footer {
  height: 54px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid var(--border-dark);
  flex-shrink: 0;
}
</style>
