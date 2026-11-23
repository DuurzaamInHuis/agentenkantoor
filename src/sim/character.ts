import { route, type DeskSlot, type P } from '../render/layout';
import type { Frames } from '../render/sprites';
import type { DisplayState } from '../types';

export type Dir = 'down' | 'up' | 'left' | 'right';
export type Mode = 'seated' | 'standing' | 'walking' | 'linger' | 'absent';
export type Errand = 'coffee' | 'plant' | 'chat';

const SPEED = 22; // logische pixels per seconde

/**
 * Eén poppetje = één agent. De status bepaalt waar het hoort te zijn:
 *  working / error / idle → aan het bureau zitten
 *  waiting / done         → naast het bureau staan
 *  paused / planned       → niet aanwezig (loopt de deur uit)
 * Idle poppetjes gaan af en toe koffie halen, naar de plant of even kletsen.
 */
export class Character {
  pos: P;
  dir: Dir = 'up';
  mode: Mode = 'seated';
  state: DisplayState = 'idle';
  errand: Errand | null = null;
  path: P[] = [];
  walkT = 0;
  lingerStart = 0;
  lingerUntil = 0;
  lingerFace: Dir = 'down';
  nextWander: number;
  cupUntil = 0;
  nextPaper: number;
  private onArrive: (() => void) | null = null;

  constructor(
    public desk: DeskSlot,
    public frames: Frames,
    private random: () => number,
  ) {
    this.pos = { ...desk.seat };
    this.nextWander = 12 + random() * 45;
    this.nextPaper = random() * 5;
  }

  get room() {
    return this.desk.room;
  }

  private goal(state: DisplayState): 'seat' | 'stand' | 'away' {
    if (state === 'waiting' || state === 'done') return 'stand';
    if (state === 'paused' || state === 'planned') return 'away';
    return 'seat';
  }

  /** Direct op de juiste plek zetten (bij laden of nieuwe indeling). */
  place(state: DisplayState): void {
    this.state = state;
    this.errand = null;
    this.path = [];
    const g = this.goal(state);
    if (g === 'away') {
      this.mode = 'absent';
    } else if (g === 'seat') {
      this.pos = { ...this.desk.seat };
      this.mode = 'seated';
      this.dir = 'up';
    } else {
      this.pos = { ...this.desk.stand };
      this.mode = 'standing';
      this.dir = 'down';
    }
  }

  setState(state: DisplayState, t: number): void {
    if (state === this.state) return;
    this.state = state;
    this.goToGoal(t);
  }

  goToGoal(_t: number): void {
    this.errand = null;
    const g = this.goal(this.state);
    if (g === 'away') {
      if (this.mode === 'absent') return;
      this.walk(route(this.room, this.pos, this.room.door), () => (this.mode = 'absent'));
      return;
    }
    if (this.mode === 'absent') this.pos = { ...this.room.door };
    const target = g === 'seat' ? this.desk.seat : this.desk.stand;
    this.walk(route(this.room, this.pos, target), () => {
      this.mode = g === 'seat' ? 'seated' : 'standing';
      this.dir = g === 'seat' ? 'up' : 'down';
    });
  }

  startErrand(kind: Errand, spot: P, face: Dir, t: number, duration: number): void {
    this.errand = kind;
    this.walk(route(this.room, this.pos, spot), () => {
      this.mode = 'linger';
      this.dir = face;
      this.lingerFace = face;
      this.lingerStart = t;
      this.lingerUntil = t + duration;
    });
  }

  private walk(path: P[], cb: () => void): void {
    this.path = path;
    this.onArrive = cb;
    this.mode = 'walking';
    if (!path.length) this.arrive();
  }

  private arrive(): void {
    const cb = this.onArrive;
    this.onArrive = null;
    cb?.();
  }

  update(dt: number, t: number): void {
    if (this.mode === 'walking') {
      let budget = SPEED * dt;
      this.walkT += dt;
      while (budget > 0 && this.path.length) {
        const target = this.path[0];
        const dx = target.x - this.pos.x;
        const dy = target.y - this.pos.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist <= budget) {
          this.pos = { ...target };
          this.path.shift();
          budget -= dist;
        } else {
          if (dx !== 0) this.pos.x += Math.sign(dx) * budget;
          else this.pos.y += Math.sign(dy) * budget;
          budget = 0;
        }
        if (dx !== 0) this.dir = dx > 0 ? 'right' : 'left';
        else if (dy !== 0) this.dir = dy > 0 ? 'down' : 'up';
      }
      if (!this.path.length) this.arrive();
    } else if (this.mode === 'linger' && t >= this.lingerUntil) {
      if (this.errand === 'coffee') this.cupUntil = t + 45;
      this.nextWander = t + 35 + this.random() * 60;
      this.goToGoal(t);
    }
  }

  get present(): boolean {
    return this.mode !== 'absent';
  }

  get seated(): boolean {
    return this.mode === 'seated';
  }

  /** Welk frame nu getekend wordt. */
  frame(t: number): HTMLCanvasElement | null {
    const f = this.frames;
    switch (this.mode) {
      case 'absent':
        return null;
      case 'walking': {
        const step = Math.floor(this.walkT * 7) % 4;
        if (this.dir === 'left' || this.dir === 'right') return f[`${this.dir}_${step % 2}`];
        return f[`${this.dir}_${[0, 1, 0, 2][step]}`];
      }
      case 'seated': {
        if (this.state === 'working') return f[`sit_${Math.floor(t * 8) % 2}`];
        if (this.state === 'error') return f[`sit_err_${Math.floor(t * 3) % 2}`];
        const sipCycle = (t + this.desk.cx * 0.37) % 7;
        return sipCycle < 1.2 ? f.sit_sip : f.sit_idle;
      }
      case 'standing': {
        if (this.state === 'waiting') return Math.floor(t * 2.5) % 4 === 3 ? f.wave_1 : f.wave_0;
        if (this.state === 'done') {
          const c = (t + this.desk.cx * 0.11) % 3;
          return c < 1.1 ? f.stretch_0 : c < 1.5 ? f.stretch_1 : f.down_0;
        }
        return f.down_0;
      }
      case 'linger': {
        if (this.errand === 'coffee' && t - this.lingerStart > 2.5) {
          this.dir = 'down';
          return (t - this.lingerStart) % 4 < 1 ? f.sip : f.cup;
        }
        return f[`${this.dir}_0`];
      }
    }
  }

  /** Linksboven van de sprite. Zittend: hoofd en schouders boven de stoelleuning. */
  spriteTopLeft(): P {
    if (this.mode === 'seated') return { x: this.desk.seat.x - 5, y: this.desk.cy + 26 };
    return { x: Math.round(this.pos.x) - 5, y: Math.round(this.pos.y) - 16 };
  }

  /** Klikgebied van het poppetje. */
  hitBox(): { x: number; y: number; w: number; h: number } | null {
    if (!this.present) return null;
    const p = this.spriteTopLeft();
    return { x: p.x - 1, y: p.y - 2, w: 12, h: this.mode === 'seated' ? 15 : 19 };
  }
}
