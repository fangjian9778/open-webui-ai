import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

// 动态 require（better-sqlite3 里用了 require）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx');

export interface ExtractResult {
  success: boolean;
  content?: string;
  error?: string;
  filename?: string;
  size?: number;
  format?: string;
  truncated?: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// 支持的文件扩展名
const SUPPORTED_TEXT_EXTS = new Set([
  '.txt', '.yml', '.yaml', '.sql', '.log', '.sh', '.htm', '.html', '.csv'
]);
const SUPPORTED_EXCEL_EXTS = new Set(['.xls', '.xlsx']);
const UNSUPPORTED_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
  '.pdf', '.docx', '.doc', '.pptx', '.ppt',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.mp3', '.mp4', '.avi', '.mov'
]);

// 单文件大小限制（5MB）
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// 提取内容最大长度限制（超过截断）
const MAX_CONTENT_LENGTH = 50000;

/**
 * 附件文本提取服务
 * 接口不支持多模态，采用本地文本提取后拼接到 prompt
 */
export class AttachmentService {
  /**
   * 提取附件内容
   */
  static extract(filePath: string): ExtractResult {
    const filename = path.basename(filePath);
    const ext = path.extname(filename).toLowerCase();

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }

    const stat = fs.statSync(filePath);
    // 图片格式明确提示不支持
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
      return {
        success: false,
        error: `不支持图片格式 ${ext}，当前接口仅支持文字，请提供 .txt/.yml/.sql/.html/.xlsx 等文本格式`,
        filename
      };
    }

    // 其他不支持的格式
    if (UNSUPPORTED_EXTS.has(ext) && !SUPPORTED_EXCEL_EXTS.has(ext)) {
      return {
        success: false,
        error: `不支持的文件格式 ${ext}，支持的格式：txt、yml、yaml、sql、log、sh、html、csv、xls、xlsx`,
        filename
      };
    }

    // 检查大小
    if (stat.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），超过限制 ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        filename, size: stat.size
      };
    }

    let content = '';
    try {
      if (SUPPORTED_TEXT_EXTS.has(ext)) {
        content = this.extractText(filePath, ext);
      } else if (SUPPORTED_EXCEL_EXTS.has(ext)) {
        content = this.extractExcel(filePath);
      } else {
        // 未知文本格式，尝试按文本读取
        content = this.extractText(filePath, ext);
      }
    } catch (err: any) {
      return { success: false, error: `提取失败：${err?.message || err}`, filename };
    }

    if (!content.trim()) {
      return { success: false, error: '文件内容为空或无法提取', filename };
    }

    // 转换为单行
    const normalized = normalizeToSingleLine(content);

    // 检查长度并截断
    let truncated = false;
    let finalContent = normalized;
    if (normalized.length > MAX_CONTENT_LENGTH) {
      finalContent = normalized.slice(0, MAX_CONTENT_LENGTH);
      truncated = true;
    }

    return {
      success: true,
      content: finalContent,
      filename,
      size: stat.size,
      format: ext,
      truncated
    };
  }

  /**
   * 导出会话
   */
  static exportConversation(conv: any, messages: any[], format: string, outDir: string): ExportResult {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTitle = (conv?.title || 'conversation').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);

    let content = '';
    let ext = format;

    if (format === 'json') {
      content = JSON.stringify({ conversation: conv, messages }, null, 2);
      ext = 'json';
    } else if (format === 'md' || format === 'markdown') {
      content = this.toMarkdown(conv, messages);
      ext = 'md';
    } else {
      content = this.toPlainText(conv, messages);
      ext = 'txt';
    }

    const filePath = path.join(outDir, `${safeTitle}_${ts}.${ext}`);
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  private static extractText(filePath: string, ext: string): string {
    const buffer = fs.readFileSync(filePath);

    // 编码识别
    let encoding = 'utf-8';
    // 简单 BOM 检测
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) encoding = 'utf-16le';
    else if (buffer[0] === 0xFE && buffer[1] === 0xFF) encoding = 'utf-16be';
    else if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) encoding = 'utf-8';

    let text: string;
    try {
      text = iconv.decode(buffer, encoding);
    } catch {
      text = buffer.toString('utf-8');
    }

    // 如果是 HTML/HTM，去除标签
    if (ext === '.html' || ext === '.htm') {
      try {
        const $ = cheerio.load(text);
        // 去掉 script/style 标签
        $('script, style').remove();
        text = $.text();
      } catch {
        // cheerio 失败，简单正则去标签
        text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&[a-z]+;/gi, ' ');
      }
    }

    return text;
  }

  private static extractExcel(filePath: string): string {
    const workbook = XLSX.readFile(filePath);
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) {
        parts.push(`【Sheet: ${sheetName}】\n${csv}`);
      }
    }
    return parts.join('\n\n');
  }

  private static toMarkdown(conv: any, messages: any[]): string {
    const lines: string[] = [];
    lines.push(`# ${conv?.title || '未命名会话'}`);
    lines.push('');
    if (conv?.modelName) lines.push(`**模型**: ${conv.modelName}`);
    lines.push(`**时间**: ${new Date(conv?.createdAt || Date.now()).toLocaleString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const msg of messages) {
      const roleLabel = msg.role === 'user' ? '**用户**' : msg.role === 'assistant' ? '**AI**' : '**系统**';
      lines.push(`${roleLabel}  \n${msg.content}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  private static toPlainText(conv: any, messages: any[]): string {
    const lines: string[] = [];
    lines.push(`=== ${conv?.title || '未命名会话'} ===`);
    lines.push(`模型: ${conv?.modelName || ''}`);
    lines.push(`时间: ${new Date(conv?.createdAt || Date.now()).toLocaleString()}`);
    lines.push('');

    for (const msg of messages) {
      const roleLabel = msg.role === 'user' ? '【用户】' : msg.role === 'assistant' ? '【AI】' : '【系统】';
      lines.push(`${roleLabel}`);
      lines.push(msg.content);
      lines.push('');
    }
    return lines.join('\n');
  }
}

/**
 * 提取内容转换为单行
 */
export function normalizeToSingleLine(text: string): string {
  return text
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
