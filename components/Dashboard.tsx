
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { CampaignMetrics } from '../types';
import Card from './ui/Card';

const MOCK_METRICS: CampaignMetrics[] = [
  { month: 'Jan', sent: 4000, delivered: 3800, read: 2400 },
  { month: 'Fev', sent: 3000, delivered: 2900, read: 2210 },
  { month: 'Mar', sent: 5000, delivered: 4850, read: 3200 },
  { month: 'Abr', sent: 4780, delivered: 4700, read: 2908 },
  { month: 'Mai', sent: 3890, delivered: 3800, read: 2500 },
  { month: 'Jun', sent: 4390, delivered: 4200, read: 3100 },
];

const StatCard: React.FC<{ title: string; value: string; change: string; isPositive: boolean }> = ({ title, value, change, isPositive }) => (
    <Card>
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
        <p className={`text-xs mt-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {change} vs. mês anterior
        </p>
    </Card>
);


const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-700 p-3 rounded-lg border border-slate-600 shadow-xl">
        <p className="label font-bold text-white">{`${label}`}</p>
        {payload.map((pld: any) => (
          <p key={pld.dataKey} style={{ color: pld.color }}>
            {`${pld.name}: ${pld.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};


const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Painel</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Mensagens Enviadas" value="4.390" change="+10.2%" isPositive={true} />
        <StatCard title="Taxa de Entrega" value="95,67%" change="-1.1%" isPositive={false} />
        <StatCard title="Taxa de Leitura" value="70,61%" change="+5.4%" isPositive={true} />
        <StatCard title="Novos Inscritos" value="152" change="+22%" isPositive={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-96">
            <h2 className="text-lg font-semibold text-white mb-4">Visão Geral do Funil</h2>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_METRICS} margin={{ top: 5, right: 20, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8' }} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }} />
                    <Legend wrapperStyle={{paddingTop: '30px'}} />
                    <Bar dataKey="sent" fill="#0ea5e9" name="Enviadas" />
                    <Bar dataKey="delivered" fill="#34d399" name="Entregues" />
                    <Bar dataKey="read" fill="#f472b6" name="Lidas" />
                </BarChart>
            </ResponsiveContainer>
        </Card>

        <Card className="h-96">
            <h2 className="text-lg font-semibold text-white mb-4">Taxa de Engajamento</h2>
            <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={MOCK_METRICS} margin={{ top: 5, right: 20, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8' }} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }} />
                    <Legend wrapperStyle={{paddingTop: '30px'}} />
                    <Line type="monotone" dataKey="read" name="Mensagens Lidas" stroke="#34d399" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                 </LineChart>
            </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
