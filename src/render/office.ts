import type { AgentConfig, DisplayState, OfficeConfig } from '../types';
import { CELL_H, CELL_W, type CorridorLayout, type DeskSlot, type OfficeLayout, type RoomLayout } from './layout';
import type { Sky } from './lighting';
import { fitText, hash, luminance, mix, PIXEL_FONT, rect, rng, shade } from './pixels';
import { plant, roleIcon } from './sprites';

const WOOD_DARK = '#5b4636';
const WALL = '#eadbc0';

/* =====================================================================
 * Statische achtergrond (wordt gecachet en ongeveer elke minuut opnieuw
 * getekend, omdat de lucht in de ramen meebeweegt met de tijd).
 * ===================================================================== */

export function drawBackground(ctx: CanvasRenderingContext2D, L: OfficeLayout, sky: Sky): void {
  rect(ctx, 0, 0, L.w, L.h, '#3b2f2a');
  for (const room of L.rooms) drawRoom(ctx, room, sky);
  drawCorridor(ctx, L.corridor, L);
}

function drawRoom(ctx: CanvasRenderingContext2D, R: RoomLayout, sky: Sky): void {
  const { x, y, w, h } = R;
  const c = R.dept.colors;
  const rand = rng(hash(R.dept.id));

  // Houten vloer met planken.
  for (let py = y + 36, i = 0; py < y + h - 4; py += 6, i++) {
    rect(ctx, x, py, w, 6, i % 2 ? '#c99a63' : '#c4925a');
    rect(ctx, x, py + 5, w, 1, '#b07c48');
    for (let px = x + (i % 2 ? 0 : 16) + 4; px < x + w; px += 32) rect(ctx, px, py, 1, 5, '#b07c48');
  }

  // Vloerkleed in de afdelingskleur onder de bureaus.
  const rugX = R.gridX - 3;
  const rugY = R.gridY - 3;
  const rugW = R.cols * CELL_W + 6;
  const rugH = R.rows * CELL_H + 2;
  rect(ctx, rugX, rugY, rugW, rugH, c.accent);
  rect(ctx, rugX + 2, rugY + 2, rugW - 4, rugH - 4, mix(c.main, '#efe4d2', 0.78));
  rect(ctx, rugX + 4, rugY + 4, rugW - 8, rugH - 8, mix(c.main, '#efe4d2', 0.72));
  for (let py = rugY + 8; py < rugY + rugH - 6; py += 8)
    for (let px = rugX + 8 + ((py / 8) % 2) * 4; px < rugX + rugW - 6; px += 8) rect(ctx, px, py, 1, 1, mix(c.main, '#efe4d2', 0.5));

  // Muur bovenin met behangstreepjes, accentlijn en plint.
  rect(ctx, x, y, w, 36, WALL);
  for (let px = x + 4; px < x + w; px += 8) rect(ctx, px, y + 3, 1, 22, '#e1cfb0');
  rect(ctx, x, y + 25, w, 2, c.accent);
  if (c.accent2) rect(ctx, x, y + 27, w, 1, c.accent2);
  rect(ctx, x, y + 32, w, 4, shade(c.main, -0.25));
  rect(ctx, x, y + 32, w, 1, shade(c.main, 0.1));
  rect(ctx, x, y, w, 3, WOOD_DARK);

  // Ramen (links en rechts; extra ramen in brede kamers).
  const windows = [x + 10, x + w - 36];
  if (w >= 200) windows.splice(1, 0, x + 40, x + w - 66);
  windows.forEach((wx, i) => drawWindow(ctx, wx, y + 7, 26, 18, sky, c.accent, hash(R.dept.id) + i));

  // Whiteboard met grafiekje in de afdelingskleuren.
  drawWhiteboard(ctx, x + Math.round(w / 2) - 20, y + 13, 40, 18, c.main, c.accent, c.accent2 ?? c.main, rand);

  // Zijmuren en onderwand met deur.
  rect(ctx, x, y, 3, h, WOOD_DARK);
  rect(ctx, x + w - 3, y, 3, h, WOOD_DARK);
  rect(ctx, x + 3, y + 36, 1, h - 40, '#a57b52');
  const dw = 20;
  const dx = R.door.x - dw / 2;
  rect(ctx, x, y + h - 4, dx - x, 4, WOOD_DARK);
  rect(ctx, dx + dw, y + h - 4, x + w - dx - dw, 4, WOOD_DARK);
  rect(ctx, dx, y + h - 4, dw, 4, '#8a6a4a');
  rect(ctx, dx + 1, y + h - 9, dw - 2, 5, shade(c.main, 0.25)); // deurmat

  // Strook onderin: plant, koffieautomaat, kleine plant bij de deur.
  ctx.drawImage(plant(), R.plant.x, R.plant.y);
  drawCoffeeMachine(ctx, R.coffee.x, R.coffee.y, c.accent);
  drawWaterCooler(ctx, R.coffee.x - 22, R.coffee.y + 2);
  drawSmallPlant(ctx, R.door.x + 14, R.gridBottom + 22);

  for (const desk of R.desks) drawDeskStatic(ctx, desk);
  // Lege plekken in het raster krijgen een bijzettafeltje met boeken, zodat de kamer gevuld oogt.
  const filled = new Set(R.desks.map((d) => `${d.col},${d.row}`));
  for (let row = 0; row < R.rows; row++)
    for (let col = 0; col < R.cols; col++)
      if (!filled.has(`${col},${row}`)) drawEmptyCell(ctx, R.gridX + col * CELL_W, R.gridY + row * CELL_H, rand);
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sky: Sky, curtain: string, seed: number): void {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, '#7a5536');
  for (let i = 0; i < h; i++) rect(ctx, x, y + i, w, 1, mix(sky.top, sky.bottom, i / (h - 1)));
  const r = rng(seed);
  if (sky.stars) {
    for (let i = 0; i < 4; i++) rect(ctx, x + 1 + Math.floor(r() * (w - 2)), y + 1 + Math.floor(r() * (h - 4)), 1, 1, '#fff7d6');
    if (seed % 3 === 0) {
      rect(ctx, x + w - 9, y + 3, 4, 4, '#f4f0d0');
      rect(ctx, x + w - 8, y + 3, 1, 1, sky.top);
    }
  } else if (sky.sun > 0.6) {
    // Wolkje.
    const cx = x + 3 + Math.floor(r() * (w - 14));
    rect(ctx, cx, y + 5, 9, 2, '#ffffff');
    rect(ctx, cx + 2, y + 4, 4, 1, '#ffffff');
  }
  rect(ctx, x + Math.floor(w / 2), y, 1, h, '#7a5536');
  rect(ctx, x, y + Math.floor(h / 2), w, 1, '#7a5536');
  rect(ctx, x - 3, y - 2, 3, h + 3, curtain);
  rect(ctx, x + w, y - 2, 3, h + 3, curtain);
  rect(ctx, x - 3, y - 2, 3, 1, shade(curtain, 0.3));
  rect(ctx, x + w, y - 2, 3, 1, shade(curtain, 0.3));
  rect(ctx, x - 2, y + h + 1, w + 4, 2, '#9b7048');
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: string, b: string, c: string, r: () => number): void {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, '#8e959c');
  rect(ctx, x, y, w, h, '#f7f7f2');
  const bars = [a, b, c, a];
  bars.forEach((col, i) => {
    const bh = 3 + Math.floor(r() * 9);
    rect(ctx, x + 4 + i * 5, y + h - 3 - bh, 3, bh, col);
  });
  rect(ctx, x + 3, y + h - 3, 22, 1, '#555');
  for (let i = 0; i < 3; i++) rect(ctx, x + 27, y + 4 + i * 4, 6 + Math.floor(r() * 5), 1, '#6b7280');
  rect(ctx, x + 2, y + h + 1, w - 4, 1, '#9aa0a6');
  rect(ctx, x + 6, y + h, 3, 1, '#d9534f');
  rect(ctx, x + 10, y + h, 3, 1, '#3a6ea5');
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, x: number, y: number, accent: string): void {
  rect(ctx, x + 1, y + 20, 13, 2, 'rgba(0,0,0,0.2)');
  rect(ctx, x, y, 12, 20, '#4a4a52');
  rect(ctx, x, y, 12, 3, '#5d5d66');
  rect(ctx, x + 2, y + 4, 8, 4, '#24242a');
  rect(ctx, x + 3, y + 5, 1, 1, '#ff5a4d');
  rect(ctx, x + 5, y + 5, 1, 1, '#59d66b');
  rect(ctx, x + 3, y + 7, 5, 1, '#7fd1ff');
  rect(ctx, x, y + 9, 12, 1, accent);
  rect(ctx, x + 3, y + 11, 6, 6, '#1d1d22');
  rect(ctx, x + 5, y + 14, 2, 2, '#f6f3ec');
  rect(ctx, x + 2, y + 17, 8, 2, '#7c7c84');
}

