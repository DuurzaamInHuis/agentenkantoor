import './style.css';
import { MAX_FPS } from './config';
import { refreshNow, startData } from './data/controller';
import { deriveViews, Store } from './data/store';
import { OfficeView } from './render/renderer';
import { initClock, now } from './time';
import type { AgentView } from './types';
import { renderList } from './ui/listView';
import { Panel } from './ui/panel';
import { renderNotice, renderTopbar } from './ui/topbar';
import { loadWorkflows, renderWorkflows, type Workflow } from './ui/workflows';

const params = new URLSearchParams(location.search);
initClock(params);

const store = new Store();
const canvas = document.getElementById('office') as HTMLCanvasElement;
const wrap = document.getElementById('office-wrap')!;
const listEl = document.getElementById('list-view')!;
const toggle = document.getElementById('toggle-view') as HTMLButtonElement;

let views: AgentView[] = [];
const viewById = (id: string) => views.find((v) => v.config.id === id);

const panel = new Panel(
  () => (office.selectedId = null),
  () => refresh(),
);
const select = (id: string) => {
  const v = viewById(id);
  if (!v) return;
  office.selectedId = id;
  panel.open(v);
};
const office = new OfficeView(canvas, wrap, select);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (import.meta.env.DEV) (window as any).__office = office;

let listMode = false;
toggle.addEventListener('click', () => {
  listMode = !listMode;
  toggle.setAttribute('aria-pressed', String(listMode));
  toggle.textContent = listMode ? 'Kantoor' : 'Lijst';
  wrap.hidden = listMode;
  listEl.hidden = !listMode;
  if (listMode) renderList(listEl, views, select);
  else office.resize();
});

// Workflow-overzicht onder het kantoor (los van de status; opnieuw geladen bij Ververs).
const wfEl = document.getElementById('workflows')!;
let workflows: Workflow[] = [];
let wfKey = '';
function drawWorkflows(): void {
  const key = JSON.stringify([workflows, store.state.config]);
  if (key === wfKey) return;
  wfKey = key;
  renderWorkflows(wfEl, workflows, store.state.config, select);
}
async function reloadWorkflows(): Promise<void> {
  try {
    workflows = await loadWorkflows();
    drawWorkflows();
  } catch (e) {
    console.warn('Workflows laden mislukt.', e);
  }
}
void reloadWorkflows();

const refreshBtn = document.getElementById('refresh') as HTMLButtonElement;
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Bezig…';
  try {
    await Promise.all([refreshNow(), reloadWorkflows()]);
  } finally {
    refreshBtn.textContent = 'Ververs';
    refreshBtn.disabled = false;
  }
});

let hadStatus = false;
function refresh(): void {
  const s = store.state;
  views = s.config ? deriveViews(s.config, s.status, now()) : [];
  office.demo = s.mode === 'demo';
  const fresh = !!s.status && !hadStatus;
  hadStatus = !!s.status;
  if (s.config) office.setData(s.config, views, fresh);
  renderTopbar(s, views);
  renderNotice(s);
  drawWorkflows();
  if (listMode) renderList(listEl, views, select);
  if (panel.id) {
    const v = viewById(panel.id);
    if (v) panel.render(v);
    else panel.close();
  }
}
store.subscribe(refresh);

// Elke seconde: klok, aftellen in het paneel, en "done" laten vervallen na 15 min.
setInterval(() => {
  const s = store.state;
  if (!s.config) return;
  views = deriveViews(s.config, s.status, now());
  office.setData(s.config, views);
  renderTopbar(s, views);
  if (panel.id) {
    const v = viewById(panel.id);
    if (v) panel.tick(v);
  }
}, 1000);
setInterval(() => listMode && renderList(listEl, views, select), 30_000);

// Animatielus: max 30 fps, gepauzeerd als het tabblad verborgen is.
let raf = 0;
let last = performance.now();
const minFrame = 1000 / MAX_FPS - 1;
function loop(ts: number): void {
  raf = requestAnimationFrame(loop);
  const dt = ts - last;
  if (dt < minFrame) return;
  last = ts;
  if (!listMode) office.frame(Math.min(dt, 100) / 1000);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
});
raf = requestAnimationFrame(loop);

startData(store, params);
