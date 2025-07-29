import React, { useMemo, useState, useEffect } from 'react';
import Card from '../../components/common/Card';
import { useAuthStore } from '../../stores/authStore';
import { fetchDashboardData, DashboardData } from '../../services/dataService';

import SalesMetrics from './SalesMetrics';
import AutomationAnalytics from './AutomationAnalytics';
import CampaignAnalytics from './CampaignAnalytics';
import ContactGrowth from './ContactGrowth';
import RecentActivityFeed from './RecentActivityFeed';
import TodaysTasksCard from './TodaysTasksCard';
import { CONTACTS_ICON, FUNNEL_ICON, AUTOMATION_ICON } from '../../components/icons';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; footer?: string; }> = ({ title, value, icon, footer }) => (
    <Card className="flex flex-col justify-between p-4 h-full">
        <div>
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                </div>
                <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-lg">
                    {icon}
                </div>
            </div>
        </div>
        {footer && <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">{footer}</p>}
    </Card>
);

export const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm p-3 rounded-lg border border-gray-300 dark:border-slate-600 shadow-xl">
        <p className="label font-bold text-gray-900 dark:text-white">{`${label}`}</p>
        {payload.map((pld: any) => (
          <p key={pld.dataKey} style={{ color: pld.color }} className="text-gray-700 dark:text-current">
            {`${pld.name}: ${pld.value.toLocaleString('pt-BR')}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};


const SortableCardWrapper: React.FC<{ id: string; children: React.ReactNode; className?: string }> = ({ id, children, className }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.8 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={className}>
            {children}
        </div>
    );
};

const Dashboard: React.FC = () => {
  const { user, profile, updateProfile, activeTeam, contacts, deals, activePipelineId, automations } = useAuthStore();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Define a ordem e os componentes dos cards
  const defaultCardOrder = ['stats', 'sales', 'growth', 'tasks', 'campaigns', 'automations', 'activity'];
  const [cardOrder, setCardOrder] = useState<string[]>(defaultCardOrder);
  
  useEffect(() => {
      if (profile?.dashboard_layout && Array.isArray(profile.dashboard_layout) && profile.dashboard_layout.length > 0) {
          const layout = profile.dashboard_layout as string[];
          const profileCards = new Set(layout);
          const allCards = [...layout];
          // Garante que novos cards adicionados ao código apareçam para o usuário
          defaultCardOrder.forEach(key => {
              if (!profileCards.has(key)) {
                  allCards.push(key);
              }
          });
          setCardOrder(allCards);
      } else {
          setCardOrder(defaultCardOrder);
      }
  }, [profile]);

  useEffect(() => {
    const loadData = async () => {
        if (activeTeam) {
            setIsLoading(true);
            try {
                const data = await fetchDashboardData(activeTeam.id);
                setDashboardData(data);
            } catch (error) {
                console.error("Failed to load dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        }
    };
    loadData();
  }, [activeTeam]);

  const mainMetrics = useMemo(() => {
    const relevantDeals = deals.filter(d => d.pipeline_id === activePipelineId);
    const openDeals = relevantDeals.filter(d => d.status === 'Aberto');
    const wonDeals = relevantDeals.filter(d => d.status === 'Ganho');
    const lostDeals = relevantDeals.filter(d => d.status === 'Perdido');
    
    const openValue = openDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    const totalClosed = wonDeals.length + lostDeals.length;
    const conversionRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;
    
    return {
        totalContacts: contacts.length.toLocaleString('pt-BR'),
        openDealsValue: openValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        conversionRate: `${conversionRate.toFixed(1)}%`,
        activeAutomations: automations.filter(a => a.status === 'active').length.toLocaleString('pt-BR'),
    };
  }, [contacts, deals, automations, activePipelineId]);

  const cardComponents: { [key: string]: React.ReactNode } = {
    stats: (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total de Contatos" value={mainMetrics.totalContacts} icon={<CONTACTS_ICON className="w-6 h-6 text-gray-600 dark:text-sky-500" />} />
            <StatCard title="Negócios em Aberto" value={mainMetrics.openDealsValue} icon={<FUNNEL_ICON className="w-6 h-6 text-green-500" />} />
            <StatCard title="Taxa de Conversão" value={mainMetrics.conversionRate} icon={<span className="text-amber-500 font-bold text-xl">%</span>} footer="Negócios Ganhos vs. Perdidos" />
            <StatCard title="Automações Ativas" value={mainMetrics.activeAutomations} icon={<AUTOMATION_ICON className="w-6 h-6 text-pink-500" />} />
        </div>
    ),
    sales: <SalesMetrics />,
    growth: <ContactGrowth />,
    tasks: <TodaysTasksCard />,
    campaigns: <CampaignAnalytics />,
    automations: <AutomationAnalytics data={dashboardData} isLoading={isLoading} />,
    activity: <RecentActivityFeed data={dashboardData} isLoading={isLoading} />,
  };

  const cardClassNames: { [key: string]: string } = {
      stats: 'lg:col-span-5 cursor-grab active:cursor-grabbing',
      sales: 'lg:col-span-3 cursor-grab active:cursor-grabbing',
      growth: 'lg:col-span-3 cursor-grab active:cursor-grabbing',
      tasks: 'lg:col-span-2 cursor-grab active:cursor-grabbing',
      campaigns: 'lg:col-span-2 cursor-grab active:cursor-grabbing',
      automations: 'lg:col-span-2 cursor-grab active:cursor-grabbing',
      activity: 'lg:col-span-2 cursor-grab active:cursor-grabbing',
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        setCardOrder((items) => {
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over.id as string);
            const newOrder = arrayMove(items, oldIndex, newIndex);
            // Salva a nova ordem no perfil do usuário de forma assíncrona
            if (user) {
              updateProfile({ dashboard_layout: newOrder });
            }
            return newOrder;
        });
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Geral</h1>
      
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                 {cardOrder.map(id => (
                    <SortableCardWrapper key={id} id={id} className={cardClassNames[id]}>
                        {cardComponents[id]}
                    </SortableCardWrapper>
                ))}
            </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default Dashboard;