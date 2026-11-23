import { formatCountdown, formatRunTime, humanSchedule } from '../time';
import type { AgentView } from '../types';
import { h, ROLE_LABEL, runStatusLabel, STATE_LABEL } from './labels';

/** Zijpaneel (desktop) / onderblad (telefoon) met de details van één agent. */
export class Panel {
  private el: HTMLElement;
  private lastFocus: Element | null = null;
  id: string | null = null;

  constructor(private onClose: () => void) {
    this.el = document.getElementById('panel')!;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.id) this.close();
    });
  }

  open(view: AgentView): void {
    const wasOpen = !!this.id;
    this.id = view.config.id;
    if (!wasOpen) this.lastFocus = document.activeElement;
    this.render(view);
    this.el.hidden = false;
    if (!wasOpen) (this.el.querySelector('.close') as HTMLElement | null)?.focus();
  }

  close(): void {
    this.id = null;
    this.el.hidden = true;
    (this.lastFocus as HTMLElement | null)?.focus?.();
    this.onClose();
  }

  render(v: AgentView): void {
    const a = v.config;
    const s = v.status;
    const c = v.dept.colors;
    const last = s?.lastRunAt
      ? `${formatRunTime(s.lastRunAt)}${s.lastRunStatus ? ` · ${runStatusLabel(s.lastRunStatus)}` : ''}`
      : '—';
    const failed = s?.lastRunStatus === 'failed';
    const next = s?.nextRunAt ? formatRunTime(s.nextRunAt) : '—';
    const countdown = s?.nextRunAt ? formatCountdown(s.nextRunAt) : '';

    const body = h(
      'div',
      { class: 'panel-inner' },
      h(
        'header',
        { class: 'panel-head', style: `--dept:${c.main};--dept-accent:${c.accent}` },
        h('div', {}, h('p', { class: 'dept-chip' }, v.dept.name), h('h2', { id: 'panel-title' }, a.name)),
        h('button', { class: 'close', type: 'button', 'aria-label': 'Paneel sluiten' }, '×'),
      ),
      h('p', { class: `state-pill s-${v.state}` }, h('span', { class: 'dot', 'aria-hidden': 'true' }), STATE_LABEL[v.state]),
      h('p', { class: 'desc' }, a.description || ROLE_LABEL[a.role] || ''),
      v.noData && v.state !== 'planned' ? h('p', { class: 'nodata' }, 'Geen data: deze agent staat (nog) niet in status.json.') : null,
      h(
        'dl',
        { class: 'facts' },
        h('dt', {}, 'Schema'),
        h('dd', {}, humanSchedule(a.schedule)),
        h('dt', {}, 'Laatste run'),
        h('dd', { class: failed ? 'bad' : '' }, last),
        h('dt', {}, 'Volgende run'),
        h('dd', {}, next, countdown ? h('span', { class: 'countdown' }, ` (${countdown})`) : null),
        h('dt', {}, 'Open goedkeuringen'),
        h('dd', { class: s && s.approvalsPending > 0 ? 'warn' : '' }, String(s?.approvalsPending ?? 0)),
      ),
      h('h3', {}, 'Laatste samenvatting'),
      h('p', { class: 'summary' }, s?.summary ?? 'Nog geen samenvatting.'),
      s?.runUrl
        ? h('a', { class: 'btn primary', href: s.runUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open laatste run')
        : h('button', { class: 'btn primary', type: 'button', disabled: true }, 'Open laatste run'),
    );
    body.querySelector('.close')!.addEventListener('click', () => this.close());
    const focused = this.el.contains(document.activeElement) ? (document.activeElement as HTMLElement).className : null;
    this.el.replaceChildren(body);
    if (focused) (body.querySelector(`.${focused.split(' ')[0]}`) as HTMLElement | null)?.focus();
  }

  /** Alleen het aftellen bijwerken (elke seconde), zonder het paneel opnieuw op te bouwen. */
  tick(v: AgentView): void {
    const el = this.el.querySelector('.countdown');
    if (el && v.status?.nextRunAt) el.textContent = ` (${formatCountdown(v.status.nextRunAt)})`;
  }
}
