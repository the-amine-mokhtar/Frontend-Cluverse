import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment.development';
import { TransportPlannerResponse } from '../models/transport-planner.model';

@Injectable({ providedIn: 'root' })
export class TransportPlannerService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHeaders() {
    return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` };
  }

  getPlan(startDate: string, endDate: string): 
      Observable<TransportPlannerResponse> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    const url = `${this.apiUrl}/api/transport-planner/plan`;
    console.log('Planner Service: Calling URL:', url);
    console.log('Planner Service: Headers:', this.getHeaders());
    return this.http.get<TransportPlannerResponse>(
      url,
      { headers: this.getHeaders(), params }
    ).pipe(
      catchError((error) => {
        console.error('❌ Planner API error:', error);
        console.error('Status:', error.status);
        console.error('URL called:', error.url);
        console.error('Error message:', error.message);
        return throwError(() => error);
      })
    );
  }
}
