
import { Contact, MetaConfig, Profile } from '../types.js';

export const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

export const resolveVariables = (text: string, context: { contact: Contact | null, trigger: any }): string => {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
        const trimmedPath = path.trim();
        const value = getValueFromPath(context, trimmedPath);
        
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        
        return value !== undefined ? String(value) : `{{${trimmedPath}}}`;
    });
};

export const resolveJsonPlaceholders = (jsonString: string, context: any): string => {
    if (typeof jsonString !== 'string') {
        return JSON.stringify(jsonString);
    }
    let processedJsonString = jsonString.replace(/"\{\{([^}]+)\}\}"/g, '{{$1}}');
    return processedJsonString.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
        const value = getValueFromPath(context, path.trim());
        if (value === undefined || value === null) {
            return 'null';
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        return JSON.stringify(value);
    });
};

export const getMetaConfig = (profile: Profile): MetaConfig => {
    const metaConfig = {
        accessToken: profile.meta_access_token || '',
        wabaId: profile.meta_waba_id || '',
        phoneNumberId: profile.meta_phone_number_id || '',
    };
    if (!metaConfig.accessToken || !metaConfig.wabaId || !metaConfig.phoneNumberId) {
        throw new Error(`Meta configuration missing in profile for user ${profile.id}`);
    }
    return metaConfig;
};
