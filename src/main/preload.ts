import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // 应用
  getPaths: () => ipcRenderer.invoke('app:getPaths'),

  // 模型配置
  listModels: () => ipcRenderer.invoke('models:list'),
  saveModel: (model: any) => ipcRenderer.invoke('models:save', model),
  deleteModel: (id: number) => ipcRenderer.invoke('models:delete', id),
  setDefaultModel: (id: number) => ipcRenderer.invoke('models:setDefault', id),
  decryptKey: (encrypted: string) => ipcRenderer.invoke('models:decryptKey', encrypted),
  testConnection: (model: any) => ipcRenderer.invoke('models:testConnection', model),

  // 会话
  listConversations: () => ipcRenderer.invoke('conversations:list'),
  getConversation: (id: number) => ipcRenderer.invoke('conversations:get', id),
  createConversation: (conv: any) => ipcRenderer.invoke('conversations:create', conv),
  updateConversation: (id: number, data: any) => ipcRenderer.invoke('conversations:update', id, data),
  deleteConversation: (id: number) => ipcRenderer.invoke('conversations:delete', id),
  pinConversation: (id: number, pinned: boolean) => ipcRenderer.invoke('conversations:pin', id, pinned),
  searchConversations: (keyword: string) => ipcRenderer.invoke('conversations:search', keyword),
  clearMessages: (id: number) => ipcRenderer.invoke('conversations:clearMessages', id),
  exportConversation: (id: number, format: string) =>
    ipcRenderer.invoke('conversations:export', id, format),

  // 消息
  listMessages: (convId: number) => ipcRenderer.invoke('messages:list', convId),
  addMessage: (msg: any) => ipcRenderer.invoke('messages:add', msg),
  deleteMessage: (msgId: number) => ipcRenderer.invoke('messages:delete', msgId),

  // AI 对话
  sendChat: (payload: any) => ipcRenderer.invoke('chat:send', payload),

  // 附件
  extractAttachment: (filePath: string) => ipcRenderer.invoke('attachment:extract', filePath),
  openFileDialog: (filters?: any) => ipcRenderer.invoke('dialog:openFile', filters)
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
