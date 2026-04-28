import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment.development';

export interface PendingApproval {
  id: string;
  sessionId: string;
  actionName: string;
  scope: string;
  summary: string;
  createdAt: string;
  expiresAt: string;
  status: string;
}

export interface TreasurerChatResponse {
  sessionId: string;
  reply: string;
  pendingApprovals: PendingApproval[];
}

export interface TreasurerApprovalResponse {
  sessionId: string;
  outcome: {
    id: string;
    actionName: string;
    summary: string;
    status: string;
    result?: Record<string, unknown>;
    error?: string;
  };
  pendingApprovals: PendingApproval[];
}

@Injectable({
  providedIn: 'root'
})
export class TreasurerAssistantService {
  private readonly baseUrl = environment.treasurerAssistantUrl;

  constructor(private readonly http: HttpClient) {}

  chat(message: string, sessionId?: string): Observable<TreasurerChatResponse> {
    return this.http.post<TreasurerChatResponse>(`${this.baseUrl}/api/treasurer-assistant/chat`, {
      message,
      sessionId
    });
  }

  approve(sessionId: string, approvalId: string): Observable<TreasurerApprovalResponse> {
    return this.http.post<TreasurerApprovalResponse>(`${this.baseUrl}/api/treasurer-assistant/approve`, {
      sessionId,
      approvalId
    });
  }

  reject(sessionId: string, approvalId: string): Observable<TreasurerApprovalResponse> {
    return this.http.post<TreasurerApprovalResponse>(`${this.baseUrl}/api/treasurer-assistant/reject`, {
      sessionId,
      approvalId
    });
  }
}
