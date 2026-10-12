import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppPaths } from './utils/paths';
import { ChatDatabase } from './db/database';
import { ApiService } from './services/api';
import { AttachmentService } from './services/attachment';
import { cleanOutput, loadCleanRules } from './services/cleaner';
import { encrypt, decrypt } from './utils/crypto';

// ─── 全局引用 ───────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let db: ChatDatabase | null = null;
let apiService: ApiService | null = null;

// ─── 数据目录初始化 ──────────────────────────────────────────
function initDataDir(): void {
  const paths = AppPaths.getDataDir();
  [paths.root, paths.exports, paths.logs].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// ─── 创建主窗口 ─────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'OpenWebUI AI',
    backgroundColor: '#0a0a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // 外部链接在默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── 初始化服务 ──────────────────────────────────────────────
async function initServices(): Promise<void> {
  const paths = AppPaths.getDataDir();
  db = new ChatDatabase(path.join(paths.root, 'conversations.db'));
  await db.init(); // sql.js 异步加载 wasm
  apiService = new ApiService();
  loadCleanRules(path.join(paths.root, 'clean-rules.json'));
}

// ─── App 生命周期 ────────────────────────────────────────────
app.whenReady().then(async () => {
  initDataDir();
  await initServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  db?.close();
});

// ─── IPC Handlers ────────────────────────────────────────────

// --- 应用路径 ---
ipcMain.handle('app:getPaths', () => AppPaths.getDataDir());

// --- 模型配置 ---
ipcMain.handle('models:list', () => db!.getModels());
ipcMain.handle('models:save', (_e, model) => {
  // Token 加密存储
  if (model.apiKey) model.apiKey = encrypt(model.apiKey);
  return db!.saveModel(model);
});
ipcMain.handle('models:delete', (_e, id) => db!.deleteModel(id));
ipcMain.handle('models:setDefault', (_e, id) => db!.setDefaultModel(id));
ipcMain.handle('models:decryptKey', (_e, encrypted) => decrypt(encrypted));
ipcMain.handle('models:testConnection', async (_e, model) => {
  const apiKey = model.apiKey.startsWith('enc:') ? decrypt(model.apiKey) : model.apiKey;
  return apiService!.testConnection({ ...model, apiKey });
});

// --- 会话管理 ---
ipcMain.handle('conversations:list', () => db!.getConversations());
ipcMain.handle('conversations:get', (_e, id) => db!.getConversation(id));
ipcMain.handle('conversations:create', (_e, conv) => db!.createConversation(conv));
ipcMain.handle('conversations:update', (_e, id, data) => db!.updateConversation(id, data));
ipcMain.handle('conversations:delete', (_e, id) => db!.deleteConversation(id));
ipcMain.handle('conversations:pin', (_e, id, pinned) => db!.togglePinConversation(id, pinned));
ipcMain.handle('conversations:search', (_e, keyword) => db!.searchConversations(keyword));
ipcMain.handle('conversations:clearMessages', (_e, id) => db!.clearConversationMessages(id));
ipcMain.handle('conversations:export', async (_e, id, format) => {
  const conv = db!.getConversation(id);
  const messages = db!.getMessages(id);
  return AttachmentService.exportConversation(conv, messages, format, AppPaths.getDataDir().exports);
});

// --- 消息管理 ---
ipcMain.handle('messages:list', (_e, convId) => db!.getMessages(convId));
ipcMain.handle('messages:add', (_e, msg) => db!.addMessage(msg));
ipcMain.handle('messages:delete', (_e, msgId) => db!.deleteMessage(msgId));

// --- AI 对话 ---
ipcMain.handle('chat:send', async (_e, { model, messages, options }) => {
  if (!apiService) throw new Error('API service not initialized');
  const apiKey = model.apiKey.startsWith('enc:') ? decrypt(model.apiKey) : model.apiKey;
  const result = await apiService.chat({
    ...model,
    apiKey,
    messages,
    ...options
  });
  // 输出清洗
  if (result.content) {
    result.content = cleanOutput(result.content);
  }
  return result;
});

// --- 附件处理 ---
ipcMain.handle('attachment:extract', async (_e, filePath) => {
  return AttachmentService.extract(filePath);
});
ipcMain.handle('dialog:openFile', async (_e, filters) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [
      { name: '支持的文本格式', extensions: ['txt', 'yml', 'yaml', 'sql', 'log', 'sh', 'html', 'htm', 'csv', 'xls', 'xlsx'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});
