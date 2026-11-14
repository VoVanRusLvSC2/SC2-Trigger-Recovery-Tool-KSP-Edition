/** A UI capability describes a real backend, never a promised future converter. */
export interface RecoveryField {
  key: string;
  label: string;
  required?: boolean;
  picker?: 'map' | 'folder' | 'json' | 'output';
  initial?: string;
  help?: string;
}
export interface RecoveryAdapter {
  id: string;
  title: string;
  description: string;
  fields: RecoveryField[];
}
export interface RecoveryRequest {
  adapter: string;
  fields: Record<string, string>;
  fullGui: boolean;
}
export interface Artifact {
  id: string;
  title: string;
  kind: 'script' | 'markup' | 'report' | 'archive';
}
export interface DocumentPreview {
  name: string;
  source: string;
  markup: string;
  hasAttributes: boolean;
  suggestedOutput: string;
}
export interface JobSnapshot {
  phase: 'idle' | 'running' | 'finished' | 'failed' | 'cancelled';
  log: string;
  exitCode?: number;
  output?: string;
  artifacts: Artifact[];
  result?: unknown;
  request?: RecoveryRequest;
}
