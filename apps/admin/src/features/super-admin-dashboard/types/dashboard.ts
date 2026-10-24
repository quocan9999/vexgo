export type PlatformCompanySummary = {
  id: number;
  code: string;
  name: string;
  status: string;
  createdAt: string;
  activeAdministratorCount: number;
};

export type DashboardOverview = {
  generatedAt: string;
  timeZone: string;
  companies: {
    total: number;
    active: number;
    suspended: number;
    other: number;
    needingAdministrator: number;
  };
  administrators: { total: number; active: number };
  onboarding: Array<{ label: string; count: number; currentMonth: boolean }>;
  attentionCompanies: PlatformCompanySummary[];
  recentCompanies: PlatformCompanySummary[];
};
