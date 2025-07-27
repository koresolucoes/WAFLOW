import React from 'react';
import { MetaTemplateComponent } from '../../services/meta/types';

interface TemplatePreviewProps {
  components: MetaTemplateComponent[];
  recipientName?: string;
  variables?: Record<string, string>;
  className?: string;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ 
    components, 
    recipientName,
    variables = {},
    className = ''
}) => {
    
    const applyVars = (text: string = '') => {
        if (!text) return '';
        let processedText = text;

        if (recipientName) {
            processedText = processedText.replace(/\{\{1\}\}/g, `[${recipientName}]`);
        }
        
        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(key.replace(/\{/g, '\\{').replace(/\}/g, '\\}'), 'g');
            processedText = processedText.replace(regex, value ? `[${value}]` : key);
        });

        // Substitui quaisquer variáveis não preenchidas pelo seu placeholder para visualização
        processedText = processedText.replace(/\{\{(\d+)\}\}/g, '[Variável $1]');


        return processedText;
    };

    const header = components.find(c => c.type === 'HEADER');
    const body = components.find(c => c.type === 'BODY');
    const footer = components.find(c => c.type === 'FOOTER');
    const buttons = components.find(c => c.type === 'BUTTONS')?.buttons;

    const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`flex flex-col items-center justify-start ${className}`}>
            <div className="relative w-80 bg-[#0a1014] border-8 border-slate-900 rounded-[40px] shadow-2xl overflow-hidden">
                {/* Phone Header */}
                <div className="bg-slate-800 p-2 flex items-center justify-between relative">
                     <div className="flex items-center space-x-3">
                         <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {(recipientName || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-white font-semibold text-sm">{recipientName || 'Contato'}</p>
                            <p className="text-slate-400 text-xs">online</p>
                        </div>
                    </div>
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-b-lg z-20"></div>
                </div>

                {/* Chat background */}
                <div className="bg-[#0a1014] bg-[url('https://www.heroscreen.cc/static/media/whats-app-dark-bg.a5027f2f.png')] bg-cover p-3 min-h-[480px] flex flex-col justify-end">
                    <div className='w-full'>
                        {/* Message bubble */}
                        <div className="max-w-[85%] ml-auto bg-[#005c4b] rounded-lg rounded-tr-none p-2 text-white shadow-md mb-2">
                            {/* Header */}
                            {header && header.text && (
                                 <p className="font-bold mb-1 break-words" style={{ whiteSpace: 'pre-wrap' }}>
                                    {applyVars(header.text)}
                                </p>
                            )}
                            
                            {/* Body */}
                            {body && body.text && (
                                <p className="text-sm break-words" style={{ whiteSpace: 'pre-wrap' }}>
                                    {applyVars(body.text)}
                                </p>
                            )}

                            {/* Footer */}
                            {footer && footer.text && (
                                 <p className="text-xs text-slate-300/90 mt-2" style={{ whiteSpace: 'pre-wrap' }}>
                                    {applyVars(footer.text)}
                                </p>
                            )}

                            {/* Timestamp & Read Receipt */}
                             <div className="text-right text-xs text-slate-300/80 mt-1 flex items-center justify-end">
                                <span>{currentTime}</span>
                                <svg viewBox="0 0 18 18" width="18" height="18" className="inline-block ml-1 text-sky-400">
                                    <path fill="currentColor" d="M17.394 5.035l-.57-.444a.434.434 0 00-.609.076l-6.39 8.198-2.628-2.52a.434.434 0 00-.583.027l-.52.484a.434.434 0 00.026.606l3.446 3.306a.434.434 0 00.582-.027l.52-.484a.434.434 0 00-.026-.606l-.52.484 6.96-8.932a.434.434 0 00.08-.605zm-4.552 0l-.57-.444a.434.434 0 00-.609.076l-6.39 8.198-2.628-2.52a.434.434 0 00-.583.027l-.52.484a.434.434 0 00.026.606l3.446 3.306a.434.434 0 00.582-.027l.52-.484a.434.434 0 00-.026-.606l-.52.484 6.96-8.932a.434.434 0 00.08-.605z"></path>
                                </svg>
                            </div>
                        </div>

                        {/* Buttons */}
                        {buttons && buttons.length > 0 && (
                            <div className="mt-1 space-y-1">
                                {buttons.map((button, index) => (
                                    <div key={index} className="bg-slate-700/80 rounded-lg p-2.5 text-center text-sky-300 font-semibold text-sm cursor-pointer shadow-md backdrop-blur-sm hover:bg-slate-600/80">
                                        {button.text || "Texto do Botão"}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
             <p className="text-center text-xs text-slate-500 mt-2 w-80">
                Esta é uma prévia. A aparência final pode variar.
            </p>
        </div>
    );
};

export default TemplatePreview;