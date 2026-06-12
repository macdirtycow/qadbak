export type NewsletterSubscriberStatus = "active" | "pending" | "unsubscribed";

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string;
  status: NewsletterSubscriberStatus;
  source: string;
  subscribedAt?: string;
  confirmedAt?: string;
  unsubscribedAt?: string;
}

export interface NewsletterSettings {
  enabled: boolean;
  fromMailbox: string;
  fromName: string;
  doubleOptIn: boolean;
  signupEnabled: boolean;
  listId: string;
  welcomeSubject: string;
  welcomeBody: string;
}

export type NewsletterCampaignStatus = "draft" | "sending" | "sent" | "failed";

export interface NewsletterCampaignStats {
  total: number;
  sent: number;
  failed: number;
  remaining: number;
}

export interface NewsletterCampaign {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: NewsletterCampaignStatus;
  createdAt: string;
  updatedAt?: string;
  sentAt?: string;
  stats?: NewsletterCampaignStats;
  sendLog?: { email: string; ok: boolean; at: string; error?: string }[];
}

export interface NewsletterOverview {
  settings: NewsletterSettings;
  stats: {
    total: number;
    active: number;
    pending: number;
    unsubscribed: number;
  };
  campaigns: number;
  publicUrls: {
    confirm: string;
    unsubscribe: string;
    subscribe: string;
  };
}
