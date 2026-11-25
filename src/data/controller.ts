import { CONFIG_REFRESH_MS, DEMO_TICK_MS, REFRESH_MS, STATUS_URL } from '../config';
import { now } from '../time';
import { loadConfig } from './configLoader';
import { DemoSource } from './demo';
import { fetchStatus } from './statusSource';
import type { Store } from './store';

/**
 * Start de datalaag:
 *  - demo-modus bij ?demo=1 of als STATUS_URL leeg is;
 *  - anders status.json elke 60 s ophalen; bij een fout blijft de laatste stand staan.
 * Met ?status=/data/status.json kun je lokaal een bestand op dezelfde server testen.
 */
/** Handmatig verversen (knop in de topbalk): config en status meteen opnieuw ophalen. */
let manual: (() => Promise<void>) | null = null;
export function refreshNow(): Promise<void> {
  return manual ? manual() : Promise.resolve();
}

export async function startData(store: Store, params: URLSearchParams): Promise<void> {
  const url = statusUrl(params);
  const demoMode = params.get('demo') === '1' || !url;
  store.update({ mode: demoMode ? 'demo' : 'live' });

  try {
    store.update({ config: await loadConfig(), fatal: null });
  } catch (e) {
    store.update({ fatal: (e as Error).message });
    return;
  }

  let demo: DemoSource | null = null;

  // Config periodiek opnieuw lezen: een nieuw bureau verschijnt dan vanzelf.
  const reloadConfig = async () => {
    try {
      const cfg = await loadConfig();
      if (JSON.stringify(cfg) !== JSON.stringify(store.state.config)) {
        demo?.setConfig(cfg);
        store.update({ config: cfg, ...(demo ? { status: demo.status() } : {}) });
      }
    } catch (e) {
      console.warn('Config opnieuw laden mislukt; oude config blijft staan.', e);
    }
  };
  setInterval(reloadConfig, CONFIG_REFRESH_MS);
  manual = reloadConfig;

  if (demoMode) {
    demo = new DemoSource(store.state.config!, now);
    store.update({ status: demo.status(), lastSuccessAt: now(), fetchError: null });
    setInterval(() => {
      demo!.tick(store.state.config!);
      store.update({ status: demo!.status(), lastSuccessAt: now() });
    }, DEMO_TICK_MS);
    return;
  }

  let busy = false;
  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const status = await fetchStatus(url!);
      store.update({ status, lastSuccessAt: Date.now(), fetchError: null });
    } catch (e) {
      // Laatste stand blijft staan; alleen een melding.
      store.update({ fetchError: (e as Error).message });
    } finally {
      busy = false;
    }
  };
  manual = async () => {
    await Promise.all([reloadConfig(), poll()]);
  };
  await poll();
  setInterval(poll, REFRESH_MS);
  // Na terugkeer naar het tabblad meteen verversen als de data oud is.
  document.addEventListener('visibilitychange', () => {
    const last = store.state.lastSuccessAt ?? 0;
    if (!document.hidden && Date.now() - last > REFRESH_MS) poll();
  });
}

function statusUrl(params: URLSearchParams): string | null {
  const override = params.get('status');
  if (override) {
    try {
      const u = new URL(override, location.href);
      if (u.origin === location.origin) return u.toString();
      console.warn('?status= mag alleen naar dezelfde server wijzen; genegeerd.');
    } catch {
      /* ongeldige URL: negeren */
    }
  }
  return STATUS_URL || null;
}
