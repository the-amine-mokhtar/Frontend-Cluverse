import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment.development';

export type BudgetCategory = 'EVENTS' | 'EQUIPMENT' | 'MARKETING' | 'TRAVEL' | 'OPERATIONS' | 'OTHER';
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface BudgetDto {
  id: number;
  year: number | string;
  totalAllocated: number;
  eventId?: number | null;
  event?: { id?: number; title?: string } | null;
  budgetType?: string;
  category?: BudgetCategory;
}

export interface TransactionDto {
  id: number;
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
}

export type ForecastHorizon = 1 | 3 | 6;

export interface ForecastFactor {
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
}

export interface MonthlyForecastPoint {
  monthLabel: string;
  projectedInflow: number;
  projectedOutflow: number;
  projectedNet: number;
  eventOutflowShare: number;
}

export interface AiCashFlowProjection {
  horizonMonths: ForecastHorizon;
  projectedInflow: number;
  projectedOutflow: number;
  projectedNet: number;
  confidenceScore: number;
  confidenceLevel?: 'Low' | 'Medium' | 'High';
  riskLevel?: 'Low' | 'Moderate' | 'High';
  dataQualityScore?: number;
  errorBandRatio: number;
  netLowerBound: number;
  netUpperBound: number;
  expectedClosingBalance?: number;
  closingLowerBound?: number;
  closingUpperBound?: number;
  backtestMape: number;
  backtestHitRate: number;
  backtestSampleSize: number;
  summary?: string;
  actionItems?: string[];
  factors: ForecastFactor[];
  monthlyBreakdown: MonthlyForecastPoint[];
}

export interface AiInsights {
  personalizedSummary: string;
  recommendations: string[];
  keyRisks: string[];
  opportunity: string;
}

export interface AiCashFlowForecastResult {
  modelVersion?: string;
  asOfDate: string;
  projections: AiCashFlowProjection[];
  aiInsights?: AiInsights;
}

export interface CashflowForecastRequest {
  asOfDate: string;
  horizons: ForecastHorizon[];
  transactions: TransactionDto[];
  budgets: BudgetDto[];
  currentCashBalance?: number | null;
}

export interface SponsorDto {
  id: number;
  name: string;
  contactEmail?: string;
  phone?: string;
}

export interface SponsorshipDto {
  id: number;
  amount: number;
  sponsorId?: number;
  sponsorName?: string;
  agreedAmount?: number;
  expectedAmount?: number;
  paidAmount?: number;
  eventName?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  sponsor?: SponsorDto;
  club?: { id?: number };
}

export interface EventDto {
  id: number;
  title: string;
  club?: { id?: number };
}

export interface CreateBudgetPayload {
  year: number | string;
  totalAllocated: number;
  eventId?: number | null;
  category?: BudgetCategory;
}

export interface UpdateBudgetPayload {
  year: number | string;
  totalAllocated: number;
  eventId?: number | null;
  category?: BudgetCategory;
}

export interface CreateTransactionPayload {
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
  sponsor?: { id: number };
  sponsorship?: { id: number };
}

export interface UpdateTransactionPayload {
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
  sponsor?: { id: number };
  sponsorship?: { id: number };
}

export interface CreateStripePaymentIntentPayload {
  amountCents: number;
  currency: string;
  sponsorName: string;
  sponsorEmail: string;
  sponsorPhone: string;
  reference: string;
}

export interface CreateStripePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  publishableKey: string;
}

export interface StripePublicConfigResponse {
  publishableKey: string;
}

export interface BudgetAlertEmailItemPayload {
  title: string;
  department: string;
  utilization: number;
  reachedThreshold: number;
  level: 'warning' | 'critical' | 'limit';
}

export interface BudgetAlertEmailPayload {
  recipientEmail?: string;
  recipientName?: string;
  clubName?: string;
  exerciseYear?: number;
  alerts: BudgetAlertEmailItemPayload[];
  triggeredAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private readonly baseUrl = environment.apiUrl;
  private readonly forecastApiUrl = environment.forecastApiUrl;

  constructor(private readonly http: HttpClient) {}

