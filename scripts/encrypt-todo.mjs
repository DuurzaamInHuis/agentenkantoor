#!/usr/bin/env node
/**
 * Versleutelt een lijst takenregels (met namen) voor status.json.
 *
 * Gebruik:  node scripts/encrypt-todo.mjs <invoer.json>
 *   invoer.json: een JSON-array met strings, bijvoorbeeld ["Jan – spouwmuurisolatie: bellen (vandaag)"].
 *   Uitvoer (stdout): JSON-object voor het veld "todoEnc".
 *
 * Het wachtwoord staat in ~/.agentenkantoor/sleutel.txt (nooit in de repo).
 * Versleuteling: AES-GCM 256, sleutel via PBKDF2-SHA256 (200.000 rondes), elke keer nieuwe salt en iv.
 * De app ontsleutelt hetzelfde formaat met WebCrypto (src/data/crypto.ts).
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const ITER = 200_000;
const input = process.argv[2];
if (!input) {
  console.error('Gebruik: node scripts/encrypt-todo.mjs <invoer.json>');
  process.exit(1);
}
const lines = JSON.parse(readFileSync(input, 'utf8'));
if (!Array.isArray(lines) || !lines.every((l) => typeof l === 'string')) {
  console.error('Invoer moet een JSON-array met strings zijn.');
  process.exit(1);
}
// AGENTENKANTOOR_SLEUTEL_BESTAND: alleen voor testen met een ander wachtwoordbestand.
const keyFile = process.env.AGENTENKANTOOR_SLEUTEL_BESTAND || join(homedir(), '.agentenkantoor', 'sleutel.txt');
const pass = readFileSync(keyFile, 'utf8').trim();
if (!pass) {
  console.error('Leeg wachtwoord in ~/.agentenkantoor/sleutel.txt');
  process.exit(1);
}

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(lines))));
const b64 = (u) => Buffer.from(u).toString('base64');
process.stdout.write(JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }) + '\n');
