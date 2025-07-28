import React, { useState, useRef, memo } from 'react';
import { AutomationNode, MessageTemplate, Profile, AutomationNodeData, Pipeline, PipelineStage } from '../../../types';


// ====================================================================================
// Common Types
// ====================================================================================
export interface NodeSettingsProps {
    node: AutomationNode;
    onConfigChange: (newConfig: any, options?: { immediate?: boolean }) => void;
    availableVariables: ReturnType<typeof getContextVariables>;
    templates: MessageTemplate[]; // For SendTemplateSettings
    allTags: string[];
    profile: Profile | null; // For TriggerSettings
    automationId?: string;
    pipelines: Pipeline[]; // For Deal settings
    stages: PipelineStage[]; // For Deal settings
}


// ====================================================================================
// Helper Functions
// ====================================================================================

const flattenObject = (obj: any, parentKey = '', result: { path: string, label: string }[] = []) => {
    if (!obj || typeof obj !== 'object') {
        return result;
    }
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const propName = parentKey ? `${parentKey}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                flattenObject(obj[key], propName, result);
            } else {
                result.push({ path: propName, label: key });
            }
        }
    }
    return result;
};


export const getContextVariables = (nodes: AutomationNode[]) => {
    let variables = [
        {
            group: 'Contato',
            vars: [
                { path: 'contact.name', label: 'Nome do Contato' },
                { path: 'contact.phone', label: 'Telefone do Contato' },
                { path: 'contact.email', label: 'Email do Contato' },
                { path: 'contact.company', label: 'Empresa do Contato' },
                { path: 'contact.tags', label: 'Tags do Contato (array)' },
                { path: 'contact.id', label: 'ID do Contato' },
                { path: 'contact.custom_fields.sua_chave', label: 'Campo Personalizado (substitua sua_chave)' },
            ],
        }
    ];

    // Adiciona variáveis genéricas para gatilhos internos da Meta
    variables.push({
        group: 'Gatilho (Meta)',
        vars: [
             { path: 'trigger.payload.text.body', label: 'Corpo da Mensagem de Texto' },
             { path: 'trigger.payload.interactive.button_reply.id', label: 'ID do Botão Clicado'},
             { path: 'trigger.payload.interactive.button_reply.title', label: 'Texto do Botão Clicado'},
        ]
    });
    
    const webhookNode = nodes.find(n => n.data.type === 'webhook_received');
    if (webhookNode && (webhookNode.data.config as any)?.last_captured_data) {
        const capturedData = (webhookNode.data.config as any).last_captured_data;

        if (capturedData.headers) {
             variables.push({
                group: 'Gatilho (Webhook Headers)',
                vars: flattenObject(capturedData.headers, 'trigger.headers')
            });
        }
        if (capturedData.query) {
             variables.push({
                group: 'Gatilho (Webhook Query)',
                vars: flattenObject(capturedData.query, 'trigger.query')
            });
        }
        if (capturedData.body) {
             variables.push({
                group: 'Gatilho (Webhook Body)',
                vars: flattenObject(capturedData.body, 'trigger.body')
            });
        }
    }


    return variables;
};


// ====================================================================================
// Variable Selector Component
// ====================================================================================
interface VariableSelectorProps {
    variables: ReturnType<typeof getContextVariables>;
    onSelect: (variablePath: string) => void;
}
export const VariableSelector: React.FC<VariableSelectorProps> = memo(({ variables, onSelect }) => {
    return (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-slate-700 shadow-lg p-2 border border-slate-600">
            <div className="max-h-48 overflow-y-auto">
                {variables.map(group => (
                    <div key={group.group}>
                        <h5 className="text-xs font-bold text-slate-400 px-2 pt-2">{group.group}</h5>
                        <ul>
                            {group.vars.map(v => (
                                <li key={v.path}>
                                    <button
                                        type="button"
                                        className="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-sky-500/20 rounded-md"
                                        onClick={() => onSelect(`{{${v.path}}}`)}
                                        title={`Inserir {{${v.path}}}`}
                                    >
                                        {v.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
});


// ====================================================================================
// Input with Variable Selector
// ====================================================================================
interface InputWithVariablesProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onValueChange: (value: string) => void;
    variables: ReturnType<typeof getContextVariables>;
}
export const InputWithVariables: React.FC<InputWithVariablesProps> = ({ onValueChange, value, variables, ...props }) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSelectVariable = (variablePath: string) => {
        const newValue = (value ? value + ' ' : '') + variablePath;
        onValueChange(newValue);
        inputRef.current?.focus();
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                value={value}
                onChange={e => onValueChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)} // Delay to allow click on selector
                {...props}
            />
            {isFocused && <VariableSelector variables={variables} onSelect={handleSelectVariable} />}
        </div>
    );
};

interface TextareaWithVariablesProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onValueChange: (value: string) => void;
    variables: ReturnType<typeof getContextVariables>;
}
export const TextareaWithVariables: React.FC<TextareaWithVariablesProps> = ({ onValueChange, value, variables, ...props }) => {
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSelectVariable = (variablePath: string) => {
        if (!textareaRef.current) return;
        const { selectionStart, selectionEnd } = textareaRef.current;
        const currentValStr = String(value || '');
        const newValue = `${currentValStr.substring(0, selectionStart as number)}${variablePath}${currentValStr.substring(selectionEnd as number)}`;
        onValueChange(newValue);
        textareaRef.current.focus();
    };
    
    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={e => onValueChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                {...props}
            />
            {isFocused && <VariableSelector variables={variables} onSelect={handleSelectVariable} />}
        </div>
    );
};