import type { EncryptedTodo } from '../types';

/** Ontsleutelt todoEnc uit status.json (zelfde formaat als scripts/encrypt-todo.mjs). */

const KEY = 'agentenkantoor-sleutel';
const cache = new Map<string, string[]>();

export function getPass(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function setPass(p: string | null): void {
  try {
    if (p) localStorage.setItem(KEY, p);
    else localStorage.removeItem(KEY);
  } catch {
    /* privévenster: dan alleen voor deze sessie */
  }
  cache.clear();
}

const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function cached(enc: EncryptedTodo): string[] | undefined {
  return cache.get(enc.ct);
}

/** Gooit een fout bij een onjuist wachtwoord. */
export async function decryptTodo(enc: EncryptedTodo, pass: string): Promise<string[]> {
  const hit = cache.get(enc.ct);
  if (hit) return hit;
  const te = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(enc.salt), iterations: enc.iter },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(enc.iv) }, key, unb64(enc.ct));
  const list = JSON.parse(new TextDecoder().decode(plain));
  const out = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').map((s) => s.slice(0, 140)).slice(0, 12) : [];
  cache.set(enc.ct, out);
  return out;
}
