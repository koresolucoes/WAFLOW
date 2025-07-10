
import React, { useContext, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AppContext } from '../../contexts/AppContext';
import Card from '../../components/common/Card';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <Card className="flex items-center p-4">
        <div className="p-3 bg-slate-700 rounded-lg">
            {icon}
        </div>
        <div className="ml-4">
            <h3 className="text-sm font-medium text-slate-400">{title}</h3>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
    </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
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
  const { campaigns, contacts, templates } = useContext(AppContext);

  const { totalRecipients, totalRead, readRate } = useMemo(() => {
    const totalRecipients = campaigns.reduce((acc, c) => acc + c.recipient_count, 0);
    const totalRead = campaigns.reduce((acc, c) => acc + c.metrics.read, 0);
    const readRate = totalRecipients > 0 ? ((totalRead / totalRecipients) * 100).toFixed(1) : '0';
    return { totalRecipients, totalRead, readRate };
  }, [campaigns]);

  const chartData = useMemo(() => {
    return campaigns.map(c => ({
        name: c.name,
        Destinatários: c.recipient_count,
        Entregues: c.metrics.delivered,
        Lidas: c.metrics.read,
    })).slice(0, 10).reverse(); // Show last 10 campaigns in chronological order
  }, [campaigns]);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Painel</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Campanhas Enviadas" value={campaigns.length.toLocaleString('pt-BR')} icon={<div className="text-sky-400 w-6 h-6">🚀</div>} />
        <StatCard title="Contatos Ativos" value={contacts.length.toLocaleString('pt-BR')} icon={<div className="text-green-400 w-6 h-6">👥</div>}/>
        <StatCard title="Templates Criados" value={templates.length.toLocaleString('pt-BR')} icon={<div className="text-pink-400 w-6 h-6">📄</div>} />
        <StatCard title="Taxa de Leitura Média" value={`${readRate}%`} icon={<div className="text-amber-400 w-6 h-6">👁️</div>} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Desempenho das Últimas Campanhas</h2>
        {campaigns.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} fontSize={12} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }} />
                    <Legend />
                    <Bar dataKey="Destinatários" fill="#0ea5e9" name="Destinatários" />
                    <Bar dataKey="Entregues" fill="#34d399" name="Entregues" />
                    <Bar dataKey="Lidas" fill="#f472b6" name="Lidas" />
                </BarChart>
            </ResponsiveContainer>
        ) : (
            <div className="text-center py-16">
                 <h3 className="text-lg text-white">Nenhuma campanha foi enviada ainda.</h3>
                 <p className="text-slate-400 mt-2">Os dados de desempenho aparecerão aqui assim que você enviar sua primeira campanha.</p>
            </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;