function drawWaterCooler(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x + 1, y + 18, 9, 2, 'rgba(0,0,0,0.2)');
  rect(ctx, x + 2, y, 6, 7, '#9fd3ef');
  rect(ctx, x + 3, y + 1, 1, 4, '#d8f0fb');
  rect(ctx, x + 1, y + 7, 8, 11, '#e8e8e8');
  rect(ctx, x + 2, y + 9, 2, 1, '#4a90d9');
  rect(ctx, x + 6, y + 9, 2, 1, '#d9534f');
}

function drawSmallPlant(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x + 1, y + 6, 6, 5, '#c2683a');
  rect(ctx, x + 1, y + 6, 6, 1, '#a5532c');
  rect(ctx, x + 2, y + 1, 4, 5, '#4f9e43');
  rect(ctx, x, y + 3, 3, 2, '#6cbf4f');
  rect(ctx, x + 5, y + 2, 3, 2, '#6cbf4f');
  rect(ctx, x + 3, y, 2, 2, '#6cbf4f');
}

/** Lege plek in het raster: afwisselend een loungehoekje, een kast, een printer of een bijzettafel. */
function drawEmptyCell(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: () => number): void {
  const kind = Math.floor(r() * 5);
  if (kind === 0) {
    // Loungebank met salontafeltje.
    const x = cx + 12;
    const y = cy + 14;
    rect(ctx, x + 1, y + 16, 40, 2, 'rgba(0,0,0,0.15)');
    rect(ctx, x, y, 40, 6, '#6b8f71');
    rect(ctx, x, y + 6, 40, 9, '#84a98c');
    rect(ctx, x, y + 6, 4, 10, '#6b8f71');
    rect(ctx, x + 36, y + 6, 4, 10, '#6b8f71');
    rect(ctx, x + 19, y + 6, 1, 9, '#6b8f71');
    rect(ctx, x + 14, y + 22, 14, 7, '#a0703f');
    rect(ctx, x + 14, y + 22, 14, 1, '#c99160');
    rect(ctx, x + 17, y + 24, 3, 3, '#f6f3ec');
    rect(ctx, x + 22, y + 24, 4, 3, '#d9534f');
    return;
  }
  if (kind === 1) {
    // Archiefkast met plant erop.
    const x = cx + 18;
    const y = cy + 12;
    rect(ctx, x + 1, y + 22, 28, 2, 'rgba(0,0,0,0.15)');
    rect(ctx, x, y, 28, 22, '#8b5e34');
    rect(ctx, x + 1, y + 1, 26, 20, '#a0703f');
    for (let i = 0; i < 3; i++) {
      rect(ctx, x + 1, y + 7 + i * 7, 26, 1, '#7d5530');
      const colors = ['#d9534f', '#3a6ea5', '#f4c430', '#4caf50', '#8e6bbf'];
      for (let b = 0; b < 5; b++) rect(ctx, x + 3 + b * 5, y + 2 + i * 7, 3, 5, colors[Math.floor(r() * colors.length)]);
    }
    ctx.drawImage(plant(), 0, 0, 12, 9, x + 15, y - 8, 12, 9);
    return;
  }
  if (kind === 2) {
    // Printer op een kastje.
    const x = cx + 22;
    const y = cy + 16;
    rect(ctx, x + 1, y + 16, 20, 2, 'rgba(0,0,0,0.15)');
    rect(ctx, x, y + 6, 20, 10, '#8b8b93');
    rect(ctx, x, y, 20, 7, '#e3e3e3');
    rect(ctx, x + 2, y + 2, 16, 2, '#b5b5b5');
    rect(ctx, x + 4, y - 3, 12, 3, '#fbfbf7');
    rect(ctx, x + 15, y + 8, 2, 1, '#59d66b');
    return;
  }
  if (kind === 3) {
    ctx.drawImage(plant(), cx + 26, cy + 14);
    ctx.drawImage(plant(), cx + 40, cy + 22);
    return;
  }
  drawSideTable(ctx, cx, cy, r);
}

