import * as fs from 'fs';
import { AppPaths } from '../utils/paths';

/**
 * 输出清洗规则
 * 默认去除: ??、**（Markdown 加粗标记）
 * 可通过 rules.json 配置扩展
 */

export interface CleanRule {
  id: string;
  pattern: string;
  replacement: string;
  enabled: boolean;
  description?: string;
}

let cleanRules: CleanRule[] = getDefaultRules();

function getDefaultRules(): CleanRule[] {
  return [
    { id: 'qmark', pattern: '??', replacement: '', enabled: true, description: '去除 ?? 问号标记' },
    { id: 'bold', pattern: '\\*\\*(.*?)\\*\\*', replacement: '$1', enabled: true, description: '去除 Markdown 加粗 **' },
    { id: 'newline-crlf', pattern: '\\r\\n', replacement: '\n', enabled: true, description: 'CRLF 转 LF' },
    { id: 'paragraph-space', pattern: '\\n\\n', replacement: '\n\n', enabled: true, description: '保留段落换行（不做额外处理）' },
    { id: 'list-item', pattern: '\\n- ', replacement: '\n', enabled: true, description: '列表项 - 去掉行首标记' }
  ];
}

export function loadCleanRules(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      const custom = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(custom) && custom.length > 0) {
        // 合并自定义规则和默认规则，自定义优先
        const defaults = getDefaultRules();
        const merged: CleanRule[] = defaults.map((d) => {
          const found = custom.find((c: CleanRule) => c.id === d.id);
          return found ? { ...d, ...found } : d;
        });
        // 添加自定义规则中存在但默认中没有的
        for (const c of custom) {
          if (!merged.find((m) => m.id === c.id)) merged.push(c);
        }
        cleanRules = merged;
        return;
      }
    }
    cleanRules = getDefaultRules();
    // 写入默认配置文件
    AppPaths.writeJSON(filePath, cleanRules);
  } catch {
    cleanRules = getDefaultRules();
  }
}

export function getCleanRules(): CleanRule[] {
  return cleanRules;
}

export function setCleanRules(rules: CleanRule[]): void {
  cleanRules = rules;
}

/**
 * 清洗输出内容
 */
export function cleanOutput(content: string): string {
  if (!content) return '';

  let result = content;
  for (const rule of cleanRules) {
    if (!rule.enabled) continue;
    try {
      const regex = new RegExp(rule.pattern, 'g');
      result = result.replace(regex, rule.replacement);
    } catch {
      // 正则无效则跳过
    }
  }

  return result;
}
