import React from 'react';
import { INFO_ICON } from '../icons';

interface InfoCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'info' | 'warning' | 'success' | 'error';
}

const InfoCard: React.FC<InfoCardProps> = ({ children, className = '', variant = 'info' }) => {
  const variantStyles = {
    info: 'border-blue-500 bg-blue-50 text-blue-700 dark:border-sky-500 dark:bg-sky-500/10 dark:text-sky-300',
    warning: 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-500/10 dark:text-amber-300',
    success: 'border-green-500 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-500/10 dark:text-green-300',
    error: 'border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-500/10 dark:text-red-300',
  };

  const iconStyles = {
    info: 'text-blue-500 dark:text-current',
    warning: 'text-amber-500 dark:text-current',
    success: 'text-green-500 dark:text-current',
    error: 'text-red-500 dark:text-current',
  }

  return (
    <div className={`border-l-4 p-4 rounded-r-lg ${variantStyles[variant]} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <INFO_ICON className={`h-5 w-5 ${iconStyles[variant]}`} aria-hidden="true" />
        </div>
        <div className="ml-3">
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default InfoCard;