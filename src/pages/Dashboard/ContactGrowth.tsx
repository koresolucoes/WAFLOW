import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../../components/common/Card';
import { useAuthStore } from '../../stores/authStore';
import { CustomTooltip } from './Dashboard';
import { CONTACTS_ICON } from '../../components/icons';

const ContactGrowth: React.FC = () => {
    const { contacts, allTags } = useAuthStore();

    const growthData = useMemo(() => {
        const countsByDay: { [key: string]: number } = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        contacts.forEach(contact => {
            const createdAt = new Date(contact.created_at);
            if (createdAt >= thirtyDaysAgo) {
                const day = createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                countsByDay[day] = (countsByDay[day] || 0) + 1;
            }
        });

        const sortedDays = Object.keys(countsByDay).sort((a, b) => {
            const [dayA, monthA] = a.split('/').map(Number);
            const [dayB, monthB] = b.split('/').map(Number);
            return new Date(2000, monthA - 1, dayA).getTime() - new Date(2000, monthB - 1, dayB).getTime();
        });

        return sortedDays.map(day => ({
            name: day,
            'Novos Contatos': countsByDay[day],
        }));
    }, [contacts]);

    const popularTags = useMemo(() => {
        const tagCounts: { [key: string]: number } = {};
        contacts.forEach(contact => {
            contact.tags?.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });

        return Object.entries(tagCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5);
    }, [contacts]);

    return (
        <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <h2 className="text-lg font-semibold text-white mb-4">Crescimento de Contatos (Últimos 30 dias)</h2>
                    {growthData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={growthData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} fontSize={12} />
                                <YAxis tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="Novos Contatos" stroke="#34d399" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-center">
                             <div>
                                <CONTACTS_ICON className="w-12 h-12 mx-auto text-slate-600" />
                                <p className="text-sm text-slate-500 mt-2">Nenhum novo contato nos últimos 30 dias.</p>
                             </div>
                        </div>
                    )}
                </div>
                <div className="md:col-span-1">
                    <h2 className="text-lg font-semibold text-white mb-4">Tags Populares</h2>
                     {popularTags.length > 0 ? (
                        <ul className="space-y-2">
                            {popularTags.map(([tag, count]) => (
                                <li key={tag} className="flex justify-between items-center text-sm">
                                    <span className="text-slate-300 px-2 py-1 bg-sky-500/10 text-sky-300 rounded text-xs">{tag}</span>
                                    <span className="font-mono font-semibold text-white">{count}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-500 text-center pt-8">Nenhuma tag utilizada.</p>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default ContactGrowth;