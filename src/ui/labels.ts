import type { DisplayState } from '../types';

export const STATE_LABEL: Record<DisplayState, string> = {
  working: 'Aan het werk',
  waiting: 'Wacht op jou',
  done: 'Klaar',
  idle: 'Wacht op volgende run',
  error: 'Fout',
  paused: 'Gepauzeerd',
  planned: 'Vacature (nog niet gebouwd)',
};

export const ROLE_LABEL: Record<string, string> = {
  planning: 'Planning',
  ads: 'Advertenties',
  weer: 'Weer',
  content: 'Content',
  seo: 'SEO',
  reviews: 'Reviews',
  opvolging: 'Opvolging',
  briefing: 'Briefing',
  realtime: 'Realtime lead-flow',
  taken: 'Takenlijst',
};

export function runStatusLabel(s?: string): string {
  switch (s) {
    case 'succeeded':
      return 'gelukt';
    case 'failed':
      return 'mislukt';
    case 'running':
      return 'loopt nog';
    case 'cancelled':
      return 'afgebroken';
    default:
      return s ?? '';
  }
}

/** Kleine DOM-helper. Tekst gaat altijd via textContent (nooit innerHTML), dus data uit status.json kan geen HTML injecteren. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
