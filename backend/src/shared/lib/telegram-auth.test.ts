import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifyInitData } from './telegram-auth';

const BOT_TOKEN = 'test_bot_token_123';
const MOCK_USER = { id: 123456789, first_name: 'Ivan', username: 'ivan_test' };

function makeValidInitData(token: string, user: object): string {
  const params = new URLSearchParams();
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('verifyInitData', () => {
  it('returns user for valid initData', () => {
    const initData = makeValidInitData(BOT_TOKEN, MOCK_USER);
    const result = verifyInitData(initData, BOT_TOKEN);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(MOCK_USER.id);
    expect(result?.first_name).toBe(MOCK_USER.first_name);
  });

  it('returns null when hash is missing', () => {
    const params = new URLSearchParams();
    params.set('user', JSON.stringify(MOCK_USER));
    params.set('auth_date', '1234567890');
    expect(verifyInitData(params.toString(), BOT_TOKEN)).toBeNull();
  });

  it('returns null when hash is tampered', () => {
    const initData = makeValidInitData(BOT_TOKEN, MOCK_USER);
    const tampered = initData.replace(/hash=[a-f0-9]+/, 'hash=deadbeef00000000');
    expect(verifyInitData(tampered, BOT_TOKEN)).toBeNull();
  });

  it('returns null when wrong bot token is used', () => {
    const initData = makeValidInitData(BOT_TOKEN, MOCK_USER);
    expect(verifyInitData(initData, 'wrong_token')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(verifyInitData('', BOT_TOKEN)).toBeNull();
  });

  it('returns null when user field is missing', () => {
    const params = new URLSearchParams();
    params.set('auth_date', String(Math.floor(Date.now() / 1000)));
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    params.set('hash', hash);
    expect(verifyInitData(params.toString(), BOT_TOKEN)).toBeNull();
  });
});
