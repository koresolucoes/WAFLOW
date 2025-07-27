
import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import Button from '../common/Button';
import { useAuthStore } from '../../stores/authStore';
import TeamSwitcher from './TeamSwitcher';

const Header: React.FC = () => {
  const user = useAuthStore(state => state.user);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="flex-shrink-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-between p-4 border-b border-slate-700/50">
      <TeamSwitcher />
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-slate-300">{user?.email}</span>
        <img
          className="h-9 w-9 rounded-full object-cover"
          src={`https://api.dicebear.com/8.x/initials/svg?seed=${user?.email}`}
          alt="User avatar"
        />
        <Button variant="secondary" size="sm" onClick={handleLogout}>
          Sair
        </Button>
      </div>
    </header>
  );
};

export default Header;
