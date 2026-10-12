import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 数据目录管理 - 固定为 exe 同目录 <exe目录>/data/
 * 便携模式，复制目录即可迁移
 *
 * 关键：portable exe 模式下 app.getPath('exe') 返回的是临时解压目录，
 * 必须使用 electron-builder 设置的 PORTABLE_EXECUTABLE_DIR 环境变量
 * 来定位真正的 exe 所在目录。
 */
export class AppPaths {
  static getDataDir() {
    let baseDir: string;

    if (process.env.NODE_ENV === 'development') {
      // 开发模式：用项目根目录
      baseDir = path.resolve(process.cwd());
    } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
      // portable exe 模式：用 PORTABLE_EXECUTABLE_DIR（electron-builder 自动设置）
      baseDir = process.env.PORTABLE_EXECUTABLE_DIR;
    } else {
      // 安装版 / 普通 exe：用 exe 所在目录
      baseDir = path.dirname(app.getPath('exe'));
    }

    const root = path.join(baseDir, 'data');
    return {
      root,
      config: path.join(root, 'config.json'),
      models: path.join(root, 'models.json'),
      exports: path.join(root, 'exports'),
      logs: path.join(root, 'logs'),
      db: path.join(root, 'conversations.db'),
      cleanRules: path.join(root, 'clean-rules.json')
    };
  }

  static readJSON<T>(filePath: string, defaultValue: T): T {
    try {
      if (!fs.existsSync(filePath)) return defaultValue;
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return defaultValue;
    }
  }

  static writeJSON(filePath: string, data: any): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
