import { STALE_AFTER_MS } from '../config';
import { countStates, type AppState } from '../data/store';
import { formatAgo, formatClock, formatDate, isClockShifted, now, parseTime } from '../time';
import type { AgentView } from '../types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Klok, datum, tellers en "status bijgewerkt". */
export function renderTopbar(state: AppState, views: AgentView[]): void {
  const t = now();
  $('clock-time').textContent = formatClock(t);
  $('clock-date').textContent = formatDate(t) + (isClockShifted() ? ' (gesimuleerd)' : '');

  const c = countStates(views);
  setCounter('c-waiting', c.waiting);
  setCounter('c-working', c.working);
  setCounter('c-error', c.error);

  const badge = $('mode-badge');
  badge.hidden = state.mode !== 'demo';

  const upd = $('updated');
  const updated = parseTime(state.status?.updatedAt);
  upd.classList.remove('stale');
  if (state.mode === 'demo') {
    upd.textContent = 'Demo-data, wisselt elke paar seconden';
  } else if (updated === null) {
    upd.textContent = state.fetchError ? 'Status niet beschikbaar' : 'Status laden…';
    upd.classList.toggle('stale', !!state.fetchError);
  } else {
    upd.textContent = `Status bijgewerkt ${formatAgo(updated)}`;
    if (Date.now() - updated > STALE_AFTER_MS) {
      upd.classList.add('stale');
      upd.title = 'De status-agent heeft al meer dan 2 uur niets weggeschreven.';
    } else upd.title = '';
  }
}

function setCounter(id: string, n: number): void {
  const el = $(id);
  el.querySelector('.num')!.textContent = String(n);
  el.classList.toggle('zero', n === 0);
}

/** Melding onder de topbalk (ophaalfout, configfout). */
export function renderNotice(state: AppState): void {
  const el = $('notice');
  let msg = '';
  if (state.fatal) msg = `Het kantoor kan niet geladen worden: ${state.fatal}`;
  else if (state.fetchError) {
    const last = parseTime(state.status?.updatedAt);
    msg = last
      ? `Status ophalen mislukt (${state.fetchError}). Je ziet de laatste stand van ${formatClock(last)}; nieuwe poging binnen een minuut.`
      : `Status ophalen mislukt (${state.fetchError}). Agents tonen "geen data"; nieuwe poging binnen een minuut.`;
  }
  el.textContent = msg;
  el.hidden = !msg;
}
