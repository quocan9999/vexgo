export type RevenueReportGroupBy = 'day' | 'month' | 'quarter';

export type RevenueReportQuery = {
  fromDate?: string;
  toDate?: string;
  groupBy: RevenueReportGroupBy;
};

export type RevenueReportServiceKind =
  | 'ticket'
  | 'standaloneShipment'
  | 'accompaniedShipment';

export type RevenueReportMoney = {
  grossReceipts: string;
  refundAmount: string;
  netRevenue: string;
  netTicketRevenue: string;
  netShipmentRevenue: string;
};

export type RevenueReportTotals = RevenueReportMoney & {
  successfulPayments: number;
  soldTicketCount: number;
  issuedShipmentCount: number;
};

export type RevenueReportSeriesItem = RevenueReportTotals & {
  period: string;
};

export type RevenueReportBreakdownItem = {
  kind: RevenueReportServiceKind;
  label: string;
  grossReceipts: string;
  refundAmount: string;
  netRevenue: string;
};

export type RevenueReport = {
  currency: 'VND';
  reconciliation: { refundCount: number; refundAmount: string };
  totals: RevenueReportTotals;
  serviceBreakdown: RevenueReportBreakdownItem[];
  series: RevenueReportSeriesItem[];
};

export type RevenueReportMeta = {
  fromDate: string;
  toDate: string;
  groupBy: RevenueReportGroupBy;
  timezone: 'Asia/Ho_Chi_Minh';
};

export type RevenueReportResponse = {
  data: RevenueReport;
  meta: RevenueReportMeta;
};
