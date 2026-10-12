import * as crypto from 'crypto';

/**
 * Token 本地加密
 * 使用固定密钥 + AES-256-GCM，Token 长期有效无需刷新
 * 注意：这是本地加密，主要是防止明文泄露，非强安全场景
 */
const ENC_PREFIX = 'enc:';
const SECRET_KEY = Buffer.from(
  (process.env.APP_SECRET_KEY || 'OpenWebUI-AI-Local-Secret-2026-Fixed-Key'),
  'utf-8'
);

export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  // 已加密则直接返回
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return ENC_PREFIX + iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex');
  } catch (e) {
    // 加密失败降级为 base64
    return ENC_PREFIX + Buffer.from(plaintext, 'utf-8').toString('base64');
  }
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext;
  const raw = ciphertext.slice(ENC_PREFIX.length);
  try {
    if (raw.includes('=')) {
      // base64 降级格式
      return Buffer.from(raw, 'base64').toString('utf-8');
    }
    // hex 格式：iv(32) + authTag(32) + data
    const iv = Buffer.from(raw.slice(0, 32), 'hex');
    const authTag = Buffer.from(raw.slice(32, 64), 'hex');
    const data = Buffer.from(raw.slice(64), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final()
    ]);
    return decrypted.toString('utf-8');
  } catch {
    return ciphertext; // 解密失败返回原值
  }
}
