import React, { ReactNode } from 'react';
import { AuthProvider } from './providers/AuthContext';
import { NavigationProvider } from './providers/NavigationContext';
import { DataProvider } from './providers/DataProvider';
import { TemplatesProvider } from './providers/TemplatesContext';
import { ContactsProvider } from './providers/ContactsContext';
import { CampaignsProvider } from './providers/CampaignsContext';
import { AutomationsProvider } from './providers/AutomationsContext';
import { FunnelProvider } from './providers/FunnelContext';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <AuthProvider>
            <NavigationProvider>
                <TemplatesProvider>
                    <ContactsProvider>
                        <CampaignsProvider>
                            <AutomationsProvider>
                                <FunnelProvider>
                                    <DataProvider>
                                        {children}
                                    </DataProvider>
                                </FunnelProvider>
                            </AutomationsProvider>
                        </CampaignsProvider>
                    </ContactsProvider>
                </TemplatesProvider>
            </NavigationProvider>
        </AuthProvider>
    );
};
