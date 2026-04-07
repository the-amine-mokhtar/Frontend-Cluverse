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

export interface SponsorDto {
  id: number;
  name: string;
  contactEmail?: string;
  phone?: string;
}

export interface SponsorshipDto {
  id: number;
  amount: number;
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
}

export interface UpdateTransactionPayload {
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
}

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private readonly baseUrl = environment.apiUrl;

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