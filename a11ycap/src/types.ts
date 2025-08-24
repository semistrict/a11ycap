// Re-export types from the local ariaSnapshot
export type { AriaNode, AriaSnapshot, AriaTreeOptions } from './ariaSnapshot';

export interface SnapshotOptions {
  timeout?: number;
  refPrefix?: string;
}

export interface SnapshotResult {
  snapshot: string;
}
