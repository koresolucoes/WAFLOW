import React from 'react';
import { INFO_ICON } from '../icons';

interface InfoCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'info' | 'warning' | 'success' | 'error';
}

const InfoCard: React.FC<InfoCardProps> = ({ children, className = '', variant = 'info' }) => {
  const variantStyles = {
    info: 'border-sky-500 bg-sky-500/10 text-sky-300',
    warning: 'border-amber-500 bg-amber-500/10 text-amber-300',
    success: 'border-green-500 bg-green-500/10 text-green-300',
    error: 'border-red-500 bg-red-500/10 text-red-300',
  };

  return (
    <div className={`border-l-4 p-4 rounded-r-lg ${variantStyles[variant]} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <INFO_ICON className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default InfoCard;