
import React, { ReactNode } from 'react';
import { NavigationProvider } from './providers/NavigationContext';
import { DataProvider } from './providers/DataProvider';
import { TemplatesProvider } from './providers/TemplatesContext';
import { ContactsProvider } from './providers/ContactsContext';
import { CampaignsProvider } from './providers/CampaignsContext';
import { AutomationsProvider } from './providers/AutomationsContext';
import { FunnelProvider } from './providers/FunnelContext';
import { InboxProvider } from './providers/InboxContext';
import { CustomFieldsProvider } from './providers/CustomFieldsContext';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <NavigationProvider>
            <TemplatesProvider>
                <ContactsProvider>
                    <CampaignsProvider>
                        <AutomationsProvider>
                            <FunnelProvider>
                                <InboxProvider>
                                    <CustomFieldsProvider>
                                        <DataProvider>
                                            {children}
                                        </DataProvider>
                                    </CustomFieldsProvider>
                                </InboxProvider>
                            </FunnelProvider>
                        </AutomationsProvider>
                    </CampaignsProvider>
                </ContactsProvider>
            </TemplatesProvider>
        </NavigationProvider>
    );
};
