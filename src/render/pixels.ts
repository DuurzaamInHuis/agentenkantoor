/** Kleine helpers voor pixel-art: sprites uit tekst-arrays, kleuren mengen, seeded random. */

export type Pal = Record<string, string>;

/** Bouwt een sprite uit rijen tekens; elk teken verwijst naar een kleur in het palet ('.' = transparant). */
export function spriteFromRows(rows: string[], pal: Pal): HTMLCanvasElement {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (row[x] === '.' || !col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

export function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** amt > 0 lichter, amt < 0 donkerder. */
export const shade = (hex: string, amt: number): string => (amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt));

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministische random (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export const PIXEL_FONT = 'Silkscreen, monospace';

/** Zet tekst zo groot mogelijk binnen maxW (8px of 6px), anders afgekapt met een puntje. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, sizes = [8, 6]): { text: string; size: number } {
  for (const size of sizes) {
    ctx.font = `${size}px ${PIXEL_FONT}`;
    if (ctx.measureText(text).width <= maxW) return { text, size };
  }
  const size = sizes[sizes.length - 1];
  ctx.font = `${size}px ${PIXEL_FONT}`;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '.').width > maxW) t = t.slice(0, -1);
  return { text: t + '.', size };
}
