import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface SmsNotification {
  id: number;
  participationId: number;
  eventId: number;
  phoneNumber: string;
  message: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt: string;
  smsProviderReference?: string;
  errorMessage?: string;
}

export interface SmsHistoryResponse {
  participationId: number;
  count: number;
  notifications: SmsNotification[];
}

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class SmsNotificationService {
  private apiUrl = `${environment.eventsApiUrl}/api/sms-notifications`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Get SMS history for a specific participation
   * @param participationId ID of the participation
   * @returns Observable of SMS history
   */
  getSmsHistory(participationId: number): Observable<SmsHistoryResponse> {
    return this.http.get<SmsHistoryResponse>(
      `${this.apiUrl}/history/${participationId}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(result => console.log(`[SMS] History fetched for participation ${participationId}:`, result)),
      catchError(err => {
        console.error('Error fetching SMS history:', err);
        // Return empty history if not found
        return of({
          participationId,
          count: 0,
          notifications: []
        });
      })
    );
  }

  /**
   * Get SMS service status
   * @returns Observable of service status
   */
  getSmsStatus(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/status`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(status => console.log('[SMS] Service status:', status)),
      catchError(err => {
        console.error('Error fetching SMS status:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Send test SMS (development only)
   * @param participationId ID of the participation
   * @param eventId ID of the event
   * @param phone Phone number
   * @returns Observable of send result
   */
  sendTestSms(participationId: number, eventId: number, phone: string): Observable<any> {
    const params = new URLSearchParams();
    params.append('participationId', participationId.toString());
    params.append('eventId', eventId.toString());
    params.append('phone', phone);

    return this.http.post<any>(
      `${this.apiUrl}/send-test?${params.toString()}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(result => console.log('[SMS] Test SMS sent:', result)),
      catchError(err => {
        console.error('Error sending test SMS:', err);
        return throwError(() => err);
      })
    );
  }
}
