
import React from 'react';
import { MessageTemplate, Page } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import { SPARKLES_ICON } from '../constants';

interface CampaignsProps {
  templates: MessageTemplate[];
  setCurrentPage: (page: Page) => void;
}

const TemplateCard: React.FC<{ template: MessageTemplate }> = ({ template }) => {
    const categoryColor = {
        MARKETING: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
        UTILITY: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
        AUTHENTICATION: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
    const colorClasses = categoryColor[template.category as keyof typeof categoryColor] || 'bg-slate-600/20 text-slate-300 border-slate-600/30';

    return (
        <Card className="flex flex-col justify-between hover:border-sky-500 border border-transparent transition-colors">
            <div>
                <div className="flex justify-between items-start">
                    <h3 className="font-mono text-lg text-white">{template.templateName}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${colorClasses}`}>
                        {template.category}
                    </span>
                </div>
                <p className="mt-4 text-sm text-slate-400 font-mono bg-slate-900/50 p-3 rounded-md whitespace-pre-wrap">{template.body}</p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" size="sm">Usar Template</Button>
                <Button variant="ghost" size="sm">Ver Métricas</Button>
            </div>
        </Card>
    );
}

const Campaigns: React.FC<CampaignsProps> = ({ templates, setCurrentPage }) => {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Campanhas e Templates</h1>
      
      {templates.length === 0 ? (
        <Card className="text-center py-12">
            <h2 className="text-xl font-semibold text-white">Nenhum template criado ainda.</h2>
            <p className="text-slate-400 mt-2 mb-6">Comece a criar sua primeira campanha com a ajuda da nossa IA.</p>
            <Button variant="primary" onClick={() => setCurrentPage('template-editor')}>
                <SPARKLES_ICON className="w-5 h-5 mr-2" />
                Criar primeiro template
            </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
            ))}
        </div>
      )}
    </div>
  );
};

export default Campaigns;
