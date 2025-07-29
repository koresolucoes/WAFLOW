import React from 'react';
import { Page } from '../../types';
import { ZAPFLOW_AI_LOGO, DASHBOARD_ICON, CAMPAIGN_ICON, TEMPLATE_ICON, CONTACTS_ICON, PROFILE_ICON, SETTINGS_ICON, AUTOMATION_ICON, FUNNEL_ICON, INBOX_ICON, WEBHOOK_INSPECTOR_ICON } from '../icons';
import { useAuthStore } from '../../stores/authStore';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  page: Page;
  isActive: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick }) => (
  <li>
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${
        isActive 
          ? 'bg-blue-50 text-blue-600 font-bold dark:bg-slate-700/50 dark:text-sky-400' 
          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
      }`}
    >
      {icon}
      <span className="ml-4 text-sm font-medium">{label}</span>
    </a>
  </li>
);

const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage } = useAuthStore();

  const navItems = [
    { icon: <DASHBOARD_ICON className="w-5 h-5" />, label: 'Painel', page: 'dashboard' as Page },
    { icon: <INBOX_ICON className="w-5 h-5" />, label: 'Caixa de Entrada', page: 'inbox' as Page },
    { icon: <CONTACTS_ICON className="w-5 h-5" />, label: 'Contatos', page: 'contacts' as Page },
    { icon: <FUNNEL_ICON className="w-5 h-5" />, label: 'Funil', page: 'funnel' as Page },
    { icon: <CAMPAIGN_ICON className="w-5 h-5" />, label: 'Campanhas', page: 'campaigns' as Page },
    { icon: <TEMPLATE_ICON className="w-5 h-5" />, label: 'Templates', page: 'templates' as Page },
    { icon: <AUTOMATION_ICON className="w-5 h-5" />, label: 'Automações', page: 'automations' as Page },
    { icon: <PROFILE_ICON className="w-5 h-5" />, label: 'Perfil da Empresa', page: 'profile' as Page },
  ];
  
  const bottomNavItems = [
      { icon: <WEBHOOK_INSPECTOR_ICON className="w-5 h-5" />, label: 'Webhook Inspector', page: 'webhook-inspector' as Page },
      { icon: <SETTINGS_ICON className="w-5 h-5" />, label: 'Configurações', page: 'settings' as Page },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-slate-800/50 p-4 flex flex-col justify-between border-r border-gray-200 dark:border-slate-700/50">
      <div>
        <div className="flex items-center space-x-3 p-3 mb-6">
          {ZAPFLOW_AI_LOGO}
          <span className="text-xl font-bold text-gray-900 dark:text-white">ZapFlow AI</span>
        </div>
        <nav>
          <ul>
            {navItems.map((item) => (
              <NavItem
                key={item.page}
                icon={item.icon}
                label={item.label}
                page={item.page}
                isActive={currentPage === item.page}
                onClick={() => setCurrentPage(item.page)}
              />
            ))}
          </ul>
        </nav>
      </div>
       <div>
         <nav>
            <ul>
                {bottomNavItems.map((item) => (
                <NavItem
                    key={item.page}
                    icon={item.icon}
                    label={item.label}
                    page={item.page}
                    isActive={currentPage === item.page}
                    onClick={() => setCurrentPage(item.page)}
                />
                ))}
            </ul>
         </nav>
        <div className="p-4 mt-4 bg-gray-50 dark:bg-slate-800 rounded-lg text-center">
            <p className="text-xs text-gray-500 dark:text-slate-400">© 2024 ZapFlow AI. Todos os direitos reservados.</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;