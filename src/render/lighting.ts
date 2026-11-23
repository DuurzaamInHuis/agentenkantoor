import { LOCATION } from '../config';
import { mix } from './pixels';

const RAD = Math.PI / 180;

/** Zonnehoogte in graden voor een tijdstip (benadering, ruim voldoende voor licht door de ramen). */
export function solarElevation(ms: number, lat = LOCATION.lat, lon = LOCATION.lon): number {
  const d = ms / 86_400_000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = (gmst * 15 + lon - ra) * RAD;
  const el = Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha));
  return el / RAD;
}

export interface Sky {
  /** 0 = nacht, 1 = volle dag. */
  sun: number;
  top: string;
  bottom: string;
  stars: boolean;
  /** Hoe donker het kantoor is (0..0.62). */
  dark: number;
  /** Avond-/ochtendrood (0..1). */
  warm: number;
}

const NIGHT = ['#0b1230', '#1b2a52'];
const DUSK = ['#5b4a8f', '#f0915a'];
const DAY = ['#6fbef2', '#c4e8ff'];

export function skyAt(ms: number): Sky {
  const el = solarElevation(ms);
  const sun = Math.max(0, Math.min(1, (el + 6) / 14));
  const warm = Math.max(0, 1 - Math.abs(el - 1) / 7);
  const lerp = (i: number) => (sun < 0.45 ? mix(NIGHT[i], DUSK[i], sun / 0.45) : mix(DUSK[i], DAY[i], (sun - 0.45) / 0.55));
  return { sun, top: lerp(0), bottom: lerp(1), stars: sun < 0.25, dark: (1 - sun) * 0.62, warm };
}

export interface Light {
  x: number;
  y: number;
  r: number;
  strength: number;
  color?: string;
}

/** Donkerte-laag met "gaten" voor lampen, op logische resolutie (wordt blokkerig opgeschaald). */
export class LightMap {
  dark = document.createElement('canvas');
  glow = document.createElement('canvas');

  resize(w: number, h: number): void {
    this.dark.width = this.glow.width = w;
    this.dark.height = this.glow.height = h;
  }

  render(lights: Light[], darkness: number): void {
    const d = this.dark.getContext('2d')!;
    const g = this.glow.getContext('2d')!;
    const { width: w, height: h } = this.dark;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, w, h);
    d.fillStyle = `rgba(8, 12, 38, ${darkness})`;
    d.fillRect(0, 0, w, h);
    d.globalCompositeOperation = 'destination-out';
    g.clearRect(0, 0, w, h);
    for (const l of lights) {
      const grad = d.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      grad.addColorStop(0, `rgba(0,0,0,${l.strength})`);
      grad.addColorStop(0.55, `rgba(0,0,0,${l.strength * 0.6})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grad;
      d.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);

      const gg = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.8);
      const c = l.color ?? '255, 200, 120';
      gg.addColorStop(0, `rgba(${c}, ${0.32 * darkness * l.strength})`);
      gg.addColorStop(1, `rgba(${c}, 0)`);
      g.fillStyle = gg;
      g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
  }
}
