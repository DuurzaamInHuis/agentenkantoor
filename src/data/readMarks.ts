import { TIMEZONE } from '../config';
import { now } from '../time';
import type { AgentState, AgentStatus } from '../types';

/**
 * "Gelezen"-markeringen per agent, alleen op dit apparaat (localStorage).
 * Een markering hoort bij één melding: verandert de melding (state, run of aantal
 * openstaande punten, of een nieuwe dag bij een takenlijst), dan staat het poppetje weer op.
 */

const KEY = 'agentenkantoor-gelezen';
/** Staten waarbij het poppetje opstaat en om aandacht vraagt. */
export const NOTIFY_STATES: readonly AgentState[] = ['waiting', 'done', 'error'];

let marks: Record<string, string> = load();

function load(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}
function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(marks));
  } catch {
    /* privévenster: markering geldt dan alleen tot herladen */
  }
}

/**
 * Wat telt als "dezelfde melding". Bewust zonder de samenvattingstekst: de status-agent
 * formuleert die elk uur opnieuw, en dan zou het poppetje steeds weer opstaan.
 * Een takenlijst (todo) telt per dag: de volgende ochtend is het een nieuwe melding.
 */
export function signature(st: AgentStatus): string {
  const day = st.todo?.length || st.todoEnc ? DAY.format(now()) : '';
  return [st.state, st.lastRunAt ?? '', st.lastRunStatus ?? '', st.approvalsPending, day].join('§');
}
const DAY = new Intl.DateTimeFormat('nl-NL', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export function isRead(id: string, st: AgentStatus | null): boolean {
  return !!st && NOTIFY_STATES.includes(st.state) && marks[id] === signature(st);
}

export function markRead(id: string, st: AgentStatus): void {
  marks[id] = signature(st);
  save();
}

export function markUnread(id: string): void {
  delete marks[id];
  save();
}
