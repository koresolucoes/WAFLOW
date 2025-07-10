
import React, { useContext } from 'react';
import { AppContext } from './contexts/AppContext';
import MainLayout from './components/layout/MainLayout';
import Auth from './pages/Auth/Auth';
import Dashboard from './pages/Dashboard/Dashboard';
import Campaigns from './pages/Campaigns/Campaigns';
import Templates from './pages/Templates/Templates';
import TemplateEditor from './pages/TemplateEditor/TemplateEditor';
import CompanyProfile from './pages/Profile/CompanyProfile';
import Contacts from './pages/Contacts/Contacts';
import NewCampaign from './pages/NewCampaign/NewCampaign';
import CampaignDetails from './pages/CampaignDetails/CampaignDetails';
import MetaSettings from './pages/Settings/MetaSettings';

const App: React.FC = () => {
  const { session, loading, currentPage } = useContext(AppContext);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'campaigns':
        return <Campaigns />;
      case 'campaign-details':
        return <CampaignDetails />;
      case 'templates':
        return <Templates />;
      case 'template-editor':
        return <TemplateEditor />;
      case 'contacts':
        return <Contacts />;
      case 'new-campaign':
        return <NewCampaign />;
      case 'profile':
        return <CompanyProfile />;
      case 'settings':
        return <MetaSettings />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-900">
            <div className="text-white text-xl">Carregando...</div>
        </div>
      )
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <MainLayout>
      {renderPage()}
    </MainLayout>
  );
};

export default App;
