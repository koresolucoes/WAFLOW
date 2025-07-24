
import { Automation, AutomationNode, BackendEdge } from '../types.js';

/**
 * Garante que um objeto de automação recuperado do banco de dados tenha uma estrutura segura,
 * convertendo `nodes` e `edges` nulos em arrays vazios. Isso previne erros no motor de execução
 * que espera que essas propriedades sejam sempre iteráveis.
 * @param automation O objeto de automação bruto do Supabase.
 * @returns Um objeto de automação sanitizado e seguro para uso.
 */
export const sanitizeAutomation = (automation: any): Automation => {
    // A automação já está bem tipada e não precisa de mais conversões
    if (automation && Array.isArray(automation.nodes) && Array.isArray(automation.edges)) {
        return automation as Automation;
    }

    // Se os dados estiverem ausentes ou nulos, inicialize-os como arrays vazios.
    const nodes = (Array.isArray(automation.nodes) ? automation.nodes : []) as AutomationNode[];
    const edges = (Array.isArray(automation.edges) ? automation.edges : []) as BackendEdge[];

    return {
        ...automation,
        nodes,
        edges,
    } as Automation;
};
