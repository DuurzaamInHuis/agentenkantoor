import type { Department, OfficeConfig } from '../types';

/** Alle maten in logische pixels; het canvas schaalt dit in hele (device)pixels op. */
export const CELL_W = 64;
export const CELL_H = 56;
export const PAD = 8;
export const WALL_H = 40;
export const STRIP_H = 40;
export const WALL_T = 4;
export const CORRIDOR_H = 64;

export interface P {
  x: number;
  y: number;
}

export interface DeskSlot {
  agentId: string;
  col: number;
  row: number;
  /** Linksboven van de bureaucel. */
  cx: number;
  cy: number;
  /** Voetpositie als het poppetje zit / naast het bureau staat. */
  seat: P;
  stand: P;
  room: RoomLayout;
}

export interface RoomLayout {
  dept: Department;
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  gridX: number;
  gridY: number;
  gridBottom: number;
  /** Looplijn (voet-y) in de vrije strook onderin de kamer. */
  stripY: number;
  door: P;
  coffee: P;
  coffeeSpot: P;
  plant: P;
  plantSpot: P;
  desks: DeskSlot[];
}

export interface CorridorLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  midY: number;
  entrance: P;
  kelvinDoorX: number;
  receptionX: number;
}

export interface OfficeLayout {
  w: number;
  h: number;
  mobile: boolean;
  rooms: RoomLayout[];
  corridor: CorridorLayout;
  deskByAgent: Map<string, DeskSlot>;
}

/**
 * Desktop: kamers naast elkaar, even hoog, gang eronder.
 * Telefoon: kamers onder elkaar (2 bureaus per rij), gang onderaan.
 */
export function computeLayout(cfg: OfficeConfig, mobile: boolean): OfficeLayout {
  const cols = mobile ? 2 : 3;
  const perDept = cfg.departments.map((d) => cfg.agents.filter((a) => a.department === d.id));
  const rowsOf = perDept.map((list) => Math.max(1, Math.ceil(list.length / cols)));
  const maxRows = Math.max(1, ...rowsOf);
  const roomW = cols * CELL_W + 2 * PAD;

  const rooms: RoomLayout[] = [];
  const deskByAgent = new Map<string, DeskSlot>();
  let y = 0;
  cfg.departments.forEach((dept, i) => {
    const rows = mobile ? rowsOf[i] : maxRows;
    const h = WALL_H + rows * CELL_H + STRIP_H + WALL_T;
    const room = makeRoom(dept, mobile ? 0 : i * roomW, mobile ? y : 0, roomW, h, cols, rows);
    perDept[i].forEach((a, idx) => {
      const desk = makeDesk(room, a.id, idx % cols, Math.floor(idx / cols));
      room.desks.push(desk);
      deskByAgent.set(a.id, desk);
    });
    rooms.push(room);
    y = mobile ? y + h : Math.max(y, h);
  });

  const w = mobile ? roomW : roomW * Math.max(1, cfg.departments.length);
  const top = y;
  const corridor: CorridorLayout = {
    x: 0,
    y: top,
    w,
    h: CORRIDOR_H,
    midY: top + 42,
    entrance: { x: 6, y: top + 42 },
    kelvinDoorX: w - 30,
    receptionX: Math.round(w * 0.38),
  };
  return { w, h: top + CORRIDOR_H, mobile, rooms, corridor, deskByAgent };
}

function makeRoom(dept: Department, x: number, y: number, w: number, h: number, cols: number, rows: number): RoomLayout {
  const gridX = x + PAD;
  const gridY = y + WALL_H;
  const gridBottom = gridY + rows * CELL_H;
  const stripY = gridBottom + 26;
  const coffee = { x: x + w - PAD - 14, y: gridBottom + 6 };
  const plantPos = { x: x + 5, y: gridBottom + 12 };
  return {
    dept, x, y, w, h, cols, rows, gridX, gridY, gridBottom, stripY,
    door: { x: x + Math.round(w / 2), y: y + h - 1 },
    coffee,
    coffeeSpot: { x: coffee.x - 7, y: stripY },
    plant: plantPos,
    plantSpot: { x: plantPos.x + 21, y: stripY },
    desks: [],
  };
}

function makeDesk(room: RoomLayout, agentId: string, col: number, row: number): DeskSlot {
  const cx = room.gridX + col * CELL_W;
  const cy = room.gridY + row * CELL_H;
  return { agentId, col, row, cx, cy, seat: { x: cx + 32, y: cy + 42 }, stand: { x: cx + 58, y: cy + 42 }, room };
}

/* ---------- Looproutes: alleen via gangpaden, zodat niemand door bureaus loopt ---------- */

function exitPath(room: RoomLayout, p: P): P[] {
  if (p.y >= room.gridBottom) return [{ x: p.x, y: room.stripY }];
  const c = Math.max(0, Math.min(room.cols - 1, Math.floor((p.x - room.gridX) / CELL_W)));
  const r = Math.max(0, Math.min(room.rows - 1, Math.floor((p.y - room.gridY) / CELL_H)));
  const aisle = room.gridY + r * CELL_H + 52;
  const gapX = room.gridX + c * CELL_W + 58;
  return [{ x: p.x, y: aisle }, { x: gapX, y: aisle }, { x: gapX, y: room.stripY }];
}

function sameCell(room: RoomLayout, a: P, b: P): boolean {
  if (a.y >= room.gridBottom || b.y >= room.gridBottom) return false;
  const cell = (p: P) => `${Math.floor((p.x - room.gridX) / CELL_W)},${Math.floor((p.y - room.gridY) / CELL_H)}`;
  return cell(a) === cell(b);
}

/** Route met alleen horizontale/verticale stukken van a naar b binnen één kamer. */
export function route(room: RoomLayout, a: P, b: P): P[] {
  let pts: P[];
  if (sameCell(room, a, b)) pts = [{ x: b.x, y: a.y }, b];
  else pts = [...exitPath(room, a), ...exitPath(room, b).reverse(), b];
  const out: P[] = [];
  let prev = a;
  for (const p of pts) {
    if (p.x === prev.x && p.y === prev.y) continue;
    // Zorg dat elk stuk recht is (eerst horizontaal, dan verticaal).
    if (p.x !== prev.x && p.y !== prev.y) out.push({ x: p.x, y: prev.y });
    out.push(p);
    prev = p;
  }
  return out;
}
