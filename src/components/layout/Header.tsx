
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabaseClient';
import Button from '../common/Button';

const Header: React.FC = () => {
  const { user } = useContext(AppContext);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="flex-shrink-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-end p-4 border-b border-slate-700/50">
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