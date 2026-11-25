import { formatCountdown, formatRunTime, humanSchedule } from '../time';
import type { AgentView, PlannedPost } from '../types';
import { cached, decryptTodo, getPass, setPass } from '../data/crypto';
import { markRead, markUnread, NOTIFY_STATES } from '../data/readMarks';
import { h, ROLE_LABEL, runStatusLabel, STATE_LABEL } from './labels';

const KIND_LABEL: Record<PlannedPost['kind'], string> = { video: 'Video', carrousel: 'Carrousel', foto: 'Foto' };

/** Zijpaneel (desktop) / onderblad (telefoon) met de details van één agent. */
export class Panel {
  private el: HTMLElement;
  private lastFocus: Element | null = null;
  id: string | null = null;
  private view: AgentView | null = null;
  private unlockError = '';
  /** Welk agent-id het post-overzicht open heeft (blijft open bij het verversen). */
  private postsOpenFor: string | null = null;

  constructor(
    private onClose: () => void,
    /** Na "Gelezen" of "Ongedaan maken": alles opnieuw afleiden en tekenen. */
    private onReadChange: () => void,
  ) {
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
    this.view = v;
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
      h(
        'div',
        { class: 'state-row' },
        h('p', { class: `state-pill s-${v.state}` }, h('span', { class: 'dot', 'aria-hidden': 'true' }), STATE_LABEL[v.state]),
        s && NOTIFY_STATES.includes(s.state) && !v.read
          ? h('button', { class: 'btn read-btn', type: 'button' }, 'Gelezen')
          : null,
        v.read ? h('span', { class: 'read-note' }, 'Gelezen · ', h('button', { class: 'linkish undo-read', type: 'button' }, 'ongedaan maken')) : null,
      ),
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
      this.todoSection(v),
      this.postsSection(v),
      h('h3', {}, 'Laatste samenvatting'),
      h('p', { class: 'summary' }, s?.summary ?? 'Nog geen samenvatting.'),
      s?.runUrl
        ? h('a', { class: 'btn primary', href: s.runUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open laatste run')
        : h('button', { class: 'btn primary', type: 'button', disabled: true }, 'Open laatste run'),
    );
    body.querySelector('.close')!.addEventListener('click', () => this.close());
    body.querySelector('.read-btn')?.addEventListener('click', () => {
      if (s) markRead(a.id, s);
      this.onReadChange();
    });
    body.querySelector('.posts-toggle')?.addEventListener('click', () => {
      this.postsOpenFor = this.postsOpenFor === a.id ? null : a.id;
      this.render(v);
    });
    body.querySelector('.undo-read')?.addEventListener('click', () => {
      markUnread(a.id);
      this.onReadChange();
    });
    const focused = this.el.contains(document.activeElement) ? (document.activeElement as HTMLElement).className : null;
    this.el.replaceChildren(body);
    if (focused) (body.querySelector(`.${focused.split(' ')[0]}`) as HTMLElement | null)?.focus();
  }

  /** "Vandaag oppakken": met namen als het wachtwoord bekend is, anders de anonieme regels. */
  private todoSection(v: AgentView): HTMLElement | null {
    const s = v.status;
    const enc = s?.todoEnc;
    const pass = enc ? getPass() : null;
    const named = enc ? cached(enc) : undefined;
    if (enc && pass && !named) {
      decryptTodo(enc, pass)
        .then(() => {
          this.unlockError = '';
          if (this.id === v.config.id && this.view) this.render(this.view);
        })
        .catch(() => {
          setPass(null);
          this.unlockError = 'Onjuist wachtwoord.';
          if (this.id === v.config.id && this.view) this.render(this.view);
        });
    }
    const lines = named ?? s?.todo ?? [];
    if (!lines.length && !enc) return null;
    const sec = h('section', { class: 'todo' }, h('h3', {}, 'Vandaag oppakken'));
    if (lines.length) sec.append(h('ol', {}, ...lines.map((t) => h('li', {}, t))));
    if (enc && named) {
      const b = h('button', { class: 'linkish lock', type: 'button' }, 'Namen verbergen op dit apparaat');
      b.addEventListener('click', () => {
        setPass(null);
        this.render(v);
      });
      sec.append(b);
    } else if (enc && !pass) {
      const input = h('input', { type: 'password', class: 'pass', placeholder: 'Wachtwoord', autocomplete: 'current-password', 'aria-label': 'Wachtwoord om namen te tonen' });
      const form = h(
        'form',
        { class: 'unlock' },
        input,
        h('button', { class: 'btn', type: 'submit' }, 'Toon namen'),
      );
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = input.value.trim();
        if (!val) {
          this.unlockError = 'Vul het wachtwoord in.';
          this.render(v);
          return;
        }
        setPass(val);
        this.unlockError = '';
        this.render(v);
      });
      sec.append(form);
      if (this.unlockError) sec.append(h('p', { class: 'unlock-err', role: 'alert' }, this.unlockError));
    } else if (enc) {
      sec.append(h('p', { class: 'muted-small' }, 'Namen ontsleutelen…'));
    }
    return sec;
  }

  /** Knop "Geplande video's" met daaronder (na één klik) de komende posts uit Publora. */
  private postsSection(v: AgentView): HTMLElement | null {
    const posts = v.status?.posts;
    if (!posts) return null;
    const videos = posts.filter((p) => p.kind === 'video').length;
    const open = this.postsOpenFor === v.config.id;
    const sec = h(
      'section',
      { class: 'posts' },
      h(
        'button',
        { class: 'btn posts-toggle', type: 'button', 'aria-expanded': String(open) },
        `${open ? '▾' : '▸'} Geplande video's (${videos})`,
        posts.length > videos ? h('span', { class: 'muted-inline' }, ` + ${posts.length - videos} andere post${posts.length - videos === 1 ? '' : 's'}`) : null,
      ),
    );
    if (!open) return sec;
    if (!posts.length) {
      sec.append(h('p', { class: 'muted-small' }, 'Er staan nog geen posts klaar in Publora.'));
      return sec;
    }
    const row = (p: PlannedPost) =>
      h(
        'li',
        { class: p.kind === 'video' ? 'is-video' : '' },
        h('span', { class: 'post-when' }, p.at ? formatRunTime(p.at) : 'nog geen tijd'),
        h('span', { class: `post-tag t-${p.state}` }, p.state === 'scheduled' ? 'Ingepland' : 'Concept'),
        h('span', { class: 'post-kind' }, KIND_LABEL[p.kind]),
        h('span', { class: 'post-title' }, p.title),
      );
    sec.append(h('ul', { class: 'post-list' }, ...posts.map(row)));
    return sec;
  }

  /** Alleen het aftellen bijwerken (elke seconde), zonder het paneel opnieuw op te bouwen. */
  tick(v: AgentView): void {
    const el = this.el.querySelector('.countdown');
    if (el && v.status?.nextRunAt) el.textContent = ` (${formatCountdown(v.status.nextRunAt)})`;
  }
}
