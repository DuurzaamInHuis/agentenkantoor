import { TIMEZONE } from './config';

/**
 * Centrale klok. Met ?tijd=21:30 in de URL kun je een ander tijdstip (Europe/Madrid)
 * simuleren, handig om dag/nacht of de postbode te bekijken. De klok blijft doorlopen.
 */
let offsetMs = 0;

export function initClock(params: URLSearchParams): void {
  const t = params.get('tijd');
  const m = t?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return;
  const target = Number(m[1]) * 60 + Number(m[2]);
  const p = madridParts(Date.now());
  const current = p.hour * 60 + p.minute + p.second / 60;
  offsetMs = (target - current) * 60_000;
}

export const now = (): number => Date.now() + offsetMs;
export const isClockShifted = (): boolean => offsetMs !== 0;

export interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function madridParts(ms: number): Parts {
  const o: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') o[p.type] = Number(p.value);
  }
  return { year: o.year, month: o.month, day: o.day, hour: o.hour % 24, minute: o.minute, second: o.second };
}

/** Seconden sinds middernacht in Madrid. */
export function madridSecondsOfDay(ms: number): number {
  const p = madridParts(ms);
  return p.hour * 3600 + p.minute * 60 + p.second;
}

const hmFmt = new Intl.DateTimeFormat('nl-NL', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dateFmt = new Intl.DateTimeFormat('nl-NL', { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' });
const shortDateFmt = new Intl.DateTimeFormat('nl-NL', { timeZone: TIMEZONE, weekday: 'short', day: 'numeric', month: 'short' });

export const formatClock = (ms: number): string => hmFmt.format(ms);
export const formatDate = (ms: number): string => dateFmt.format(ms);

function dayIndex(ms: number): number {
  const p = madridParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;
}

export function parseTime(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** "vandaag 06:46", "gisteren 20:00", "morgen 06:45" of "ma 23 nov 06:45". */
export function formatRunTime(iso?: string): string {
  const ms = parseTime(iso);
  if (ms === null) return '—';
  const diff = dayIndex(ms) - dayIndex(now());
  const hm = formatClock(ms);
  if (diff === 0) return `vandaag ${hm}`;
  if (diff === -1) return `gisteren ${hm}`;
  if (diff === 1) return `morgen ${hm}`;
  return `${shortDateFmt.format(ms)} ${hm}`;
}

export function formatAgo(ms: number): string {
  const s = Math.round((now() - ms) / 1000);
  if (s < 60) return 'zojuist';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min geleden`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} uur geleden`;
  return `${Math.floor(h / 24)} dagen geleden`;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "over 2 u 14 min", "over 4 min 05 s", "nu" of "achterstallig (12 min)". */
export function formatCountdown(iso?: string): string {
  const ms = parseTime(iso);
  if (ms === null) return '';
  const diff = ms - now();
  if (diff < -60_000) return `achterstallig (${formatDuration(-diff)})`;
  if (diff < 1000) return 'nu';
  const total = Math.floor(diff / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `over ${d} d ${h} u`;
  if (h > 0) return `over ${h} u ${m} min`;
  if (m > 0) return `over ${m} min ${pad(s)} s`;
  return `over ${s} s`;
}

function formatDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} u`;
  return `${Math.floor(h / 24)} d`;
}

const DAYS = 'maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag';

/** Maakt van het schema in de config een zin in gewone taal: "Dagelijks 06:45" → "elke dag om 06:45". */
export function humanSchedule(raw: string): string {
  const s = raw.trim();
  if (!s) return 'geen vast schema';
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^dagelijks\s+(\d{1,2}[:.]\d{2})(.*)$/i))) return `elke dag om ${m[1].replace('.', ':')}${m[2]}`;
  if (/^dagelijks$/i.test(s)) return 'elke dag';
  if (/^wekelijks$/i.test(s)) return 'elke week';
  if ((m = s.match(new RegExp(`^(${DAYS})\\s+(\\d{1,2}[:.]\\d{2})$`, 'i')))) return `elke ${m[1].toLowerCase()} om ${m[2].replace('.', ':')}`;
  if ((m = s.match(new RegExp(`^(${DAYS})$`, 'i')))) return `elke ${m[1].toLowerCase()}`;
  if ((m = s.match(/^elk uur,?\s*(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/i))) return `elk uur tussen ${m[1]} en ${m[2]}`;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
