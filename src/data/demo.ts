import type { AgentConfig, AgentState, AgentStatus, OfficeConfig, StatusFile } from '../types';

/** Nepdata zodat het kantoor leeft zonder echte status. Bevat nooit klantgegevens. */
const SUMMARIES: Record<string, string[]> = {
  planning: ['Weekplanning klaar: 5 posts ingepland.', 'Geen weermoment vandaag, niets ingepland.', '2 posts klaargezet, wachten op akkoord.'],
  ads: ['Kosten per lead gedaald naar € 18,40; budget ongewijzigd.', 'Campagne spouwmuur presteert 22% beter dan vorige week.', 'Advertentieset met hoge frequentie gemarkeerd.'],
  weer: ['Koude nacht verwacht: isolatiepost voorgesteld.', 'Geen bijzonder weer de komende 3 dagen.'],
  content: ['3 conceptteksten geschreven, wachten op review.', 'Blog over vloerisolatie in concept klaar.'],
  seo: ["4 pagina's gecontroleerd, 1 ontbrekende metabeschrijving.", 'Posities stabiel; 2 zoekwoorden gestegen.'],
  reviews: ['2 nieuwe reviews (5 en 4 sterren), antwoorden klaargezet.', 'Geen nieuwe reviews.'],
  opvolging: ['6 leads gecheckt, 2 herinneringen verstuurd.', 'Belritme op schema, niets te doen.'],
  briefing: ['Dagelijkse briefing verstuurd.', 'Weekrapport klaar en verstuurd.'],
  taken: ['Dashboard ververst: 2 nieuwe opdrachten, 4 open taken.', 'Dashboard ververst, niets nieuws in de bronbestanden.'],
  realtime: ['Nieuwe lead verwerkt en ingedeeld.', 'Lead-flow draait, geen achterstand.'],
};
const ERRORS = ['Run mislukt: verbinding met de bron verliep (time-out).', 'Run mislukt: toegang tot de koppeling verlopen.'];
const DEMO_TODO = ['Lead spouwmuurisolatie nabellen (deadline vandaag)', 'Offerte vloerisolatie versturen', 'Energielabel-opname inplannen', 'ISDE-aanvraag afronden'];
const WAITING = ['Wacht op jouw akkoord voor de geplande posts.', 'Vraag voor Kelvin: welk budget voor volgende week?'];

const FROM_WORKING: [AgentState, number][] = [['done', 50], ['waiting', 22], ['error', 10], ['idle', 18]];
const FROM_OTHER: [AgentState, number][] = [['working', 46], ['idle', 28], ['waiting', 9], ['error', 7], ['paused', 5], ['done', 5]];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
function weighted(list: [AgentState, number][]): AgentState {
  let r = Math.random() * list.reduce((s, [, w]) => s + w, 0);
  for (const [s, w] of list) if ((r -= w) < 0) return s;
  return list[0][0];
}

export class DemoSource {
  private agents: Record<string, AgentStatus> = {};
  private vacant = new Set<string>();

  constructor(config: OfficeConfig, private clock: () => number) {
    this.setConfig(config);
  }

  /** Nieuwe of gewijzigde config: bestaande nepstand blijft, nieuwe agents krijgen er een. */
  setConfig(config: OfficeConfig): void {
    // Laat een paar geplande bureaus leeg, zodat je ook het "Vacature"-bordje ziet.
    const planned = config.agents.filter((a) => a.planned);
    this.vacant = new Set(planned.filter((_, i) => i % 4 === 3).map((a) => a.id));
    const start: AgentState[] = ['working', 'waiting', 'idle', 'error', 'working', 'done', 'idle', 'paused', 'working', 'idle'];
    const next: Record<string, AgentStatus> = {};
    config.agents.forEach((a, i) => {
      if (this.vacant.has(a.id)) return;
      next[a.id] = this.agents[a.id] ?? this.make(a, start[i % start.length]);
    });
    this.agents = next;
  }

  status(): StatusFile {
    return { updatedAt: new Date(this.clock()).toISOString(), agents: { ...this.agents } };
  }

  /** Laat één agent van status wisselen. */
  tick(config: OfficeConfig): void {
    const ids = Object.keys(this.agents);
    if (!ids.length) return;
    const id = pick(ids);
    const agent = config.agents.find((a) => a.id === id);
    if (!agent) return;
    const cur = this.agents[id].state;
    let nextState = weighted(cur === 'working' ? FROM_WORKING : FROM_OTHER);
    if (nextState === cur) nextState = cur === 'idle' ? 'working' : 'idle';
    this.agents[id] = this.make(agent, nextState, this.agents[id]);
  }

  private make(a: AgentConfig, state: AgentState, prev?: AgentStatus): AgentStatus {
    const now = this.clock();
    const iso = (ms: number) => new Date(ms).toISOString();
    const summaries = SUMMARIES[a.role] ?? SUMMARIES.content;
    const s: AgentStatus = {
      state,
      lastRunAt: prev?.lastRunAt ?? iso(now - (30 + Math.random() * 600) * 60_000),
      lastRunStatus: prev?.lastRunStatus ?? 'succeeded',
      nextRunAt: iso(now + (10 + Math.random() * 1200) * 60_000),
      summary: prev?.summary ?? pick(summaries),
      approvalsPending: 0,
      runUrl: 'https://claude.ai/',
    };
    if (state === 'done') {
      s.lastRunAt = iso(now - Math.random() * 120_000);
      s.lastRunStatus = 'succeeded';
      s.summary = pick(summaries);
    } else if (state === 'error') {
      s.lastRunAt = iso(now - Math.random() * 600_000);
      s.lastRunStatus = 'failed';
      s.summary = pick(ERRORS);
    } else if (state === 'waiting') {
      s.approvalsPending = 1 + Math.floor(Math.random() * 3);
      s.summary = pick(WAITING);
      if (a.role === 'taken') {
        s.todo = DEMO_TODO.slice(0, s.approvalsPending + 1);
        s.approvalsPending = s.todo.length;
        s.summary = `${s.todo.length} urgente taken voor vandaag.`;
      }
    }
    if (a.id === 'casoleo-instagram' || a.id === 'dih-instagram') {
      const day = 86_400_000;
      s.posts = [
        { at: iso(now + 0.3 * day), state: 'scheduled', kind: 'video', title: 'IBI-korting met zonnepanelen aan de Costa Blanca' },
        { at: iso(now + 1.2 * day), state: 'scheduled', kind: 'carrousel', title: 'Je Spaanse stroomrekening ontleed' },
        { at: iso(now + 3.1 * day), state: 'draft', kind: 'video', title: 'Zonnepanelen zonder Spaans te spreken' },
      ];
    }
    if (state === 'working') {
      s.lastRunStatus = 'running';
      s.lastRunAt = iso(now - Math.random() * 60_000);
      s.nextRunAt = undefined;
    } else if (state === 'paused') {
      s.nextRunAt = undefined;
    }
    return s;
  }
}
