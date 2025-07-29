

import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled = false }) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <label className="inline-flex items-center cursor-pointer">
      <div className="relative">
        <input 
            type="checkbox" 
            className="sr-only" 
            checked={checked} 
            onChange={handleToggle}
            disabled={disabled}
        />
        <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-slate-900 dark:bg-sky-500' : 'bg-slate-200 dark:bg-slate-600'}`}></div>
        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-full' : ''}`}></div>
      </div>
      {label && <span className="ml-3 text-sm font-medium text-slate-300">{label}</span>}
    </label>
  );
};

export default Switch;