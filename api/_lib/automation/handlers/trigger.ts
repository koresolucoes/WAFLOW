
import { ActionHandler } from '../types.js';

/**
 * A generic handler for all trigger nodes. Since the trigger's job is to start
 * the workflow, this handler simply needs to acknowledge its successful execution
 * so the engine can proceed to the next connected node.
 */
export const triggerHandler: ActionHandler = async ({ node }) => {
    return { details: `Gatilho '${node.data.label}' executado com sucesso.` };
};
