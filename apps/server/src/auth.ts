import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PASSWORD_KEY_BYTES = 64;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString('hex'),
): {
  salt: string;
  hash: string;
} {
  return {
    salt,
    hash: scryptSync(password, salt, PASSWORD_KEY_BYTES).toString('hex'),
  };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = scryptSync(password, salt, PASSWORD_KEY_BYTES);
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=') || null;
  }
  return null;
}
