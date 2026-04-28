import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { TransactionDto, BudgetDto } from '../../core/services/finance.service';

export interface AgentContext {
  transactions: TransactionDto[];
  budgets: BudgetDto[];
  apiUrl: string;
  token: string;
  clubId: number;
}

export interface AgentResponse {
  reply: string;
  data: unknown;
  intent: string;
  sessionId: string;
}

@Injectable({ providedIn: 'root' })
export class FinancialAgentService {
  private readonly base = environment.financialAgentUrl;

  constructor(private readonly http: HttpClient) {}

  chat(message: string, sessionId: string, lang: 'en' | 'fr', context?: AgentContext): Observable<AgentResponse> {
    return this.http.post<AgentResponse>(`${this.base}/api/financial-agent/chat`, { message, sessionId, lang, context });
  }
}
