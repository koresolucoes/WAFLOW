
import React from 'react';
import { Page } from '../types';
import { ZAPFLOW_AI_LOGO, DASHBOARD_ICON, CAMPAIGN_ICON, TEMPLATE_ICON, PROFILE_ICON } from '../constants';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

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
      className={`flex items-center p-3 my-1 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors duration-200 ${
        isActive ? 'bg-slate-700/50 text-sky-400' : ''
      }`}
    >
      {icon}
      <span className="ml-4 text-sm font-medium">{label}</span>
    </a>
  </li>
);


const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { icon: <DASHBOARD_ICON className="w-5 h-5" />, label: 'Painel', page: 'dashboard' as Page },
    { icon: <CAMPAIGN_ICON className="w-5 h-5" />, label: 'Campanhas', page: 'campaigns' as Page },
    { icon: <TEMPLATE_ICON className="w-5 h-5" />, label: 'Editor de Templates', page: 'template-editor' as Page },
    { icon: <PROFILE_ICON className="w-5 h-5" />, label: 'Perfil da Empresa', page: 'profile' as Page },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-800/50 p-4 flex flex-col justify-between border-r border-slate-700/50">
      <div>
        <div className="flex items-center space-x-3 p-3 mb-6">
          {ZAPFLOW_AI_LOGO}
          <span className="text-xl font-bold text-white">ZapFlow AI</span>
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
       <div className="p-4 bg-slate-800 rounded-lg text-center">
        <p className="text-xs text-slate-400">© 2024 ZapFlow AI. Todos os direitos reservados.</p>
      </div>
    </aside>
  );
};

export default Sidebar;
