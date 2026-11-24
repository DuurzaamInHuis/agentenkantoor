import { AGENT_STATES, type AgentState, type AgentStatus, type EncryptedTodo, type StatusFile } from '../types';

/** Haalt status.json op met een cache-buster, zodat CDN- en browsercaches worden omzeild. */
export async function fetchStatus(url: string): Promise<StatusFile> {
  const u = new URL(url, location.href);
  u.searchParams.set('t', String(Date.now()));
  let res: Response;
  try {
    res = await fetch(u.toString(), { cache: 'no-store' });
  } catch {
    throw new Error('geen verbinding');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new Error('ongeldige JSON');
  }
  return parseStatus(raw);
}

const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const clip = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

const B64 = /^[A-Za-z0-9+/=]+$/;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEnc(e: any): EncryptedTodo | undefined {
  if (!e || e.v !== 1) return undefined;
  const iter = Number(e.iter);
  const ok = (s: unknown, max: number) => typeof s === 'string' && s.length <= max && B64.test(s);
  if (!Number.isInteger(iter) || iter < 10_000 || iter > 5_000_000) return undefined;
  if (!ok(e.salt, 64) || !ok(e.iv, 32) || !ok(e.ct, 20_000)) return undefined;
  return { v: 1, iter, salt: e.salt, iv: e.iv, ct: e.ct };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseStatus(raw: any): StatusFile {
  if (!raw || typeof raw !== 'object') throw new Error('leeg of ongeldig bestand');
  if (!isDate(raw.updatedAt)) throw new Error('"updatedAt" ontbreekt of is ongeldig');
  const agents: Record<string, AgentStatus> = {};
  if (raw.agents && typeof raw.agents === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [id, v] of Object.entries<any>(raw.agents)) {
      if (!v || !AGENT_STATES.includes(v.state)) {
        console.warn(`Status van "${id}" overgeslagen: onbekende state`, v?.state);
        continue;
      }
      const approvals = Number(v.approvalsPending);
      agents[id] = {
        state: v.state as AgentState,
        lastRunAt: isDate(v.lastRunAt) ? v.lastRunAt : undefined,
        lastRunStatus: clip(v.lastRunStatus, 20),
        nextRunAt: isDate(v.nextRunAt) ? v.nextRunAt : undefined,
        summary: clip(v.summary, 280),
        approvalsPending: Number.isFinite(approvals) ? Math.max(0, Math.floor(approvals)) : 0,
        // Alleen https-links, zodat er nooit een javascript:-link in het paneel komt.
        todo: Array.isArray(v.todo)
          ? v.todo.map((t: unknown) => clip(t, 100)).filter((t: string | undefined): t is string => !!t).slice(0, 8)
          : undefined,
        todoEnc: parseEnc(v.todoEnc),
        runUrl: typeof v.runUrl === 'string' && /^https:\/\//i.test(v.runUrl) ? v.runUrl : undefined,
      };
    }
  }
  return { updatedAt: raw.updatedAt, agents };
}