function drawSideTable(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: () => number): void {
  const x = cx + 22;
  const y = cy + 18;
  rect(ctx, x + 1, y + 13, 20, 2, 'rgba(0,0,0,0.15)');
  rect(ctx, x, y, 20, 10, '#a0703f');
  rect(ctx, x, y + 10, 20, 3, '#7d5530');
  const colors = ['#d9534f', '#3a6ea5', '#f4c430', '#4caf50'];
  for (let i = 0; i < 3; i++) rect(ctx, x + 3 + i * 4, y + 2, 3, 6, colors[Math.floor(r() * colors.length)]);
  ctx.drawImage(plant(), x + 14, y - 10, 6, 8, x + 14, y - 4, 6, 8);
}

function drawDeskStatic(ctx: CanvasRenderingContext2D, d: DeskSlot): void {
  const dx = d.cx + 12;
  const dy = d.cy + 14;
  const r = rng(hash(d.agentId));
  rect(ctx, dx + 1, dy + 15, 40, 2, 'rgba(0,0,0,0.18)');
  rect(ctx, dx + 1, dy + 13, 2, 3, '#5e3f22');
  rect(ctx, dx + 37, dy + 13, 2, 3, '#5e3f22');
  rect(ctx, dx, dy, 40, 11, '#b07a45');
  rect(ctx, dx, dy, 40, 1, '#c99160');
  rect(ctx, dx, dy + 11, 40, 3, '#7d5530');
  rect(ctx, dx + 27, dy + 12, 8, 1, '#5e3f22');
  // Papieren en toetsenbord.
  rect(ctx, dx + 29, dy + 3, 6, 5, '#f4f1ea');
  rect(ctx, dx + 30, dy + 4, 4, 1, '#c9c4b8');
  rect(ctx, dx + 30, dy + 6, 3, 1, '#c9c4b8');
  if (r() > 0.5) rect(ctx, dx + 31, dy + 2, 6, 5, '#fff8c4');
  rect(ctx, d.cx + 26, dy + 8, 12, 2, '#d9d9d9');
  rect(ctx, d.cx + 26, dy + 9, 12, 1, '#bdbdbd');
  // Monitor (scherm wordt dynamisch getekend).
  rect(ctx, d.cx + 25, d.cy + 9, 14, 10, '#2b2b33');
  rect(ctx, d.cx + 30, d.cy + 19, 4, 1, '#2b2b33');
  rect(ctx, d.cx + 28, d.cy + 20, 8, 1, '#3a3a44');
  // Lampvoet en -arm (kap wordt dynamisch getekend).
  rect(ctx, dx + 1, dy + 7, 5, 2, '#444049');
  rect(ctx, dx + 3, dy + 2, 1, 5, '#59545e');
}

