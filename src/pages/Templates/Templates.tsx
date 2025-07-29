import React, { useState, useMemo } from 'react';
import { MessageTemplate, TemplateCategory, TemplateStatus } from '../../types';
import type { TablesInsert } from '../../types/database.types';
import { getMetaTemplates } from '../../services/meta/templates';
import { supabase } from '../../lib/supabaseClient';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { SPARKLES_ICON, SEARCH_ICON } from '../../components/icons';
import { Json } from '../../types/database.types';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';
import { MetaTemplateComponent } from '../../services/meta/types';

const StatusBadge: React.FC<{ status: MessageTemplate['status'] }> = ({ status }) => {
    const statusStyles: Record<TemplateStatus, string> = {
        APPROVED: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
        PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
        REJECTED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
        PAUSED: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30',
        LOCAL: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30',
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
        <Card className="flex flex-col justify-between hover:border-gray-300 dark:hover:border-sky-500 border border-transparent transition-colors duration-200">
            <div>
                <div className="flex justify-between items-start gap-2">
                    <h3 className="font-mono text-lg text-gray-900 dark:text-white break-all">{template.template_name}</h3>
                    <div className="flex-shrink-0">
                         <StatusBadge status={template.status} />
                    </div>
                </div>
                 <div className="mt-4 text-sm text-gray-600 dark:text-slate-400 font-mono bg-gray-100 dark:bg-slate-900/50 p-3 rounded-md whitespace-pre-wrap space-y-2">
                    {header?.text && <p className="font-bold text-gray-800 dark:text-slate-200">{header.text}</p>}
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
  const { templates, setTemplates, setCurrentPage, user, activeTeam } = useAuthStore();
  const metaConfig = useMetaConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) return templates;
    const lowercasedTerm = searchTerm.toLowerCase();
    return templates.filter(template =>
        template.template_name.toLowerCase().includes(lowercasedTerm)
    );
  }, [templates, searchTerm]);
  
  const handleUseTemplate = (templateId: string) => {
    setCurrentPage('new-campaign', { templateId });
  };

  const handleSync = async () => {
    if (!metaConfig.wabaId || !metaConfig.accessToken || !user || !activeTeam) {
        setError("Por favor, configure suas credenciais da Meta na página de Configurações e verifique se uma equipa está ativa.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setSyncMessage(null);
    try {
        // 1. Obter templates da Meta
        const metaTemplates = await getMetaTemplates(metaConfig);

        // 2. Obter templates existentes do nosso BD
        const { data: dbTemplatesData, error: dbError } = await supabase
            .from('message_templates')
            .select('id, meta_id, template_name, status, category, components')
            .eq('team_id', activeTeam.id);
        
        if (dbError) throw dbError;

        const dbTemplatesMap = new Map((dbTemplatesData as any[]).map(t => [t.meta_id, t]));

        const templatesToInsert: any[] = [];
        const updatePromises: any[] = [];

        // 3. Comparar e preparar inserções/atualizações
        for (const metaTemplate of metaTemplates) {
            const existingTemplate = dbTemplatesMap.get(metaTemplate.id);
            const templatePayload = {
                meta_id: metaTemplate.id,
                team_id: activeTeam.id,
                template_name: metaTemplate.name,
                status: metaTemplate.status as TemplateStatus,
                category: metaTemplate.category as TemplateCategory,
                components: metaTemplate.components as unknown as Json,
            };

            if (existingTemplate) {
                // É uma atualização. Verificar se algo realmente mudou.
                if (
                    existingTemplate.template_name !== templatePayload.template_name ||
                    existingTemplate.status !== templatePayload.status ||
                    existingTemplate.category !== templatePayload.category ||
                    JSON.stringify(existingTemplate.components) !== JSON.stringify(templatePayload.components)
                ) {
                    const { team_id, ...updatePayload } = templatePayload;
                    const promise = supabase
                        .from('message_templates')
                        .update(updatePayload)
                        .eq('id', existingTemplate.id);
                    updatePromises.push(promise);
                }
            } else {
                // É uma inserção
                templatesToInsert.push(templatePayload);
            }
        }
        
        // 4. Executar operações no BD
        if (templatesToInsert.length > 0) {
            const { error: insertError } = await supabase.from('message_templates').insert(templatesToInsert as any);
            if (insertError) throw insertError;
        }

        if (updatePromises.length > 0) {
            const results = await Promise.all(updatePromises);
            const firstError = results.find(res => res.error);
            if (firstError) throw firstError.error;
        }

        // 5. Rebuscar todos os templates para atualizar o estado da UI
        const { data: finalDbTemplates, error: refetchError } = await supabase
            .from('message_templates')
            .select('id, meta_id, team_id, template_name, status, category, components, created_at')
            .eq('team_id', activeTeam.id)
            .order('created_at', { ascending: false });

        if (refetchError) throw refetchError;
        
        const typedTemplates = ((finalDbTemplates as any[]) || []).map(t => ({
            ...t,
            category: t.category as TemplateCategory,
            status: t.status as TemplateStatus,
            components: (t.components as unknown as MetaTemplateComponent[]) || []
        })) as MessageTemplate[];

        setTemplates(typedTemplates);
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Templates de Mensagem</h1>
        <div className="flex items-center gap-4">
             <div className="relative">
                <SEARCH_ICON className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Buscar templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg py-2 pl-10 pr-4 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500 focus:outline-none"
                />
            </div>
            <div className="flex gap-2">
                <Button variant="secondary" onClick={handleSync} isLoading={isLoading}>Sincronizar com Meta</Button>
                <Button variant="primary" onClick={() => setCurrentPage('template-editor')}>
                    <SPARKLES_ICON className="w-5 h-5 mr-2" />
                    Criar com IA
                </Button>
            </div>
        </div>
      </div>

      {error && <Card className="border-l-4 border-red-500"><p className="text-red-500 dark:text-red-400">{error}</p></Card>}
      {syncMessage && <Card className="border-l-4 border-green-500"><p className="text-green-500 dark:text-green-400">{syncMessage}</p></Card>}
      
      {filteredTemplates.length === 0 ? (
        <Card className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{searchTerm ? 'Nenhum template encontrado.' : 'Nenhum template encontrado.'}</h2>
            <p className="text-gray-500 dark:text-slate-400 mt-2 mb-6">{searchTerm ? `Sua busca por "${searchTerm}" não retornou resultados.` : 'Sincronize com sua conta da Meta para ver seus templates ou crie um novo com IA.'}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={() => handleUseTemplate(template.id)} />
            ))}
        </div>
      )}
    </div>
  );
};

export default Templates;