export type AgentState = 'working' | 'waiting' | 'done' | 'idle' | 'error' | 'paused';
export type DisplayState = AgentState | 'planned';

export const AGENT_STATES: readonly AgentState[] = ['working', 'waiting', 'done', 'idle', 'error', 'paused'];

export interface DeptColors {
  main: string;
  accent: string;
  accent2?: string;
}

export interface Department {
  id: string;
  name: string;
  colors: DeptColors;
}

export interface AgentConfig {
  id: string;
  name: string;
  /** Optioneel: kortere naam voor het naambordje op het bureau. */
  shortName?: string;
  department: string;
  role: string;
  description: string;
  schedule: string;
  triggerName: string;
  triggerMatch: 'exact' | 'prefix';
  planned: boolean;
}

export interface OfficeConfig {
  departments: Department[];
  agents: AgentConfig[];
}

export interface AgentStatus {
  state: AgentState;
  lastRunAt?: string;
  lastRunStatus?: string;
  nextRunAt?: string;
  summary?: string;
  approvalsPending: number;
  runUrl?: string;
}

export interface StatusFile {
  updatedAt: string;
  agents: Record<string, AgentStatus>;
}

/** Samengevoegde stand van één agent: config + status, klaar om te tonen. */
export interface AgentView {
  config: AgentConfig;
  dept: Department;
  state: DisplayState;
  status: AgentStatus | null;
  noData: boolean;
}
