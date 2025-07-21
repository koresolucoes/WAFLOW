
// Helper to resolve nested values from an object path (e.g., 'contact.custom_fields.order_id')
export const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    const cleanPath = path.replace(/\{\{|\}\}/g, '').trim();
    return cleanPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

// Replaces placeholders like {{contact.name}} or {{trigger.some_data}} with actual data
export const resolveVariables = (text: string, context: any): string => {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getValueFromPath(context, path.trim());
        return value !== undefined ? String(value) : match; // Return the placeholder if not found
    });
};

// Replaces placeholders in a JSON string template with their actual values,
// ensuring the output is a valid JSON value representation.
export const resolveJsonPlaceholders = (jsonString: string, context: any): string => {
    if (typeof jsonString !== 'string') {
        return JSON.stringify(jsonString);
    }
    
    // Pre-process to handle placeholders inside quotes like "{{var}}" -> {{var}}
    let processedJsonString = jsonString.replace(/"\{\{([^}]+)\}\}"/g, '{{$1}}');

    return processedJsonString.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
        const value = getValueFromPath(context, path.trim());

        if (value === undefined) {
            return 'null'; // Replace unresolved variables with JSON null
        }
        if (value === null) {
            return 'null';
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        return JSON.stringify(value);
    });
};
