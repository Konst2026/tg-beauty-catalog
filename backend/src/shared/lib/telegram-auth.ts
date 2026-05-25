import { createHmac, timingSafeEqual } from 'crypto';

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export function verifyInitData(initDataRaw: string, botToken: string): TgUser | null {
  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected  = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // Constant-time comparison — prevents timing-attack enumeration of HMAC bytes
    const expectedBuf = Buffer.from(expected, 'hex');
    const hashBuf     = Buffer.from(hash,     'hex');
    if (expectedBuf.length !== hashBuf.length || !timingSafeEqual(expectedBuf, hashBuf)) {
      return null;
    }

    const userStr = params.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr) as TgUser;
  } catch {
    return null;
  }
}
