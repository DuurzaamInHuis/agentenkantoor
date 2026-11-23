import type { AgentConfig, Department, OfficeConfig } from '../types';

const HEX = /^#[0-9a-f]{6}$/i;

export async function loadConfig(): Promise<OfficeConfig> {
  const url = `${import.meta.env.BASE_URL}agents.config.json?t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`agents.config.json kon niet geladen worden (HTTP ${res.status})`);
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new Error('agents.config.json is geen geldige JSON');
  }
  return parseConfig(raw);
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const hex = (v: unknown, fallback: string): string => (typeof v === 'string' && HEX.test(v) ? v : fallback);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseConfig(raw: any): OfficeConfig {
  if (!raw || !Array.isArray(raw.departments) || !Array.isArray(raw.agents)) {
    throw new Error('agents.config.json mist "departments" of "agents"');
  }
  const departments: Department[] = [];
  for (const d of raw.departments) {
    if (!d || !str(d.id) || !str(d.name)) {
      console.warn('Afdeling overgeslagen (id of name ontbreekt):', d);
      continue;
    }
    departments.push({
      id: d.id,
      name: d.name,
      colors: {
        main: hex(d.colors?.main, '#777777'),
        accent: hex(d.colors?.accent, '#cccccc'),
        accent2: HEX.test(d.colors?.accent2 ?? '') ? d.colors.accent2 : undefined,
      },
    });
  }
  const deptIds = new Set(departments.map((d) => d.id));
  const seen = new Set<string>();
  const agents: AgentConfig[] = [];
  for (const a of raw.agents) {
    if (!a || !str(a.id) || !str(a.name) || !deptIds.has(a.department) || seen.has(a.id)) {
      console.warn('Agent overgeslagen (ontbrekend id/naam, onbekende afdeling of dubbel id):', a);
      continue;
    }
    seen.add(a.id);
    agents.push({
      id: a.id,
      name: a.name,
      shortName: str(a.shortName),
      department: a.department,
      role: str(a.role) ?? 'content',
      description: str(a.description) ?? '',
      schedule: str(a.schedule) ?? '',
      triggerName: str(a.triggerName) ?? '',
      triggerMatch: a.triggerMatch === 'prefix' ? 'prefix' : 'exact',
      planned: a.planned === true,
    });
  }
  return { departments, agents };
}
