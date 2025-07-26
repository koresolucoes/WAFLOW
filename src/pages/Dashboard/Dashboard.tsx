
import React, { useContext, useMemo, useState, useEffect } from 'react';
import Card from '../../components/common/Card';
import { ContactsContext } from '../../contexts/providers/ContactsContext';
import { FunnelContext } from '../../contexts/providers/FunnelContext';
import { AutomationsContext } from '../../contexts/providers/AutomationsContext';
import { useAuthStore } from '../../stores/authStore';
import { fetchDashboardData, DashboardData } from '../../services/dataService';

import SalesMetrics from './SalesMetrics';
import AutomationAnalytics from './AutomationAnalytics';
import CampaignAnalytics from './CampaignAnalytics';
import ContactGrowth from './ContactGrowth';
import RecentActivityFeed from './RecentActivityFeed';
import { CONTACTS_ICON, FUNNEL_ICON, AUTOMATION_ICON } from '../../components/icons';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; footer?: string; }> = ({ title, value, icon, footer }) => (
    <Card className="flex flex-col justify-between p-4">
        <div>
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-sm font-medium text-slate-400">{title}</h3>
                    <p className="text-2xl font-bold text-white mt-1">{value}</p>
                </div>
                <div className="p-3 bg-slate-700 rounded-lg">
                    {icon}
                </div>
            </div>
        </div>
        {footer && <p className="text-xs text-slate-500 mt-2">{footer}</p>}
    </Card>
);

export const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-700 p-3 rounded-lg border border-slate-600 shadow-xl">
        <p className="label font-bold text-white">{`${label}`}</p>
        {payload.map((pld: any) => (
          <p key={pld.dataKey} style={{ color: pld.color }}>
            {`${pld.name}: ${pld.value.toLocaleString('pt-BR')}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { contacts } = useContext(ContactsContext);
  const { deals, activePipelineId } = useContext(FunnelContext);
  const { automations } = useContext(AutomationsContext);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        if (user) {
            setIsLoading(true);
            try {
                const data = await fetchDashboardData(user.id);
                setDashboardData(data);
            } catch (error) {
                console.error("Failed to load dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        }
    };
    loadData();
  }, [user]);

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

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Dashboard Geral</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Contatos" value={mainMetrics.totalContacts} icon={<CONTACTS_ICON className="w-6 h-6 text-sky-400" />} />
        <StatCard title="Negócios em Aberto" value={mainMetrics.openDealsValue} icon={<FUNNEL_ICON className="w-6 h-6 text-green-400" />} />
        <StatCard title="Taxa de Conversão" value={mainMetrics.conversionRate} icon={<span className="text-amber-400 font-bold text-xl">%</span>} footer="Negócios Ganhos vs. Perdidos" />
        <StatCard title="Automações Ativas" value={mainMetrics.activeAutomations} icon={<AUTOMATION_ICON className="w-6 h-6 text-pink-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <SalesMetrics />
            <ContactGrowth />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <CampaignAnalytics />
            <AutomationAnalytics data={dashboardData} isLoading={isLoading} />
            <RecentActivityFeed data={dashboardData} isLoading={isLoading} />
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
