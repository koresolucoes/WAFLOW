
import { MessageTemplate } from '../../../types';

export interface PlaceholderInfo {
  placeholder: string; // e.g., "{{2}}"
  location: 'Header' | 'Body' | `Botão URL ${number}`;
}

export const getTemplatePlaceholders = (template: MessageTemplate | undefined): PlaceholderInfo[] => {
    if (!template?.components) return [];
    
    const results: PlaceholderInfo[] = [];
    const seen = new Set<string>();

    const addPlaceholder = (p: string, location: PlaceholderInfo['location']) => {
        if (!seen.has(p)) {
            results.push({ placeholder: p, location });
            seen.add(p);
        }
    };
    
    // Process Header and Body
    template.components.forEach(c => {
        if ((c.type === 'HEADER' || c.type === 'BODY') && c.text) {
            const matches = c.text.match(/\{\{\d+\}\}/g) || [];
            matches.forEach(m => addPlaceholder(m, c.type === 'HEADER' ? 'Header' : 'Body'));
        }
    });

    // Process Buttons
    const buttonsComponent = template.components.find(c => c.type === 'BUTTONS');
    if (buttonsComponent && buttonsComponent.buttons) {
        buttonsComponent.buttons.forEach((button, index) => {
            if (button.type === 'URL' && button.url) {
                const matches = button.url.match(/\{\{\d+\}\}/g) || [];
                matches.forEach(m => addPlaceholder(m, `Botão URL ${index + 1}`));
            }
        });
    }

    // Filter out {{1}} and sort
    return results
        .filter(p => p.placeholder !== '{{1}}')
        .sort((a, b) => {
             const numA = parseInt(a.placeholder.match(/\d+/)?.[0] || '0', 10);
             const numB = parseInt(b.placeholder.match(/\d+/)?.[0] || '0', 10);
             return numA - numB;
        });
};
