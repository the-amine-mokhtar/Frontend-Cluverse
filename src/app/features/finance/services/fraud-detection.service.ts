import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FraudAlert {
  internalId:      number;
  stripeEventId:   string;
  transactionId:   string;
  eventType:       string;
  amount:          number;
  currency:        string;
  status:          string;
  riskScore:       number;
  severity:        FraudSeverity;
  reasons:         string[];
  mlAnomalyScore:  number;
  customerId:      string | null;
  description:     string;
  flaggedAt:       string;
  dismissed:       boolean;
  dismissedAt?:    string;
}

export interface FraudAlertStats {
  total:    number;
  active:   number;
  critical: number;
  high:     number;
  medium:   number;
  low:      number;
}

@Injectable({ providedIn: 'root' })
export class FraudDetectionService {
  private readonly baseUrl = 'http://localhost:8092';

  constructor(private readonly http: HttpClient) {}

  getAlerts(options: {
    severity?: FraudSeverity;
    dismissed?: boolean;
    limit?: number;
  } = {}): Observable<{ alerts: FraudAlert[] }> {
    let params = new HttpParams();
    if (options.severity !== undefined) params = params.set('severity', options.severity);
    if (options.dismissed !== undefined) params = params.set('dismissed', String(options.dismissed));
    if (options.limit !== undefined) params = params.set('limit', String(options.limit));
    return this.http.get<{ alerts: FraudAlert[] }>(`${this.baseUrl}/api/fraud-alerts`, { params });
  }

  getStats(): Observable<FraudAlertStats> {
    return this.http.get<FraudAlertStats>(`${this.baseUrl}/api/fraud-alerts/stats`);
  }

  dismissAlert(id: number | string): Observable<{ dismissed: boolean }> {
    return this.http.patch<{ dismissed: boolean }>(
      `${this.baseUrl}/api/fraud-alerts/${id}/dismiss`,
      {}
    );
  }

  simulateTransaction(payload: {
    amount?: number;
    currency?: string;
    status?: string;
    customer?: string;
    description?: string;
    // Stripe Radar scenario fields
    stripeRiskLevel?:   'normal' | 'elevated' | 'highest';
    stripeRiskScore?:   number;
    stripeOutcomeType?: 'authorized' | 'blocked' | 'issuer_declined' | 'manual_review';
    cvcCheck?:          'pass' | 'fail';
    postalCheck?:       'pass' | 'fail';
    addressCheck?:      'pass' | 'fail';
    isEarlyFraudWarning?: boolean;
    fraudType?:         string;
    isDispute?:         boolean;
    disputeReason?:     string;
  }): Observable<{ alert: FraudAlert; stored: boolean }> {
    return this.http.post<{ alert: FraudAlert; stored: boolean }>(
      `${this.baseUrl}/api/fraud-alerts/simulate`,
      payload
    );
  }
}
