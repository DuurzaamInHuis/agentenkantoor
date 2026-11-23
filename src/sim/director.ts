import type { OfficeLayout, RoomLayout } from '../render/layout';
import { hash, rng } from '../render/pixels';
import { buildFrames, HAIRS, pantsFor, SKINS, type Frames } from '../render/sprites';
import type { AgentView } from '../types';
import { Character } from './character';
import { Particles } from './particles';

/** Regisseur: maakt de poppetjes, verdeelt rustige wandelingetjes en spawnt effecten. */
export class Director {
  chars = new Map<string, Character>();
  particles = new Particles();
  t = 0;
  private random = rng(Date.now() >>> 0);
  private spriteCache = new Map<string, Frames>();
  postmanFrames = buildFrames({ skin: '#e0ac7e', hair: '#3a2a1a', shirt: '#2f5597', accent: '#f2c230', pants: '#24324f', longHair: false, cap: '#2f5597', capBand: '#f2c230' });
  postmanFramesEnv = buildFrames({ skin: '#e0ac7e', hair: '#3a2a1a', shirt: '#2f5597', accent: '#f2c230', pants: '#24324f', longHair: false, cap: '#2f5597', capBand: '#f2c230', envelope: true });

  /** Nieuwe indeling (resize of nieuwe config): alle poppetjes direct op hun plek. */
  rebuild(layout: OfficeLayout, views: AgentView[]): void {
    this.chars.clear();
    for (const v of views) {
      const desk = layout.deskByAgent.get(v.config.id);
      if (!desk) continue;
      const ch = new Character(desk, this.framesFor(v), rng(hash(v.config.id) ^ (Date.now() >>> 0)));
      ch.place(v.state);
      this.chars.set(v.config.id, ch);
    }
  }

  sync(views: AgentView[]): void {
    for (const v of views) this.chars.get(v.config.id)?.setState(v.state, this.t);
  }

  private framesFor(v: AgentView): Frames {
    const key = `${v.config.id}|${v.dept.colors.main}|${v.dept.colors.accent}`;
    let f = this.spriteCache.get(key);
    if (!f) {
      const h = hash(v.config.id);
      const c = v.dept.colors;
      f = buildFrames({
        skin: SKINS[h % SKINS.length],
        hair: HAIRS[(h >>> 4) % HAIRS.length],
        shirt: c.main,
        accent: (h >>> 9) % 3 === 0 && c.accent2 ? c.accent2 : c.accent,
        pants: pantsFor(c.main),
        longHair: (h >>> 12) % 3 === 0,
      });
      this.spriteCache.set(key, f);
    }
    return f;
  }

  update(dt: number, layout: OfficeLayout): void {
    this.t += dt;
    const t = this.t;
    for (const ch of this.chars.values()) ch.update(dt, t);
    for (const room of layout.rooms) this.wander(room, t);

    for (const ch of this.chars.values()) {
      if (!ch.seated) continue;
      const d = ch.desk;
      if (ch.state === 'working' && t >= ch.nextPaper) {
        ch.nextPaper = t + 3 + this.random() * 6;
        this.particles.paper(d.cx + 40, d.cy + 16);
      }
      if (ch.state === 'error' && this.random() < dt * 3) this.particles.smoke(d.cx + 32, d.cy + 8);
    }
    this.particles.update(dt);
  }

  /** Idle poppetjes lopen af en toe naar de koffie, de plant of kletsen even met een collega. Rustig: max 2 tegelijk per kamer. */
  private wander(room: RoomLayout, t: number): void {
    const inRoom = room.desks.map((d) => this.chars.get(d.agentId)).filter((c): c is Character => !!c);
    const busy = inRoom.filter((c) => c.errand !== null).length;
    if (busy >= 2) return;
    const candidates = inRoom.filter((c) => c.state === 'idle' && c.seated && t >= c.nextWander);
    if (!candidates.length) return;
    const ch = candidates[0];
    const r = this.random();
    const partner = inRoom.find((c) => c !== ch && c.state === 'idle' && c.seated && c.errand === null);
    if (r < 0.3 && partner && busy === 0) {
      const minX = room.x + 40;
      const maxX = room.x + room.w - 64;
      const x = Math.round(minX + this.random() * Math.max(0, maxX - minX));
      const dur = 7 + this.random() * 6;
      ch.startErrand('chat', { x, y: room.stripY }, 'right', t, dur);
      partner.startErrand('chat', { x: x + 13, y: room.stripY }, 'left', t, dur);
      partner.nextWander = t + 40;
    } else if (r < 0.75) {
      ch.startErrand('coffee', room.coffeeSpot, 'right', t, 6 + this.random() * 4);
    } else {
      ch.startErrand('plant', room.plantSpot, 'left', t, 4 + this.random() * 3);
    }
    ch.nextWander = t + 40 + this.random() * 60;
  }
}
