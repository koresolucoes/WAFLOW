
import { ActionHandler } from '../types.js';
import { getValueFromPath, resolveVariables } from '../helpers.js';

export const condition: ActionHandler = async ({ contact, node, trigger }) => {
    const config = (node.data.config || {}) as any;
    const fieldPath = config.field ? config.field.replace(/\{\{|\}\}/g, '') : '';
    const operator = config.operator;
    const value = resolveVariables(config.value, { contact, trigger });
    
    const context = { contact, trigger };
    const sourceValue = getValueFromPath(context, fieldPath);

    let conditionMet = false;
    const lowerCaseValue = String(value).toLowerCase();
    
    if (Array.isArray(sourceValue)) {
        const lowerCaseArray = sourceValue.map(v => String(v).toLowerCase());
        if (operator === 'contains') {
            conditionMet = lowerCaseArray.includes(lowerCaseValue);
        } else if (operator === 'not_contains') {
            conditionMet = !lowerCaseArray.includes(lowerCaseValue);
        } else if (operator === 'equals') {
             conditionMet = lowerCaseArray.includes(lowerCaseValue);
        }
    } else {
        const lowerCaseSourceValue = String(sourceValue ?? '').toLowerCase();
        if (operator === 'contains') {
            conditionMet = lowerCaseSourceValue.includes(lowerCaseValue);
        } else if (operator === 'not_contains') {
             conditionMet = !lowerCaseSourceValue.includes(lowerCaseValue);
        } else if (operator === 'equals') {
            conditionMet = lowerCaseSourceValue === lowerCaseValue;
        }
    }
    
    const details = `Condição avaliada: '${fieldPath}' (${sourceValue}) ${operator} '${value}'. Resultado: ${conditionMet ? 'Sim' : 'Não'}`;
    return { nextNodeHandle: conditionMet ? 'yes' : 'no', details };
};

export const splitPath: ActionHandler = async () => {
    const path = Math.random() < 0.5 ? 'a' : 'b';
    return { nextNodeHandle: path, details: `Caminho dividido aleatoriamente para a Via ${path.toUpperCase()}.` };
};
