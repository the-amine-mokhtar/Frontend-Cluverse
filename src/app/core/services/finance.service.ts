import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../environments/environment.development';

export type BudgetCategory = 'EVENTS' | 'EQUIPMENT' | 'MARKETING' | 'TRAVEL' | 'OPERATIONS' | 'OTHER';
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface BudgetDto {
  id: number;
  year: number;
  totalAllocated: number;
  category: BudgetCategory;
}

export interface TransactionDto {
  id: number;
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
}

export interface CreateBudgetPayload {
  year: number;
  totalAllocated: number;
  category: BudgetCategory;
}

export interface CreateTransactionPayload {
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
    const financeEndpoint = `${this.baseUrl}/api/finance/budgets`;
    const budgetsEndpoint = `${this.baseUrl}/api/budgets`;

    return this.http.get<BudgetDto[]>(financeEndpoint, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    }).pipe(
      catchError(() => {
        return this.http.get<BudgetDto[]>(`${financeEndpoint}/club/${clubId}`, {
          headers: this.authHeaders()
        });
      }),
      catchError(() => {
        return this.http.get<BudgetDto[]>(budgetsEndpoint, {
          headers: this.authHeaders(),
          params: new HttpParams().set('clubId', String(clubId))
        });
      }),
      catchError(() => {
        return this.http.get<BudgetDto[]>(`${this.baseUrl}/api/clubs/${clubId}/budgets`, {
          headers: this.authHeaders()
        });
      })
    );
  }

  createBudget(clubId: number, payload: CreateBudgetPayload): Observable<BudgetDto> {
    const financeEndpoint = `${this.baseUrl}/api/finance/budgets`;
    const budgetsEndpoint = `${this.baseUrl}/api/budgets`;
    const bodyWithClubId = { ...payload, clubId };
    const bodyWithClubObject = { ...payload, club: { id: clubId } };

    return this.http.post<BudgetDto>(financeEndpoint, bodyWithClubId, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    }).pipe(
      catchError(() => {
        return this.http.post<BudgetDto>(financeEndpoint, bodyWithClubObject, {
          headers: this.authHeaders()
        });
      }),
      catchError(() => {
        return this.http.post<BudgetDto>(`${financeEndpoint}/club/${clubId}`, payload, {
          headers: this.authHeaders()
        });
      }),
      catchError(() => {
        return this.http.post<BudgetDto>(budgetsEndpoint, bodyWithClubId, {
          headers: this.authHeaders(),
          params: new HttpParams().set('clubId', String(clubId))
        });
      }),
      catchError(() => {
        return this.http.post<BudgetDto>(`${this.baseUrl}/api/clubs/${clubId}/budgets`, payload, {
          headers: this.authHeaders()
        });
      })
    );
  }

  getTransactions(clubId: number): Observable<TransactionDto[]> {
    const endpoint = `${this.baseUrl}/api/finance/transactions`;
    return this.http.get<TransactionDto[]>(endpoint, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    }).pipe(
      catchError(() => {
        return this.http.get<TransactionDto[]>(`${endpoint}/club/${clubId}`, {
          headers: this.authHeaders()
        });
      })
    );
  }

  createTransaction(clubId: number, payload: CreateTransactionPayload): Observable<TransactionDto> {
    const endpoint = `${this.baseUrl}/api/finance/transactions`;
    const body = { ...payload, clubId };
    return this.http.post<TransactionDto>(endpoint, body, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    }).pipe(
      catchError(() => {
        return this.http.post<TransactionDto>(`${endpoint}/club/${clubId}`, body, {
          headers: this.authHeaders()
        });
      })
    );
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}