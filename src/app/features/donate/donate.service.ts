import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';

export interface ClubSummary {
  id: number;
  name: string;
}

export interface DonatePaymentIntentPayload {
  amountCents: number;
  currency: string;
  sponsorName: string;
  sponsorEmail: string;
  sponsorPhone: string;
  reference: string;
}

export interface DonatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  publishableKey: string;
}

export interface DonateStripeConfigResponse {
  publishableKey: string;
}

export interface DonateTransactionPayload {
  type: 'INCOME';
  amount: number;
  date: string;
  description: string;
}

export interface DonateTransactionResponse {
  id: number;
}

export interface DonateReceiptPayload {
  sponsorName: string;
  sponsorEmail: string;
  sponsorPhone: string;
  clubName: string;
  amountEur: number;
  amountTnd: number;
  reference: string;
  paymentIntentId: string;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class DonateService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getAllClubs(): Observable<ClubSummary[]> {
    return this.http.get<ClubSummary[]>(`${this.baseUrl}/api/clubs`, { headers: this.authHeaders() });
  }

  getStripePublicConfig(): Observable<DonateStripeConfigResponse> {
    return this.http.get<DonateStripeConfigResponse>(`${this.baseUrl}/api/stripe/public-config`, { headers: this.authHeaders() });
  }

  createPaymentIntent(payload: DonatePaymentIntentPayload): Observable<DonatePaymentIntentResponse> {
    return this.http.post<DonatePaymentIntentResponse>(
      `${this.baseUrl}/api/stripe/create-payment-intent`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  sendDonationReceipt(payload: DonateReceiptPayload): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${this.baseUrl}/api/stripe/send-receipt`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  createTransaction(clubId: number, payload: DonateTransactionPayload): Observable<DonateTransactionResponse> {
    const body = { ...payload, club: { id: clubId } };
    return this.http.post<DonateTransactionResponse>(`${this.baseUrl}/api/transactions`, body, {
      headers: this.authHeaders(),
      params: new HttpParams().set('clubId', String(clubId))
    });
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
