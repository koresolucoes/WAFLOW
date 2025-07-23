
import { AutomationNode } from '../types.js';

// Defines the names of available hooks in the execution lifecycle.
export type HookName =
  | 'workflowExecuteBefore'
  | 'workflowExecuteAfter'
  | 'nodeExecuteBefore'
  | 'nodeExecuteAfter';

// Defines the function signatures for each hook.
export type HookHandlers = {
  workflowExecuteBefore: Array<() => Promise<void> | void>;
  workflowExecuteAfter: Array<(status: 'success' | 'failed', details: string) => Promise<void> | void>;
  nodeExecuteBefore: Array<(node: AutomationNode) => Promise<void> | void>;
  nodeExecuteAfter: Array<(node: AutomationNode, status: 'success' | 'failed', details: string) => Promise<void> | void>;
};

/**
 * Manages hooks that trigger at specific events in an execution's lifecycle.
 * This class allows decoupling the execution engine from side effects like logging,
 * metrics, or external notifications.
 */
export class ExecutionLifecycleHooks {
  private readonly handlers: HookHandlers = {
    workflowExecuteBefore: [],
    workflowExecuteAfter: [],
    nodeExecuteBefore: [],
    nodeExecuteAfter: [],
  };

  /**
   * Registers one or more handler functions for a specific hook.
   * @param hookName The name of the hook to attach the handlers to.
   * @param handlers The callback functions to execute when the hook is triggered.
   */
  public addHandler<H extends HookName>(hookName: H, ...handlers: HookHandlers[H]): void {
    (this.handlers[hookName] as any[]).push(...handlers);
  }

  /**
   * Executes all registered handlers for a given hook.
   * @param hookName The name of the hook to run.
   * @param params The parameters to pass to the hook handlers.
   */
  public async runHook<H extends HookName, P extends unknown[] = Parameters<HookHandlers[H][number]>>(
    hookName: H,
    ...params: P
  ): Promise<void> {
    const hookFunctions = this.handlers[hookName];
    for (const hookFunction of hookFunctions) {
      try {
        await (hookFunction as any)(...params);
      } catch (error) {
        console.error(`Error executing hook "${hookName}":`, error);
        // We log the error but don't re-throw to allow other hooks and the main execution to continue.
      }
    }
  }
}
