import { formatCountdown, formatRunTime, humanSchedule } from '../time';
import type { AgentView } from '../types';
import { h, runStatusLabel, STATE_LABEL } from './labels';

/** Tabelweergave van dezelfde informatie: snel scannen en toegankelijk. */
export function renderList(el: HTMLElement, views: AgentView[], onSelect: (id: string) => void): void {
  const rows = views.map((v) => {
    const s = v.status;
    return h(
      'tr',
      { class: `row s-${v.state}` },
      h('th', { scope: 'row' }, h('button', { type: 'button', class: 'linkish', 'data-id': v.config.id }, v.config.name)),
      h('td', {}, h('span', { class: 'dept-dot', style: `background:${v.dept.colors.main}`, 'aria-hidden': 'true' }), v.dept.name),
      h('td', {}, h('span', { class: `state-pill s-${v.state}` }, h('span', { class: 'dot', 'aria-hidden': 'true' }), STATE_LABEL[v.state])),
      h('td', {}, humanSchedule(v.config.schedule)),
      h('td', { class: s?.lastRunStatus === 'failed' ? 'bad' : '' }, s?.lastRunAt ? `${formatRunTime(s.lastRunAt)} · ${runStatusLabel(s.lastRunStatus)}` : '—'),
      h('td', {}, s?.nextRunAt ? `${formatRunTime(s.nextRunAt)} (${formatCountdown(s.nextRunAt)})` : '—'),
      h('td', { class: `num ${s && s.approvalsPending > 0 ? 'warn' : ''}` }, String(s?.approvalsPending ?? 0)),
      h('td', { class: 'sum' }, s?.summary ?? (v.noData ? 'geen data' : '')),
    );
  });
  const table = h(
    'table',
    {},
    h('caption', {}, 'Alle agents en hun status'),
    h(
      'thead',
      {},
      h('tr', {}, ...['Agent', 'Afdeling', 'Status', 'Schema', 'Laatste run', 'Volgende run', 'Goedkeuringen', 'Samenvatting'].map((t) => h('th', { scope: 'col' }, t))),
    ),
    h('tbody', {}, ...rows),
  );
  const wrap = h('div', { class: 'table-wrap' }, table);
  wrap.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest('button[data-id]')?.getAttribute('data-id');
    if (id) onSelect(id);
  });
  el.replaceChildren(wrap);
}