function drawCorridor(ctx: CanvasRenderingContext2D, C: CorridorLayout, L: OfficeLayout): void {
  const { x, y, w, h } = C;
  for (let ty = y; ty < y + h - 6; ty += 8)
    for (let tx = x; tx < x + w; tx += 8) rect(ctx, tx, ty, 8, 8, ((tx + ty) / 8) % 2 ? '#ddd2c1' : '#d2c6b3');
  // Loper door de gang.
  rect(ctx, x + 12, C.midY - 4, w - 40, 10, '#9c4a3a');
  rect(ctx, x + 13, C.midY - 3, w - 42, 8, '#b5594a');
  // Onderwand.
  rect(ctx, x, y + h - 6, w, 6, WOOD_DARK);
  // Ingang links (glazen deur).
  rect(ctx, x, C.midY - 14, 3, 26, '#9fd3e6');
  rect(ctx, x, C.midY - 15, 4, 1, '#7a5536');
  rect(ctx, x, C.midY + 12, 4, 1, '#7a5536');
  rect(ctx, x + 3, C.midY - 8, 6, 14, '#7b6a58');
  rect(ctx, x + w - 3, y, 3, h, WOOD_DARK);

  // Deur van Kelvin in de onderwand, met deurmat.
  const kd = C.kelvinDoorX;
  rect(ctx, kd - 10, y + h - 6, 20, 6, '#9a6a3c');
  rect(ctx, kd - 10, y + h - 6, 20, 1, '#b88555');
  rect(ctx, kd + 6, y + h - 4, 2, 1, '#f2c230');
  rect(ctx, kd - 8, y + h - 13, 16, 6, '#7a3b2e');
  rect(ctx, kd - 7, y + h - 12, 14, 4, '#93493a');

  // Receptie.
  const rx = C.receptionX;
  rect(ctx, rx + 2, y + 24, 44, 2, 'rgba(0,0,0,0.15)');
  rect(ctx, rx, y + 10, 44, 8, '#f1ece2');
  rect(ctx, rx, y + 18, 44, 6, '#8b5e34');
  rect(ctx, rx, y + 18, 44, 1, '#a87445');
  rect(ctx, rx + 36, y + 7, 4, 3, '#f2c230');
  rect(ctx, rx + 37, y + 6, 2, 1, '#f2c230');
  rect(ctx, rx + 4, y + 11, 8, 5, '#2b2b33');
  rect(ctx, rx + 5, y + 12, 6, 3, '#4a90d9');
  rect(ctx, rx + 16, y + 12, 6, 4, '#f4f1ea');
  ctx.drawImage(plant(), rx + 48, y + 6);

  // Bankje en planten.
  if (w > 260) {
    const bx = rx - 70;
    rect(ctx, bx, y + h - 16, 34, 6, '#7d5530');
    rect(ctx, bx, y + h - 16, 34, 2, '#a0703f');
    ctx.drawImage(plant(), bx - 16, y + h - 22);
    ctx.drawImage(plant(), kd - 40, y + 4);
  }
  // Deuren van de kamers zijn openingen in de onderwand van de kamers; hier alleen schaduw.
  if (!L.mobile) for (const R of L.rooms) rect(ctx, R.door.x - 10, y, 20, 2, 'rgba(0,0,0,0.12)');
}

