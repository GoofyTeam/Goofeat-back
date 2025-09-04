import { createHmac, randomBytes } from 'crypto';
import type { Request, Response } from 'express';

type StateParts = {
  nonce: string;
  ts: number;
  sig: string;
};

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(secret: string, data: string): string {
  return base64url(createHmac('sha256', secret).update(data).digest());
}

function parseCookie(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function appendSetCookie(res: Response, cookie: string) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', cookie);
  } else if (Array.isArray(prev)) {
    res.setHeader('Set-Cookie', [...prev, cookie]);
  } else {
    res.setHeader('Set-Cookie', [prev as string, cookie]);
  }
}

export class OAuthStateManager {
  constructor(
    private readonly secret: string,
    private readonly cookieName = 'gf_oauth_state',
    private readonly ttlMs = 10 * 60 * 1000, // 10 minutes
  ) {}

  mint(res: Response): string {
    const nonce = base64url(randomBytes(16));
    const ts = Date.now();
    const payload = `${nonce}.${ts}`;
    const sig = sign(this.secret, payload);
    const value = `${payload}.${sig}`;

    const isSecure = process.env.NODE_ENV === 'production';
    const maxAge = Math.floor(this.ttlMs / 1000);
    const cookie = `${this.cookieName}=${encodeURIComponent(
      value,
    )}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${isSecure ? '; Secure' : ''}`;
    appendSetCookie(res, cookie);

    return nonce; // return state value to send to provider
  }

  verifyAndClear(
    req: Request,
    res: Response | undefined,
    providedState?: string,
  ): boolean {
    try {
      if (!providedState) return false;
      const cookies = parseCookie(req.headers?.cookie);
      const raw = cookies[this.cookieName];
      if (!raw) return false;
      const value = decodeURIComponent(raw);
      const parts = value.split('.');
      if (parts.length !== 3) return false;
      const [nonce, tsStr, sig] = parts as [string, string, string];
      const ts = Number(tsStr);
      if (!nonce || !Number.isFinite(ts) || !sig) return false;
      const expected = sign(this.secret, `${nonce}.${ts}`);
      if (expected !== sig) return false;
      if (Date.now() - ts > this.ttlMs) return false;
      if (providedState !== nonce) return false;

      // Clear cookie
      if (res) {
        const isSecure = process.env.NODE_ENV === 'production';
        const del = `${this.cookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${isSecure ? '; Secure' : ''}`;
        appendSetCookie(res, del);
      }
      return true;
    } catch {
      return false;
    }
  }
}
