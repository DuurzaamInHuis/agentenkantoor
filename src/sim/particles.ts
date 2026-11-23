import { rect } from '../render/pixels';

interface Particle {
  kind: 'paper' | 'smoke';
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

/** Vliegende papiertjes (working) en rookwolkjes (error). */
export class Particles {
  private list: Particle[] = [];

  paper(x: number, y: number): void {
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.list.push({ kind: 'paper', x, y, vx: dir * (8 + Math.random() * 10), vy: -26 - Math.random() * 10, age: 0, life: 1.4 });
  }

  smoke(x: number, y: number): void {
    this.list.push({ kind: 'smoke', x: x + (Math.random() * 4 - 2), y, vx: Math.random() * 4 - 2, vy: -6 - Math.random() * 4, age: 0, life: 2.2 });
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'paper') p.vy += 42 * dt;
    }
    this.list = this.list.filter((p) => p.age < p.life);
    if (this.list.length > 200) this.list.splice(0, this.list.length - 200);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const k = p.age / p.life;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      if (p.kind === 'paper') {
        const flip = Math.floor(p.age * 10) % 2;
        rect(ctx, p.x, p.y, flip ? 3 : 2, flip ? 2 : 3, '#fbfbf7');
        rect(ctx, p.x, p.y, 1, 1, '#c9c4b8');
      } else {
        const s = 1 + Math.floor(k * 4);
        rect(ctx, p.x - s / 2, p.y - s / 2, s, s, k < 0.3 ? '#5a5a5a' : '#8d8d8d');
      }
    }
    ctx.globalAlpha = 1;
  }
}