/* =====================================================================
 * Labels (naambordjes, iconen, kamerborden). Apart gecachet en ná de
 * nacht-laag getekend, zodat ze 's nachts leesbaar blijven.
 * ===================================================================== */

export function drawLabels(ctx: CanvasRenderingContext2D, L: OfficeLayout, cfg: OfficeConfig): void {
  const agents = new Map<string, AgentConfig>(cfg.agents.map((a) => [a.id, a]));
  ctx.textBaseline = 'alphabetic';
  for (const R of L.rooms) {
    const c = R.dept.colors;
    // Naambord van de afdeling.
    const fit = fitText(ctx, R.dept.name.toUpperCase(), R.w - 76, [8, 6, 5]);
    ctx.font = `${fit.size}px ${PIXEL_FONT}`;
    const tw = Math.ceil(ctx.measureText(fit.text).width);
    const pw = tw + 10;
    const px = R.x + Math.round((R.w - pw) / 2);
    rect(ctx, px - 1, R.y + 1, pw + 2, 12, c.accent);
    if (c.accent2) rect(ctx, px, R.y + 2, pw, 10, c.accent2);
    rect(ctx, px + (c.accent2 ? 1 : 0), R.y + (c.accent2 ? 3 : 2), pw - (c.accent2 ? 2 : 0), c.accent2 ? 8 : 10, c.main);
    ctx.fillStyle = luminance(c.main) > 0.6 ? '#1b1b1b' : '#ffffff';
    ctx.fillText(fit.text, px + 5, R.y + 10);

    for (const d of R.desks) {
      const a = agents.get(d.agentId);
      if (!a) continue;
      ctx.drawImage(roleIcon(a.role), d.cx + 2, d.cy);
      const label = fitText(ctx, a.shortName ?? a.name, CELL_W - 16, [8, 6, 5]);
      ctx.font = `${label.size}px ${PIXEL_FONT}`;
      const lw = Math.ceil(ctx.measureText(label.text).width);
      rect(ctx, d.cx + 13, d.cy, lw + 4, 9, 'rgba(255, 248, 230, 0.85)');
      ctx.fillStyle = '#3a2e28';
      ctx.fillText(label.text, d.cx + 15, d.cy + (label.size === 8 ? 7 : label.size === 6 ? 6 : 6));
    }
  }
  const C = L.corridor;
  plate(ctx, 'RECEPTIE', C.receptionX + 22, C.y + 22, '#3a2e28', '#f2c230');
  const kx = C.kelvinDoorX;
  plate(ctx, 'KELVIN', L.mobile ? kx - 6 : kx - 34, C.y + C.h - 4, '#f7e7b4', '#5b4636', true);
}

