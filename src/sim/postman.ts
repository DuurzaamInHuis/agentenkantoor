import { BRIEFING_TIME } from '../config';
import type { CorridorLayout, P } from '../render/layout';
import { madridSecondsOfDay } from '../time';
import type { Dir } from './character';

const SPEED = 26;
const PAUSE = 3;
/** In demo-modus komt de postbode elke zoveel seconden langs. */
export const DEMO_CYCLE = 150;

export interface PostmanFrame {
  visible: boolean;
  pos: P;
  dir: Dir;
  walking: boolean;
  carrying: boolean;
  envelopeOnMat: boolean;
}

/**
 * Om 08:30 (Europe/Madrid) loopt de postbode van de ingang naar de deur van Kelvin,
 * legt de envelop (de dagelijkse briefing) op de mat en loopt terug.
 * De envelop blijft tot 12:00 liggen. Volledig afgeleid van de klok, dus geen state nodig.
 */
export function postmanAt(nowMs: number, C: CorridorLayout, demoT: number | null): PostmanFrame {
  const a: P = { x: C.x + 6, y: C.midY };
  const b: P = { x: C.kelvinDoorX, y: C.midY };
  const c: P = { x: C.kelvinDoorX, y: C.y + C.h - 13 };
  const d1 = Math.abs(b.x - a.x);
  const d2 = Math.abs(c.y - b.y);
  const walk = (d1 + d2) / SPEED;
  const drop = walk + 1.2;
  const total = walk * 2 + PAUSE;

  const briefingSec = BRIEFING_TIME.hour * 3600 + BRIEFING_TIME.minute * 60;
  const dayT = madridSecondsOfDay(nowMs) - briefingSec;
  let e = dayT;
  let onMat = dayT >= drop && madridSecondsOfDay(nowMs) < 12 * 3600;
  if (demoT !== null && !(dayT >= 0 && dayT <= total)) {
    e = demoT % DEMO_CYCLE;
    onMat = onMat || e >= drop;
  }

  const hidden: PostmanFrame = { visible: false, pos: a, dir: 'right', walking: false, carrying: false, envelopeOnMat: onMat };
  if (e < 0 || e > total) return hidden;

  const along = (dist: number): { pos: P; dir: Dir } =>
    dist <= d1 ? { pos: { x: a.x + dist, y: a.y }, dir: 'right' } : { pos: { x: b.x, y: b.y + (dist - d1) }, dir: 'down' };

  if (e < walk) return { ...hidden, visible: true, ...along(e * SPEED), walking: true, carrying: true };
  if (e < walk + PAUSE) return { ...hidden, visible: true, pos: c, dir: 'down', walking: false, carrying: e < drop };
  const back = (total - e) * SPEED;
  const p = along(back);
  return { ...hidden, visible: true, pos: p.pos, dir: p.dir === 'right' ? 'left' : 'up', walking: true, carrying: false };
}
