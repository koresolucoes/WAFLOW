

import React, { useContext, useState, useMemo } from 'react';
import { MessageTemplate, TemplateStatus } from '../../types';
import { getMetaTemplates } from '../../services/meta/templates';
import { supabase } from '../../lib/supabaseClient';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { SPARKLES_ICON } from '../../components/icons';
import { Json, TablesInsert } from '../../types/database.types';
import { TemplatesContext } from '../../contexts/providers/TemplatesContext';
import { NavigationContext } from '../../contexts/providers/NavigationContext';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';

const StatusBadge: React.FC<{ status: MessageTemplate['status'] }> = ({ status }) => {
    const statusStyles: Record<TemplateStatus, string> = {
        APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
        PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
        PAUSED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        LOCAL: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    };
    const style = status ? statusStyles[status] : statusStyles.LOCAL;
    const text = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Local';
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${style}`}>{text}</span>;
};

const TemplateCard: React.FC<{ template: MessageTemplate; onUse: () => void }> = ({ template, onUse }) => {
    const isUsable = template.status === 'APPROVED';

    const header = useMemo(() => template.components.find(c => c.type === 'HEADER'), [template.components]);
    const body = useMemo(() => template.components.find(c => c.type === 'BODY'), [template.components]);

    return (
        <Card className="flex flex-col justify-between hover:border-sky-500 border border-transparent transition-colors duration-200">
            <div>
                <div className="flex justify-between items-start gap-2">
                    <h3 className="font-mono text-lg text-white break-all">{template.template_name}</h3>
                    <div className="flex-shrink-0">
                         <StatusBadge status={template.status} />
                    </div>
                </div>
                 <div className="mt-4 text-sm text-slate-400 font-mono bg-slate-900/50 p-3 rounded-md whitespace-pre-wrap space-y-2">
                    {header?.text && <p className="font-bold text-slate-200">{header.text}</p>}
                    {body?.text && <p>{body.text}</p>}
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
                <Button variant="primary" size="sm" onClick={onUse} disabled={!isUsable} title={!isUsable ? "Apenas templates APROVADOS podem ser usados" : "Usar este template"}>
                  Usar Template
                </Button>
            </div>
        </Card>
    );
}

const Templates: React.FC = () => {
  const { templates, setTemplates } = useContext(TemplatesContext);
  const { setCurrentPage } = useContext(NavigationContext);
  const user = useAuthStore(state => state.user);
  const metaConfig = useMetaConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  
  const handleUseTemplate = (templateId: string) => {
    setCurrentPage('new-campaign', { templateId });
  };

  const handleSync = async () => {
    if (!metaConfig.wabaId || !metaConfig.accessToken || !user) {
        setError("Por favor, configure suas credenciais da Meta na página de Configurações.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setSyncMessage(null);
    try {
        const metaTemplates = await getMetaTemplates(metaConfig);

        const templatesToUpsert: TablesInsert<'message_templates'>[] = metaTemplates.map(mt => ({
            meta_id: mt.id,
            user_id: user.id,
            template_name: mt.name,
            status: mt.status,
            category: mt.category,
            components: mt.components as unknown as Json,
        }));
        
        if (templatesToUpsert.length > 0) {
            const { error: upsertError } = await supabase.from('message_templates').upsert(templatesToUpsert as any, { onConflict: 'meta_id, user_id' });
            if (upsertError) throw upsertError;
        }

        const { data: dbTemplates, error: refetchError } = await supabase
            .from('message_templates')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (refetchError) throw refetchError;
        
        setTemplates((dbTemplates as unknown as MessageTemplate[]) || []);
        setSyncMessage("Sincronização concluída! Os status dos templates foram atualizados.");
        setTimeout(() => setSyncMessage(null), 4000);

    } catch(err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-white">Templates de Mensagem</h1>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={handleSync} isLoading={isLoading}>Sincronizar com Meta</Button>
            <Button variant="primary" onClick={() => setCurrentPage('template-editor')}>
                <SPARKLES_ICON className="w-5 h-5 mr-2" />
                Criar com IA
            </Button>
        </div>
      </div>

      {error && <Card className="border-l-4 border-red-500"><p className="text-red-400">{error}</p></Card>}
      {syncMessage && <Card className="border-l-4 border-green-500"><p className="text-green-400">{syncMessage}</p></Card>}
      
      {templates.length === 0 ? (
        <Card className="text-center py-12">
            <h2 className="text-xl font-semibold text-white">Nenhum template encontrado.</h2>
            <p className="text-slate-400 mt-2 mb-6">Sincronize com sua conta da Meta para ver seus templates ou crie um novo com IA.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={() => handleUseTemplate(template.id)} />
            ))}
        </div>
      )}
    </div>
  );
};

export default Templates;
