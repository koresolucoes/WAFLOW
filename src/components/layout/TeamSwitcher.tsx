

import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Team } from '../../types';

const CHEVRON_DOWN_ICON = (
  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
  </svg>
);

const CHECK_ICON = (
  <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
  </svg>
);


const TeamSwitcher: React.FC = () => {
  const { activeTeam, userTeams, setActiveTeam } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelectTeam = (team: Team) => {
    if (team.id !== activeTeam?.id) {
        setActiveTeam(team);
    }
    setIsOpen(false);
  };

  if (!activeTeam || userTeams.length <= 1) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-700 rounded-lg flex items-center justify-center font-bold text-white">
                {activeTeam?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-white">{activeTeam?.name}</span>
        </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <div className="w-9 h-9 bg-slate-700 rounded-lg flex items-center justify-center font-bold text-white">
          {activeTeam.name.charAt(0).toUpperCase()}
        </div>
        <span className="font-semibold text-white">{activeTeam.name}</span>
        {CHEVRON_DOWN_ICON}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20">
          <ul className="p-2">
            {userTeams.map(team => (
              <li key={team.id}>
                <button 
                    onClick={() => handleSelectTeam(team)}
                    className="w-full flex items-center justify-between p-2 rounded-md text-left hover:bg-slate-700"
                >
                    <span className="text-white">{team.name}</span>
                    {team.id === activeTeam.id && CHECK_ICON}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TeamSwitcher;