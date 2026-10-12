import initSqlJs, { Database as SqliteDatabase, SqlJsStatic } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

export interface ModelConfig {
  id?: number;
  name: string;
  apiUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
  timeout: number;
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

// sql.js 把查询结果返回成 [{columns, values}]，
// 这里把它转成对象数组
function rowsToObjects<T = any>(result: { columns: string[]; values: any[][] } | undefined): T[] {
  if (!result) return [];
  const { columns, values } = result;
  return values.map((row) => {
    const obj: any = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i];
    }
    return obj;
  }) as T[];
}

export class ChatDatabase {
  private db!: SqliteDatabase;
  private dbPath: string;
  private SQL!: SqlJsStatic;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /** 异步初始化：加载 wasm + 读取/创建数据库文件 */
  async init(): Promise<void> {
    const wasmDir = path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist');
    this.SQL = await initSqlJs({
      locateFile: (file: string) => path.join(wasmDir, file),
    });

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    if (fs.existsSync(this.dbPath)) {
      const data = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(data);
    } else {
      this.db = new this.SQL.Database();
    }

    // 基础 pragma
    this.db.run('PRAGMA foreign_keys = ON');

    // 自动保存（每次写操作后调用 persist）
    this.migrate();
    this.persist();
  }

  /** 建表 */
  private migrate(): void {
    this.db.run(`
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
        updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
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
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
    `);
  }

  /** 把内存数据库落盘 */
  private persist(): void {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  close(): void {
    this.persist();
    this.db.close();
  }

  // ─── 底层查询封装 ────────────────────────────────────────────
  private all<T = any>(sql: string, params: any[] = []): T[] {
    const res = this.db.exec(sql, params);
    return rowsToObjects<T>(res[0]);
  }

  private get<T = any>(sql: string, params: any[] = []): T | undefined {
    const rows = this.all<T>(sql, params);
    return rows[0];
  }

  /** 执行 INSERT/UPDATE/DELETE，返回 lastInsertRowid */
  private run(sql: string, params: any[] = []): number {
    this.db.run(sql, params);
    const row = this.get<{ lastInsertRowid: number }>('SELECT last_insert_rowid() as lastInsertRowid');
    this.persist();
    return row?.lastInsertRowid ?? 0;
  }

  // ─── Models ─────────────────────────────────────────────────
  getModels(): ModelConfig[] {
    return this.all<ModelConfig>('SELECT * FROM models ORDER BY is_default DESC, id ASC');
  }

  saveModel(model: ModelConfig): ModelConfig {
    const now = Date.now();
    if (model.id) {
      this.run(
        `UPDATE models SET name=?, api_url=?, api_key=?, model_name=?,
          temperature=?, top_p=?, max_tokens=?, system_prompt=?, timeout=?, is_default=?
        WHERE id=?`,
        [
          model.name, model.apiUrl, model.apiKey, model.modelName,
          model.temperature, model.topP, model.maxTokens, model.systemPrompt,
          model.timeout, model.isDefault ? 1 : 0, model.id,
        ]
      );
      return model;
    } else {
      if (model.isDefault) {
        this.run('UPDATE models SET is_default=0');
      }
      const id = this.run(
        `INSERT INTO models (name, api_url, api_key, model_name, temperature, top_p, max_tokens, system_prompt, timeout, is_default, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          model.name, model.apiUrl, model.apiKey, model.modelName,
          model.temperature ?? 0.6, model.topP ?? 1.0, model.maxTokens ?? 4096,
          model.systemPrompt ?? '', model.timeout ?? 60,
          model.isDefault ? 1 : 0, now,
        ]
      );
      return { ...model, id, createdAt: now };
    }
  }

  deleteModel(id: number): void {
    this.run('DELETE FROM models WHERE id=?', [id]);
  }

  setDefaultModel(id: number): void {
    this.run('UPDATE models SET is_default=0');
    this.run('UPDATE models SET is_default=1 WHERE id=?', [id]);
  }

  // ─── Conversations ───────────────────────────────────────────
  getConversations(): Conversation[] {
    return this.all<Conversation>(`
      SELECT * FROM conversations ORDER BY
        CASE WHEN pinned=1 THEN 0 ELSE 1 END,
        updated_at DESC
    `);
  }

  getConversation(id: number): Conversation | undefined {
    return this.get<Conversation>('SELECT * FROM conversations WHERE id=?', [id]);
  }

  createConversation(conv: Conversation): Conversation {
    const now = Date.now();
    const id = this.run(
      `INSERT INTO conversations (title, model_id, model_name, system_prompt, temperature, top_p, max_tokens, pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        conv.title || '新对话', conv.modelId || null, conv.modelName || '',
        conv.systemPrompt || '', conv.temperature ?? 0.6, conv.topP ?? 1.0,
        conv.maxTokens ?? 4096, now, now,
      ]
    );
    return { ...conv, id, createdAt: now, updatedAt: now };
  }

  updateConversation(id: number, data: Partial<Conversation>): void {
    const fields: string[] = [];
    const values: any[] = [];
    const map: Record<string, string> = {
      title: 'title', modelId: 'model_id', modelName: 'model_name',
      systemPrompt: 'system_prompt', temperature: 'temperature',
      topP: 'top_p', maxTokens: 'max_tokens', pinned: 'pinned',
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
    this.run(`UPDATE conversations SET ${fields.join(',')} WHERE id=?`, values);
  }

  deleteConversation(id: number): void {
    this.run('DELETE FROM conversations WHERE id=?', [id]);
  }

  togglePinConversation(id: number, pinned: boolean): void {
    this.run('UPDATE conversations SET pinned=?, updated_at=? WHERE id=?', [pinned ? 1 : 0, Date.now(), id]);
  }

  searchConversations(keyword: string): Conversation[] {
    const like = `%${keyword}%`;
    return this.all<Conversation>(`
      SELECT DISTINCT c.* FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.title LIKE ? OR m.content LIKE ?
      ORDER BY CASE WHEN c.pinned=1 THEN 0 ELSE 1 END, c.updated_at DESC
    `, [like, like]);
  }

  clearConversationMessages(id: number): void {
    this.run('DELETE FROM messages WHERE conversation_id=?', [id]);
    this.run('UPDATE conversations SET updated_at=? WHERE id=?', [Date.now(), id]);
  }

  // ─── Messages ───────────────────────────────────────────────
  getMessages(convId: number): Message[] {
    return this.all<Message>(
      'SELECT * FROM messages WHERE conversation_id=? ORDER BY id ASC',
      [convId]
    );
  }

  addMessage(msg: Message): Message {
    const now = Date.now();
    const id = this.run(
      `INSERT INTO messages (conversation_id, role, content, model_name, usage_prompt, usage_completion, usage_total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msg.conversationId, msg.role, msg.content, msg.modelName || null,
        msg.usagePrompt ?? null, msg.usageCompletion ?? null, msg.usageTotal ?? null, now,
      ]
    );
    this.run('UPDATE conversations SET updated_at=? WHERE id=?', [now, msg.conversationId]);
    return { ...msg, id, createdAt: now };
  }

  deleteMessage(msgId: number): void {
    this.run('DELETE FROM messages WHERE id=?', [msgId]);
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
