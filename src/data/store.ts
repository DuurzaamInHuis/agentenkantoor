import { DONE_WINDOW_MS } from '../config';
import { parseTime } from '../time';
import { isRead } from './readMarks';
import type { AgentView, DisplayState, OfficeConfig, StatusFile } from '../types';

export interface AppState {
  config: OfficeConfig | null;
  status: StatusFile | null;
  mode: 'demo' | 'live';
  /** Tijdstip (ms) van de laatste geslaagde ophaalactie. */
  lastSuccessAt: number | null;
  /** Melding als de laatste ophaalactie mislukte. */
  fetchError: string | null;
  /** Fatale fout, bijvoorbeeld een onleesbare agents.config.json. */
  fatal: string | null;
}

type Listener = (s: AppState) => void;

export class Store {
  state: AppState = { config: null, status: null, mode: 'demo', lastSuccessAt: null, fetchError: null, fatal: null };
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }
}

/** Voegt config en status samen tot wat het kantoor en de UI tonen. */
export function deriveViews(config: OfficeConfig, status: StatusFile | null, nowMs: number): AgentView[] {
  const depts = new Map(config.departments.map((d) => [d.id, d]));
  return config.agents.map((a) => {
    const st = status?.agents[a.id] ?? null;
    let state: DisplayState;
    if (!st) {
      state = a.planned ? 'planned' : 'idle';
    } else {
      state = st.state;
      // "done" geldt maar 15 minuten; daarna gewoon wachten op de volgende run.
      if (state === 'done') {
        const t = parseTime(st.lastRunAt) ?? parseTime(status?.updatedAt);
        if (t !== null && nowMs - t > DONE_WINDOW_MS) state = 'idle';
      }
    }
    // Gelezen melding: het poppetje gaat weer zitten tot er een nieuwe melding is.
    const read = state !== 'idle' && isRead(a.id, st);
    if (read) state = 'idle';
    return { config: a, dept: depts.get(a.department)!, state, status: st, noData: !st, read };
  });
}

export function countStates(views: AgentView[]): Record<DisplayState, number> {
  const c: Record<DisplayState, number> = { working: 0, waiting: 0, done: 0, idle: 0, error: 0, paused: 0, planned: 0 };
  for (const v of views) c[v.state]++;
  return c;
}