/** Klein bordje met tekst, gecentreerd op (cx, baselineY). */
export function plate(ctx: CanvasRenderingContext2D, text: string, cx: number, baseline: number, bg: string, fg: string, border = false, size = 6): void {
  ctx.font = `${size}px ${PIXEL_FONT}`;
  const tw = Math.ceil(ctx.measureText(text).width);
  const x = Math.round(cx - tw / 2 - 3);
  const h = size + 3;
  if (border) rect(ctx, x - 1, baseline - size - 2, tw + 8, h + 2, fg);
  rect(ctx, x, baseline - size - 1, tw + 6, h, bg);
  ctx.fillStyle = fg;
  ctx.fillText(text, x + 3, baseline);
}

/* =====================================================================
 * Dynamische delen per bureau: scherm, lamp, mok, stoel, bordjes.
 * ===================================================================== */

export function lampOn(state: DisplayState, sky: Sky): boolean {
  if (state === 'working') return true;
  if (state === 'paused' || state === 'planned') return false;
  return sky.sun > 0.5;
}

export function drawDeskDynamic(ctx: CanvasRenderingContext2D, d: DeskSlot, state: DisplayState, t: number, sky: Sky, hasCup: boolean): void {
  const sx = d.cx + 26;
  const sy = d.cy + 10;
  const night = sky.sun < 0.3;
  const seed = hash(d.agentId) % 100;
  switch (state) {
    case 'working': {
      const flick = Math.floor(t * 12 + seed) % 7 === 0;
      rect(ctx, sx, sy, 12, 8, flick ? '#2b5c86' : '#1d3b5a');
      const step = Math.floor(t * 6 + seed);
      for (let i = 0; i < 3; i++) {
        const len = 3 + ((step + i * 3) % 7);
        rect(ctx, sx + 1 + (i % 2), sy + 1 + i * 2, len, 1, i === 1 ? '#9cf29c' : '#7fd1ff');
      }
      if (step % 2) rect(ctx, sx + 1, sy + 7, 1, 1, '#ffffff');
      break;
    }
    case 'waiting':
      rect(ctx, sx, sy, 12, 8, '#8a6d1f');
      rect(ctx, sx + 5, sy + 1, 2, 4, '#ffd23f');
      rect(ctx, sx + 5, sy + 6, 2, 1, '#ffd23f');
      break;
    case 'done':
      rect(ctx, sx, sy, 12, 8, '#2f6e3c');
      rect(ctx, sx + 3, sy + 4, 1, 1, '#b8f5c0');
      rect(ctx, sx + 4, sy + 5, 1, 1, '#b8f5c0');
      rect(ctx, sx + 5, sy + 4, 1, 1, '#b8f5c0');
      rect(ctx, sx + 6, sy + 3, 1, 1, '#b8f5c0');
      rect(ctx, sx + 7, sy + 2, 1, 1, '#b8f5c0');
      break;
    case 'error': {
      const on = Math.floor(t * 3) % 2 === 0;
      rect(ctx, sx, sy, 12, 8, on ? '#b3261e' : '#4a1210');
      rect(ctx, sx + 5, sy + 1, 2, 4, '#ffffff');
      rect(ctx, sx + 5, sy + 6, 2, 1, '#ffffff');
      break;
    }
    case 'idle':
      if (night) rect(ctx, sx, sy, 12, 8, '#141418');
      else {
        rect(ctx, sx, sy, 12, 8, '#25384a');
        const p = Math.floor(t * 2 + seed) % 20;
        rect(ctx, sx + 1 + (p % 10), sy + 1 + Math.floor(p / 10) * 4 + 1, 2, 2, '#5f87a8');
      }
      break;
    default:
      rect(ctx, sx, sy, 12, 8, '#141418');
  }
  // Lampkap.
  const lx = d.cx + 13;
  const ly = d.cy + 13;
  const on = lampOn(state, sky);
  rect(ctx, lx, ly, 5, 3, on ? '#f2c230' : '#6c6670');
  rect(ctx, lx + 1, ly + 3, 3, 1, on ? '#fff1b0' : '#3a363d');
  // Koffiemok bij een rustende agent.
  if (state === 'idle' || hasCup) {
    const mx = d.cx + 20;
    const my = d.cy + 19;
    rect(ctx, mx, my, 3, 3, '#f6f3ec');
    rect(ctx, mx, my, 3, 1, '#6b3e1f');
    rect(ctx, mx + 3, my + 1, 1, 1, '#f6f3ec');
    if (hasCup) {
      const s = Math.floor(t * 2) % 2;
      rect(ctx, mx + s, my - 2, 1, 1, 'rgba(255,255,255,0.7)');
      rect(ctx, mx + 1 - s, my - 4, 1, 1, 'rgba(255,255,255,0.5)');
    }
  }
}

