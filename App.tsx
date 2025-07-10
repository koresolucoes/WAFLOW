
import React, { useState, useCallback } from 'react';
import { Page, CompanyProfileData, MessageTemplate } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TemplateEditor from './components/TemplateEditor';
import CompanyProfile from './components/CompanyProfile';
import Campaigns from './components/Campaigns';
import Header from './components/Header';
import { ZAPFLOW_AI_LOGO } from './constants';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData>({
    name: 'InnovateTech',
    description: 'Uma empresa de tecnologia de ponta especializada em soluções de IA para automação e crescimento de negócios.',
    products: 'Chatbots com IA, Plataformas de Análise de Dados, Serviços em Nuvem',
    audience: 'Pequenas e médias empresas (PMEs) e startups de tecnologia.',
    tone: 'Profissional, mas acessível e inovador.',
  });
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  const handleSaveTemplate = useCallback((template: MessageTemplate) => {
    setTemplates(prevTemplates => [...prevTemplates, { ...template, id: `TPL_${Date.now()}` }]);
    // Em um aplicativo real, você também salvaria em um backend aqui.
    alert('Template salvo com sucesso!');
    setCurrentPage('campaigns');
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'campaigns':
        return <Campaigns templates={templates} setCurrentPage={setCurrentPage}/>;
      case 'template-editor':
        return <TemplateEditor companyProfile={companyProfile} onSaveTemplate={handleSaveTemplate} />;
      case 'profile':
        return <CompanyProfile profile={companyProfile} setProfile={setCompanyProfile} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 font-sans">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-900 p-6 md:p-8">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
