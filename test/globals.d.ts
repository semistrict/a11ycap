interface DevToolsHook {
  renderers: Map<number, any>;
  supportsFiber: boolean;

  inject(renderer: any): number;
  onCommitFiberRoot(
    rendererID: number,
    root: any,
    priorityLevel: number,
    didError: boolean
  ): void;
  onCommitFiberUnmount(rendererID: number, fiber: any): void;

  getFiberRoots(rendererID: number): Set<any>;
  // Optional extras
  sub?: any;
  emit?: (event: string, data?: any) => void;
  // etc.
}

declare global {
  interface Window {
    testReady?: boolean;
    snapshot: (
      element: Element,
      options?: {
        mode?: 'ai' | 'expect' | 'codegen' | 'autoexpect';
        enableReact?: boolean;
        refPrefix?: string;
      }
    ) => Promise<string>;
    snapshotForAI: (
      element: Element,
      options?: { enableReact?: boolean; refPrefix?: string }
    ) => Promise<string>;
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook;
  }
}

export {};
