import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { Page } from '../../types';

interface NavigationContextType {
  currentPage: Page;
  pageParams: Record<string, any>;
  setCurrentPage: (page: Page, params?: Record<string, any>) => void;
}

export const NavigationContext = createContext<NavigationContextType>(null!);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentPage, setCurrentPageInternal] = useState<Page>('dashboard');
    const [pageParams, setPageParams] = useState<Record<string, any>>({});

    const setCurrentPage = useCallback((page: Page, params: Record<string, any> = {}) => {
        setCurrentPageInternal(page);
        setPageParams(params);
    }, []);

    const value = { currentPage, pageParams, setCurrentPage };

    return (
        <NavigationContext.Provider value={value}>
            {children}
        </NavigationContext.Provider>
    );
};