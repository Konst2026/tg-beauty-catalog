import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM  = 'aes-256-gcm';
const IV_LEN     = 16;
const TAG_LEN    = 16;

export class TokenCrypto {
  private readonly key: Buffer;

  constructor(keyHex: string) {
    this.key = Buffer.from(keyHex, 'hex');
    if (this.key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
    }
  }

  encrypt(plaintext: string): string {
    const iv  = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const buf  = Buffer.from(ciphertext, 'base64');
    const iv   = buf.subarray(0, IV_LEN);
    const tag  = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
  }
}
