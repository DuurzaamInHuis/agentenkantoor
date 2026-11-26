import type { OfficeConfig } from '../types';
import { h } from './labels';

export interface WorkflowStep {
  /** Agent-id uit agents.config.json, of een persoon ("Jij", "Jordan", "Kantoor"). */
  who: string;
  when: string;
  does: string;
  approval?: string;
  result?: string;
}

export interface Workflow {
  id: string;
  department: string;
  title: string;
  needs?: string;
  note?: string;
  steps: WorkflowStep[];
}

const str = (v: unknown, max = 400): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

/** Leest public/workflows.json. Mislukt dat, dan blijft het overzicht gewoon leeg. */
export async function loadWorkflows(): Promise<Workflow[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}workflows.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`workflows.json: HTTP ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = await res.json();
  const out: Workflow[] = [];
  for (const w of Array.isArray(raw?.workflows) ? raw.workflows : []) {
    const title = str(w?.title, 120);
    const steps: WorkflowStep[] = [];
    for (const s of Array.isArray(w?.steps) ? w.steps : []) {
      const who = str(s?.who, 60);
      const does = str(s?.does);
      if (!who || !does) continue;
      steps.push({ who, does, when: str(s.when, 80) ?? '', approval: str(s.approval), result: str(s.result) });
    }
    if (!title || !steps.length) continue;
    out.push({
      id: str(w.id, 60) ?? title,
      department: str(w.department, 60) ?? '',
      title,
      needs: str(w.needs),
      note: str(w.note),
      steps,
    });
  }
  return out;
}

/** Tekent het workflow-overzicht onder het kantoor. Een klik op een agent opent zijn paneel. */
export function renderWorkflows(
  el: HTMLElement,
  flows: Workflow[],
  config: OfficeConfig | null,
  onAgent: (id: string) => void,
): void {
  if (!flows.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const depts = config?.departments ?? [];
  const agents = config?.agents ?? [];
  const order = (d: string) => {
    const i = depts.findIndex((x) => x.id === d);
    return i < 0 ? 99 : i;
  };
  const sorted = [...flows].sort((a, b) => order(a.department) - order(b.department));

  const who = (s: WorkflowStep, color: string) => {
    const a = agents.find((x) => x.id === s.who);
    if (a) {
      const b = h('button', { class: 'wf-who agent', type: 'button', style: `--dept:${color}`, title: `Open ${a.name}` }, a.name);
      b.addEventListener('click', () => onAgent(a.id));
      return b;
    }
    return h('span', { class: `wf-who ${s.who === 'Jij' ? 'you' : 'person'}` }, s.who);
  };

  const card = (w: Workflow) => {
    const dept = depts.find((d) => d.id === w.department);
    const color = dept?.colors.main ?? '#8a8f98';
    return h(
      'article',
      { class: 'wf-card', style: `--dept:${color};--dept-accent:${dept?.colors.accent ?? color}` },
      h('header', { class: 'wf-head' }, h('p', { class: 'dept-chip' }, dept?.name ?? w.department), h('h3', {}, w.title)),
      w.needs ? h('p', { class: 'wf-needs' }, 'Voorwaarde: ', w.needs) : null,
      h(
        'ol',
        { class: 'wf-steps' },
        ...w.steps.map((s) =>
          h(
            'li',
            {},
            h('div', { class: 'wf-line' }, who(s, color), s.when ? h('span', { class: 'wf-when' }, s.when) : null),
            h('p', { class: 'wf-does' }, s.does),
            s.approval ? h('p', { class: 'wf-approval' }, h('strong', {}, 'Jouw akkoord: '), s.approval) : null,
            s.result ? h('p', { class: 'wf-result' }, '→ ', s.result) : null,
          ),
        ),
      ),
      w.note ? h('p', { class: 'wf-note' }, w.note) : null,
    );
  };

  el.replaceChildren(
    h(
      'div',
      { class: 'wf-intro' },
      h('h2', { id: 'wf-title' }, 'Workflows'),
      h('p', {}, 'Welke agents elkaar werk doorgeven, in welke volgorde, en waar jij goedkeurt.'),
    ),
    h('div', { class: 'wf-grid' }, ...sorted.map(card)),
  );
}