  getBudgets(clubId: number): Observable<BudgetDto[]> {
    return this.http.get<Array<BudgetDto & { club?: { id?: number } }>>(`${this.baseUrl}/api/budgets`, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    }).pipe(
      map((budgets) => budgets.filter((budget) => this.belongsToClub(budget.club?.id, clubId)))
    );
  }

  createBudget(clubId: number, payload: CreateBudgetPayload): Observable<BudgetDto> {
    const body = {
      year: this.normalizeYear(payload.year),
      totalAllocated: payload.totalAllocated,
      club: { id: clubId },
      event: payload.eventId ? { id: payload.eventId } : null
    };

    return this.http.post<BudgetDto>(`${this.baseUrl}/api/budgets`, body, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    });
  }

  updateBudget(clubId: number, budgetId: number, payload: UpdateBudgetPayload): Observable<BudgetDto> {
    const body = {
      year: this.normalizeYear(payload.year),
      totalAllocated: payload.totalAllocated,
      club: { id: clubId },
      event: payload.eventId ? { id: payload.eventId } : null
    };

    return this.http.put<BudgetDto>(`${this.baseUrl}/api/budgets/${budgetId}`, body, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    });
  }

  deleteBudget(clubId: number, budgetId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/budgets/${budgetId}`, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    });
  }

  getTransactions(clubId: number): Observable<TransactionDto[]> {
    return this.http.get<Array<TransactionDto & { club?: { id?: number } }>>(`${this.baseUrl}/api/transactions`, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    }).pipe(
      map((transactions) => transactions.filter((transaction) => this.belongsToClub(transaction.club?.id, clubId)))
    );
  }

  getSponsors(): Observable<SponsorDto[]> {
    return this.http.get<SponsorDto[]>(`${this.baseUrl}/api/sponsors`, {
      headers: this.authHeaders()
    });
  }

  getSponsorships(clubId: number): Observable<SponsorshipDto[]> {
    return this.http.get<SponsorshipDto[]>(`${this.baseUrl}/api/sponsorships`, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    }).pipe(
      map((sponsorships) => sponsorships.filter((item) => this.belongsToClub(item.club?.id, clubId)))
    );
  }

  getEvents(clubId: number): Observable<EventDto[]> {
    return this.http.get<EventDto[]>(`${this.baseUrl}/api/events`, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    }).pipe(
      map((events) => events.filter((item) => this.belongsToClub(item.club?.id, clubId)))
    );
  }

  createTransaction(clubId: number, payload: CreateTransactionPayload): Observable<TransactionDto> {
    const body = { ...payload, club: { id: clubId } };

    return this.http.post<TransactionDto>(`${this.baseUrl}/api/transactions`, body, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    });
  }

  updateTransaction(clubId: number, transactionId: number, payload: UpdateTransactionPayload): Observable<TransactionDto> {
    const body = { ...payload, club: { id: clubId } };

    return this.http.put<TransactionDto>(`${this.baseUrl}/api/transactions/${transactionId}`, body, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    });
  }

  deleteTransaction(clubId: number, transactionId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/transactions/${transactionId}`, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    });
  }

  createStripePaymentIntent(payload: CreateStripePaymentIntentPayload): Observable<CreateStripePaymentIntentResponse> {
    return this.http.post<CreateStripePaymentIntentResponse>(`${this.baseUrl}/api/stripe/create-payment-intent`, payload, {
      headers: this.authHeaders()
    });
  }

  getStripePublicConfig(): Observable<StripePublicConfigResponse> {
    return this.http.get<StripePublicConfigResponse>(`${this.baseUrl}/api/stripe/public-config`, {
      headers: this.authHeaders()
    });
  }

  getCashflowForecast(payload: CashflowForecastRequest): Observable<AiCashFlowForecastResult> {
    return this.http.post<AiCashFlowForecastResult>(`${this.forecastApiUrl}/v1/forecast/cashflow`, payload, {
      headers: this.authHeaders()
    });
  }

  sendBudgetAlertEmail(payload: BudgetAlertEmailPayload): Observable<string> {
    return this.http.post(`${this.baseUrl}/api/notifications/budget-alert-email`, payload, {
      headers: this.authHeaders(),
      responseType: 'text'
    });
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private belongsToClub(entityClubId: number | undefined, clubId: number): boolean {
    return entityClubId === undefined || entityClubId === clubId;
  }

  private normalizeYear(year: number | string): string {
    if (typeof year === 'number') {
      return `${year}-01-01`;
    }

    const parsed = new Date(year);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    const numericYear = Number(year);
    if (Number.isFinite(numericYear)) {
      return `${numericYear}-01-01`;
    }

    return `${new Date().getFullYear()}-01-01`;
  }
}