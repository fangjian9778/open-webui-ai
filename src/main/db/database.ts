import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export interface ModelConfig {
  id?: number;
  name: string;
  apiUrl: string;
  apiKey: string; // 加密存储
  modelName: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
  timeout: number; // 秒
  isDefault: boolean;
  createdAt?: number;
}

export interface Conversation {
  id?: number;
  title: string;
  modelId: number | null;
  modelName: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  pinned?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface Message {
  id?: number;
  conversationId: number;
  role: 'system' | 'user' | 'assistant';
  content: string;
  modelName?: string;
  usagePrompt?: number;
  usageCompletion?: number;
  usageTotal?: number;
  createdAt?: number;
}

export class ChatDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    // 确保目录存在
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model_name TEXT NOT NULL,
        temperature REAL DEFAULT 0.6,
        top_p REAL DEFAULT 1.0,
        max_tokens INTEGER DEFAULT 4096,
        system_prompt TEXT DEFAULT '',
        timeout INTEGER DEFAULT 60,
        is_default INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        model_id INTEGER,
        model_name TEXT,
        system_prompt TEXT DEFAULT '',
        temperature REAL DEFAULT 0.6,
        top_p REAL DEFAULT 1.0,
        max_tokens INTEGER DEFAULT 4096,
        pinned INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('system','user','assistant')),
        content TEXT NOT NULL,
        model_name TEXT,
        usage_prompt INTEGER,
        usage_completion INTEGER,
        usage_total INTEGER,
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
    `);
  }

  close(): void {
    this.db.close();
  }

  // ─── Models ─────────────────────────────────────────────────
  getModels(): ModelConfig[] {
    return this.db.prepare('SELECT * FROM models ORDER BY is_default DESC, id ASC').all() as ModelConfig[];
  }

  saveModel(model: ModelConfig): ModelConfig {
    const now = Date.now();
    if (model.id) {
      this.db.prepare(`
        UPDATE models SET name=?, api_url=?, api_key=?, model_name=?,
          temperature=?, top_p=?, max_tokens=?, system_prompt=?, timeout=?, is_default=?
        WHERE id=?
      `).run(
        model.name, model.apiUrl, model.apiKey, model.modelName,
        model.temperature, model.topP, model.maxTokens, model.systemPrompt,
        model.timeout, model.isDefault ? 1 : 0, model.id
      );
      return model;
    } else {
      if (model.isDefault) {
        this.db.prepare('UPDATE models SET is_default=0').run();
      }
      const result = this.db.prepare(`
        INSERT INTO models (name, api_url, api_key, model_name, temperature, top_p, max_tokens, system_prompt, timeout, is_default, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        model.name, model.apiUrl, model.apiKey, model.modelName,
        model.temperature ?? 0.6, model.topP ?? 1.0, model.maxTokens ?? 4096,
        model.systemPrompt ?? '', model.timeout ?? 60,
        model.isDefault ? 1 : 0, now
      );
      return { ...model, id: result.lastInsertRowid as number, createdAt: now };
    }
  }

  deleteModel(id: number): void {
    this.db.prepare('DELETE FROM models WHERE id=?').run(id);
  }

  setDefaultModel(id: number): void {
    this.db.prepare('UPDATE models SET is_default=0').run();
    this.db.prepare('UPDATE models SET is_default=1 WHERE id=?').run(id);
  }

  // ─── Conversations ───────────────────────────────────────────
  getConversations(): Conversation[] {
    return this.db.prepare(`
      SELECT * FROM conversations ORDER BY
        CASE WHEN pinned=1 THEN 0 ELSE 1 END,
        updated_at DESC
    `).all() as Conversation[];
  }

  getConversation(id: number): Conversation | undefined {
    return this.db.prepare('SELECT * FROM conversations WHERE id=?').get(id) as Conversation | undefined;
  }

  createConversation(conv: Conversation): Conversation {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO conversations (title, model_id, model_name, system_prompt, temperature, top_p, max_tokens, pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      conv.title || '新对话', conv.modelId || null, conv.modelName || '',
      conv.systemPrompt || '', conv.temperature ?? 0.6, conv.topP ?? 1.0,
      conv.maxTokens ?? 4096, now, now
    );
    return { ...conv, id: result.lastInsertRowid as number, createdAt: now, updatedAt: now };
  }

  updateConversation(id: number, data: Partial<Conversation>): void {
    const fields: string[] = [];
    const values: any[] = [];
    const map: Record<string, string> = {
      title: 'title', modelId: 'model_id', modelName: 'model_name',
      systemPrompt: 'system_prompt', temperature: 'temperature',
      topP: 'top_p', maxTokens: 'max_tokens', pinned: 'pinned'
    };
    for (const [k, v] of Object.entries(data)) {
      const col = map[k];
      if (col && v !== undefined) {
        fields.push(`${col}=?`);
        values.push(k === 'pinned' ? (v ? 1 : 0) : v);
      }
    }
    if (fields.length === 0) return;
    fields.push('updated_at=?');
    values.push(Date.now());
    values.push(id);
    this.db.prepare(`UPDATE conversations SET ${fields.join(',')} WHERE id=?`).run(...values);
  }

  deleteConversation(id: number): void {
    this.db.prepare('DELETE FROM conversations WHERE id=?').run(id);
  }

  togglePinConversation(id: number, pinned: boolean): void {
    this.db.prepare('UPDATE conversations SET pinned=?, updated_at=? WHERE id=?')
      .run(pinned ? 1 : 0, Date.now(), id);
  }

  searchConversations(keyword: string): Conversation[] {
    const like = `%${keyword}%`;
    return this.db.prepare(`
      SELECT DISTINCT c.* FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.title LIKE ? OR m.content LIKE ?
      ORDER BY CASE WHEN c.pinned=1 THEN 0 ELSE 1 END, c.updated_at DESC
    `).all(like, like) as Conversation[];
  }

  clearConversationMessages(id: number): void {
    this.db.prepare('DELETE FROM messages WHERE conversation_id=?').run(id);
    this.db.prepare('UPDATE conversations SET updated_at=? WHERE id=?')
      .run(Date.now(), id);
  }

  // ─── Messages ───────────────────────────────────────────────
  getMessages(convId: number): Message[] {
    return this.db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY id ASC')
      .all(convId) as Message[];
  }

  addMessage(msg: Message): Message {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO messages (conversation_id, role, content, model_name, usage_prompt, usage_completion, usage_total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.conversationId, msg.role, msg.content, msg.modelName || null,
      msg.usagePrompt ?? null, msg.usageCompletion ?? null, msg.usageTotal ?? null, now
    );
    this.db.prepare('UPDATE conversations SET updated_at=? WHERE id=?')
      .run(now, msg.conversationId);
    return { ...msg, id: result.lastInsertRowid as number, createdAt: now };
  }

  deleteMessage(msgId: number): void {
    this.db.prepare('DELETE FROM messages WHERE id=?').run(msgId);
  }

  getMessagesForAPI(convId: number, systemPrompt?: string): any[] {
    const msgs = this.getMessages(convId);
    const apiMsgs: any[] = [];
    if (systemPrompt) {
      apiMsgs.push({ role: 'system', content: systemPrompt });
    }
    for (const m of msgs) {
      apiMsgs.push({ role: m.role, content: m.content });
    }
    return apiMsgs;
  }
}
