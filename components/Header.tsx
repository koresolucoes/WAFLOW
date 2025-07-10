
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="flex-shrink-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-end p-4 border-b border-slate-700/50">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-slate-300">Ana Silva</span>
        <img
          className="h-9 w-9 rounded-full object-cover"
          src="https://picsum.photos/id/237/100/100"
          alt="User avatar"
        />
      </div>
    </header>
  );
};

export default Header;