export function drawChair(ctx: CanvasRenderingContext2D, d: DeskSlot): void {
  const sx = d.cx + 26;
  const sy = d.cy + 32;
  const main = d.room.dept.colors.main;
  rect(ctx, sx + 2, sy + 10, 8, 1, '#2b2b2b');
  rect(ctx, sx + 1, sy + 10, 1, 1, '#2b2b2b');
  rect(ctx, sx + 10, sy + 10, 1, 1, '#2b2b2b');
  rect(ctx, sx + 5, sy + 8, 2, 2, '#4a4a4a');
  rect(ctx, sx, sy + 5, 12, 3, shade(main, -0.35));
  rect(ctx, sx + 2, sy + 1, 8, 6, shade(main, -0.15));
  rect(ctx, sx + 2, sy + 1, 8, 1, shade(main, 0.15));
}

/** "PAUZE" of "VACATURE"-bordje op het bureau. */
export function drawDeskSign(ctx: CanvasRenderingContext2D, d: DeskSlot, kind: 'paused' | 'planned'): void {
  if (kind === 'paused') plate(ctx, 'PAUZE', d.cx + 32, d.cy + 27, '#ffffff', '#3a2e28', true, 6);
  else plate(ctx, 'VACATURE', d.cx + 32, d.cy + 27, '#ffd75e', '#3a2e28', true, 6);
}

export function drawEnvelopeOnMat(ctx: CanvasRenderingContext2D, C: CorridorLayout): void {
  const x = C.kelvinDoorX - 3;
  const y = C.y + C.h - 12;
  rect(ctx, x, y, 7, 5, '#fbfbf7');
  rect(ctx, x + 1, y + 1, 1, 1, '#c9c4b8');
  rect(ctx, x + 2, y + 2, 3, 1, '#c9c4b8');
  rect(ctx, x + 5, y + 1, 1, 1, '#c9c4b8');
  rect(ctx, x + 3, y + 3, 1, 1, '#d9534f');
}
