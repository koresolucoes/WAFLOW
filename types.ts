
export type Page = 'dashboard' | 'campaigns' | 'template-editor' | 'profile';

export interface CompanyProfileData {
  name: string;
  description: string;
  products: string;
  audience: string;
  tone: string;
}

export interface MessageTemplate {
  id?: string;
  templateName: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | string;
  body: string;
}

export interface CampaignMetrics {
    month: string;
    sent: number;
    delivered: number;
    read: number;
}
