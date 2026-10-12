/// <reference types="vite/client" />

interface Window {
  api: {
    getPaths: () => Promise<any>;
    // 模型
    listModels: () => Promise<any[]>;
    saveModel: (model: any) => Promise<any>;
    deleteModel: (id: number) => Promise<void>;
    setDefaultModel: (id: number) => Promise<void>;
    decryptKey: (encrypted: string) => Promise<string>;
    testConnection: (model: any) => Promise<{ ok: boolean; message: string; latency?: number }>;
    // 会话
    listConversations: () => Promise<any[]>;
    getConversation: (id: number) => Promise<any>;
    createConversation: (conv: any) => Promise<any>;
    updateConversation: (id: number, data: any) => Promise<void>;
    deleteConversation: (id: number) => Promise<void>;
    pinConversation: (id: number, pinned: boolean) => Promise<void>;
    searchConversations: (keyword: string) => Promise<any[]>;
    clearMessages: (id: number) => Promise<void>;
    exportConversation: (id: number, format: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    // 消息
    listMessages: (convId: number) => Promise<any[]>;
    addMessage: (msg: any) => Promise<any>;
    deleteMessage: (msgId: number) => Promise<void>;
    // AI 对话
    sendChat: (payload: any) => Promise<any>;
    // 附件
    extractAttachment: (filePath: string) => Promise<any>;
    openFileDialog: (filters?: any) => Promise<string | null>;
  };
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
