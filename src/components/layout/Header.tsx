import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Button from '../common/Button';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { USERS_ICON, SUN_ICON, MOON_ICON } from '../icons';
import { Team } from '../../types';

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useUiStore();
    
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-10 h-10 p-0"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {theme === 'dark' ? (
                <SUN_ICON className="w-5 h-5 text-slate-400 hover:text-amber-400" />
            ) : (
                <MOON_ICON className="w-5 h-5 text-gray-500 hover:text-gray-900" />
            )}
        </Button>
    );
};

const TeamSwitcher: React.FC = () => {
    const { userTeams, activeTeam, setActiveTeam, teamLoading } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (teamLoading) {
        return <div className="text-sm text-gray-500 dark:text-slate-400">Carregando equipes...</div>;
    }
    
    if (!activeTeam) {
        return <div className="text-sm text-gray-500 dark:text-slate-400">Nenhuma equipe encontrada.</div>;
    }

    const switchTeam = (team: Team) => {
        setActiveTeam(team);
        setIsOpen(false);
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
                <USERS_ICON className="w-5 h-5 text-gray-600 dark:text-sky-400" />
                <span className="font-semibold text-gray-800 dark:text-white text-sm">{activeTeam.name}</span>
                 <svg className={`w-4 h-4 text-gray-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1">
                        {userTeams.map(team => (
                            <a
                                key={team.id}
                                href="#"
                                onClick={(e) => { e.preventDefault(); switchTeam(team); }}
                                className={`block px-4 py-2 text-sm ${activeTeam.id === team.id ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-sky-500/20 dark:text-sky-300' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                            >
                                {team.name}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const Header: React.FC = () => {
  const user = useAuthStore(state => state.user);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="flex-shrink-0 bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm flex items-center justify-end p-4 border-b border-gray-200 dark:border-slate-700/50">
      <div className="flex items-center space-x-4">
        <ThemeToggle />
        <TeamSwitcher />
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{user?.email}</span>
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