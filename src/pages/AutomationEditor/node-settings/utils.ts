import { MessageTemplate } from '../../../types';

export const getTemplatePlaceholders = (template: MessageTemplate | undefined) => {
    if (!template?.components) return [];
    let allText = '';
    template.components.forEach(c => {
        if (c.text) {
            allText += c.text + ' ';
        }
        if (c.type === 'BUTTONS' && c.buttons) {
            c.buttons.forEach(b => {
                if (b.type === 'URL' && b.url) {
                    allText += b.url + ' ';
                }
            });
        }
    });
    const matches = allText.match(/\{\{\d+\}\}/g) || [];
    return [...new Set(matches)].filter(p => p !== '{{1}}').sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
    });
};
