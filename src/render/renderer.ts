import { postmanAt } from '../sim/postman';
import { Director } from '../sim/director';
import { now } from '../time';
import type { AgentView, OfficeConfig } from '../types';
import { computeLayout, type OfficeLayout } from './layout';
import { LightMap, skyAt, type Light, type Sky } from './lighting';
import { drawBackground, drawChair, drawDeskDynamic, drawDeskSign, drawEnvelopeOnMat, drawLabels, lampOn } from './office';
import { PIXEL_FONT, rect } from './pixels';
import { bubble } from './sprites';

const MOBILE_BREAKPOINT = 700;

/** Het kantoor op het canvas: layout, schalen, tekenen per frame en klikken. */
export class OfficeView {
  private ctx: CanvasRenderingContext2D;
  private layout: OfficeLayout | null = null;
  private config: OfficeConfig | null = null;
  private views = new Map<string, AgentView>();
  private director = new Director();
  private light = new LightMap();
  private bg = document.createElement('canvas');
  private labels = document.createElement('canvas');
  private bgMinute = -1;
  /** Device-pixels per logische pixel (altijd een geheel getal). */
  private dev = 2;
  private hoverId: string | null = null;
  selectedId: string | null = null;
  demo = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private wrap: HTMLElement,
    private onSelect: (id: string) => void,
  ) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('click', (e) => {
      const id = this.hit(e);
      if (id) this.onSelect(id);
    });
    canvas.addEventListener('mousemove', (e) => {
      this.hoverId = this.hit(e);
      canvas.style.cursor = this.hoverId ? 'pointer' : 'default';
    });
    canvas.addEventListener('mouseleave', () => (this.hoverId = null));
    new ResizeObserver(() => this.resize()).observe(wrap);
    window.addEventListener('resize', () => this.resize());
    // Pixel-lettertype geladen → labels opnieuw tekenen.
    document.fonts?.load(`8px ${PIXEL_FONT}`).then(() => this.redrawStatic(), () => undefined);
    document.fonts?.ready.then(() => this.redrawStatic());
  }

  /** @param fresh true bij de eerste status: dan staat iedereen meteen op zijn plek in plaats van te lopen. */
  setData(config: OfficeConfig, views: AgentView[], fresh = false): void {
    const configChanged = config !== this.config || fresh;
    this.config = config;
    this.views = new Map(views.map((v) => [v.config.id, v]));
    if (configChanged) this.relayout(true);
    else this.director.sync(views);
  }

  private relayout(force = false): void {
    if (!this.config) return;
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (!force && this.layout && this.layout.mobile === mobile) return;
    this.layout = computeLayout(this.config, mobile);
    this.director.rebuild(this.layout, [...this.views.values()]);
    this.resize(true);
  }

  resize(forceStatic = false): void {
    if (!this.config) return;
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (!this.layout || this.layout.mobile !== mobile) {
      this.relayout(true);
      return;
    }
    const L = this.layout;
    const dpr = window.devicePixelRatio || 1;
    const ws = getComputedStyle(this.wrap);
    const border = parseFloat(getComputedStyle(this.canvas).borderLeftWidth) * 2 || 0;
    const availW = Math.max(100, this.wrap.clientWidth - parseFloat(ws.paddingLeft) - parseFloat(ws.paddingRight) - border);
    let dev = Math.max(1, Math.floor((availW * dpr) / L.w));
    if (!mobile) {
      // Op desktop het hele kantoor in beeld houden, maar niet kleiner dan 1,5× (anders liever scrollen).
      const top = this.wrap.getBoundingClientRect().top;
      const availH = Math.max(200, window.innerHeight - top - 16);
      const devH = Math.max(1, Math.floor((availH * dpr) / L.h));
      if (devH / dpr >= 1.5) dev = Math.min(dev, devH);
    }
    if (dev === this.dev && this.canvas.width === L.w * dev && !forceStatic) return;
    this.dev = dev;
    this.canvas.width = this.bg.width = this.labels.width = L.w * dev;
    this.canvas.height = this.bg.height = this.labels.height = L.h * dev;
    this.canvas.style.width = `${(L.w * dev) / dpr}px`;
    this.canvas.style.height = `${(L.h * dev) / dpr}px`;
    this.light.resize(L.w, L.h);
    this.redrawStatic();
  }

  private redrawStatic(): void {
    if (!this.layout || !this.config) return;
    const sky = skyAt(now());
    const b = this.bg.getContext('2d')!;
    b.setTransform(this.dev, 0, 0, this.dev, 0, 0);
    b.imageSmoothingEnabled = false;
    drawBackground(b, this.layout, sky);
    const l = this.labels.getContext('2d')!;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.clearRect(0, 0, this.labels.width, this.labels.height);
    l.setTransform(this.dev, 0, 0, this.dev, 0, 0);
    l.imageSmoothingEnabled = false;
    drawLabels(l, this.layout, this.config);
    this.bgMinute = Math.floor(now() / 60_000);
  }

  private toLogical(e: MouseEvent): { x: number; y: number } | null {
    if (!this.layout) return null;
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * this.layout.w) / r.width, y: ((e.clientY - r.top) * this.layout.h) / r.height };
  }

  private hit(e: MouseEvent): string | null {
    const p = this.toLogical(e);
    if (!p || !this.layout) return null;
    for (const [id, ch] of this.director.chars) {
      const b = ch.hitBox();
      if (b && p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) return id;
    }
    for (const [id, d] of this.layout.deskByAgent) {
      if (p.x >= d.cx + 2 && p.x < d.cx + 54 && p.y >= d.cy && p.y < d.cy + 44) return id;
    }
    return null;
  }

  frame(dt: number): void {
    const L = this.layout;
    if (!L) return;
    const nowMs = now();
    this.director.update(dt, L);
    const t = this.director.t;
    const sky = skyAt(nowMs);
    if (Math.floor(nowMs / 60_000) !== this.bgMinute) this.redrawStatic();

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.dev, 0, 0, this.dev, 0, 0);
    ctx.imageSmoothingEnabled = false;

    this.drawSunPatches(ctx, L, sky);

    // Bureaus (scherm, lamp, mok).
    for (const [id, d] of L.deskByAgent) {
      const v = this.views.get(id);
      const ch = this.director.chars.get(id);
      drawDeskDynamic(ctx, d, v?.state ?? 'idle', t, sky, !!ch && ch.cupUntil > t && ch.seated);
    }

    // Stoelen en poppetjes, gesorteerd op diepte.
    const drawables: { y: number; draw: () => void }[] = [];
    for (const d of L.deskByAgent.values()) drawables.push({ y: d.seat.y + 0.5, draw: () => drawChair(ctx, d) });
    for (const ch of this.director.chars.values()) {
      const img = ch.frame(t);
      if (!img) continue;
      const p = ch.spriteTopLeft();
      drawables.push({
        y: ch.seated ? ch.desk.seat.y : ch.pos.y,
        draw: () => {
          if (!ch.seated) rect(ctx, p.x + 1, p.y + 15, 8, 2, 'rgba(0,0,0,0.18)');
          ctx.drawImage(img, p.x, p.y);
        },
      });
    }
    // Postbode.
    const post = postmanAt(nowMs, L.corridor, this.demo ? t : null);
    if (post.visible) {
      const frames = post.carrying ? this.director.postmanFramesEnv : this.director.postmanFrames;
      const side = post.dir === 'left' || post.dir === 'right';
      const step = Math.floor(t * 7) % 4;
      const name = post.walking ? (side ? `${post.dir}_${step % 2}` : `${post.dir}_${[0, 1, 0, 2][step]}`) : `${post.dir}_0`;
      const x = Math.round(post.pos.x) - 5;
      const y = Math.round(post.pos.y) - 16;
      drawables.push({ y: post.pos.y, draw: () => { rect(ctx, x + 1, y + 15, 8, 2, 'rgba(0,0,0,0.18)'); ctx.drawImage(frames[name], x, y); } });
    }
    drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
    if (post.envelopeOnMat) drawEnvelopeOnMat(ctx, L.corridor);

    this.director.particles.draw(ctx);

    // Nacht: alles dimmen behalve de lampjes van werkende agents.
    if (sky.dark > 0.02) {
      this.light.render(this.lights(L, sky), sky.dark);
      ctx.drawImage(this.light.dark, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.light.glow, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Labels en bordjes blijven leesbaar.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1 - sky.dark * 0.35;
    ctx.drawImage(this.labels, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setTransform(this.dev, 0, 0, this.dev, 0, 0);

    for (const [id, d] of L.deskByAgent) {
      const state = this.views.get(id)?.state;
      const ch = this.director.chars.get(id);
      if ((state === 'paused' || state === 'planned') && !ch?.present) drawDeskSign(ctx, d, state);
    }

    // Wolkjes boven de hoofden.
    for (const ch of this.director.chars.values()) {
      if (!ch.present) continue;
      const p = ch.spriteTopLeft();
      const bob = Math.round(Math.sin(t * 3 + ch.desk.cx) * 1);
      const kind = ch.state === 'waiting' ? 'waiting' : ch.state === 'done' ? 'done' : ch.state === 'error' ? 'error' : null;
      if (kind) ctx.drawImage(bubble(kind), p.x - 1, p.y - 12 + bob);
      else if (ch.mode === 'linger' && ch.errand === 'chat' && Math.floor((t + ch.desk.cx) * 0.8) % 3 === 0) {
        ctx.drawImage(bubble('chat'), p.x + (ch.dir === 'right' ? 4 : -2), p.y - 7);
      }
    }

    // Hover/selectie-rand.
    for (const id of [this.hoverId, this.selectedId]) {
      const d = id ? L.deskByAgent.get(id) : null;
      if (!d) continue;
      ctx.strokeStyle = id === this.selectedId ? '#ffd23f' : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(d.cx + 0.5, d.cy - 1.5, 63, 47);
      ctx.setLineDash([]);
    }
  }

  private drawSunPatches(ctx: CanvasRenderingContext2D, L: OfficeLayout, sky: Sky): void {
    if (sky.sun < 0.35) return;
    const alpha = 0.1 * Math.min(1, (sky.sun - 0.35) / 0.4);
    ctx.fillStyle = sky.warm > 0.3 ? `rgba(255, 170, 90, ${alpha * 1.3})` : `rgba(255, 240, 190, ${alpha})`;
    for (const R of L.rooms) {
      const xs = [R.x + 10, R.x + R.w - 36];
      if (R.w >= 200) xs.splice(1, 0, R.x + 40, R.x + R.w - 66);
      for (const x of xs) {
        for (let i = 0; i < 10; i++) ctx.fillRect(x - 2 + i, R.y + 36 + i * 2, 28, 2);
      }
    }
  }

  private lights(L: OfficeLayout, sky: Sky): Light[] {
    const out: Light[] = [];
    for (const [id, d] of L.deskByAgent) {
      const state = this.views.get(id)?.state ?? 'idle';
      if (state === 'working' && lampOn(state, sky)) {
        out.push({ x: d.cx + 16, y: d.cy + 20, r: 26, strength: 1 });
        out.push({ x: d.cx + 32, y: d.cy + 14, r: 12, strength: 0.6, color: '140, 200, 255' });
      } else if (state === 'error') {
        out.push({ x: d.cx + 32, y: d.cy + 14, r: 10, strength: 0.5, color: '255, 80, 60' });
      }
    }
    const C = L.corridor;
    out.push({ x: C.receptionX + 22, y: C.y + 16, r: 22, strength: 0.6 });
    return out;
  }
}
