import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.development';
import { Transport, TransportStatus } from '../models/transport.model';
import { TransportPrediction } from '../models/transport-prediction.model';

@Injectable({ providedIn: 'root' })
export class TransportService {
  private readonly baseUrl = environment.apiUrl;
  private readonly endpoint = `${this.baseUrl}/api/transports`;

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAll(): Observable<Transport[]> {
    return this.http.get<Transport[]>(this.endpoint, { headers: this.authHeaders() }).pipe(
      map((items) => (Array.isArray(items) ? items : [])),
      catchError((error) => {
        console.error('[TransportService] getAll failed', error);
        return of([]);
      })
    );
  }

  getById(id: number): Observable<Transport> {
    return this.http.get<Transport>(`${this.endpoint}/${id}`, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[TransportService] getById failed', error);
        return EMPTY;
      })
    );
  }

  getByEvent(eventId: number): Observable<Transport[]> {
    // No dedicated backend endpoint; filter client-side.
    return this.getAll().pipe(
      map((items) => items.filter((t) => Number((t as any).eventId ?? 0) === Number(eventId))),
      catchError((error) => {
        console.error('[TransportService] getByEvent failed', error);
        return of([]);
      })
    );
  }

  getUpcoming(): Observable<Transport[]> {
    const allowedStatuses: TransportStatus[] = ['PLANNED', 'IN_PROGRESS'];

    return this.getAll().pipe(
      map((items) => {
        const filtered = items.filter((t) => allowedStatuses.includes(t.status));
        return filtered.sort((a, b) => {
          const aTime = this.toTime(a.scheduledDate);
          const bTime = this.toTime(b.scheduledDate);
          return aTime - bTime;
        });
      }),
      catchError((error) => {
        console.error('[TransportService] getUpcoming failed', error);
        return of([]);
      })
    );
  }

  create(payload: Partial<Transport>): Observable<Transport> {
    // Backend expects TransportRequest: { scheduledDate, departureLocationId, arrivalLocationId, status, vehicleId, userId, eventId }
    return this.http.post<Transport>(this.endpoint, payload, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[TransportService] create failed', error);
        return EMPTY;
      })
    );
  }

  update(id: number, payload: Partial<Transport>): Observable<Transport> {
    return this.http.put<Transport>(`${this.endpoint}/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[TransportService] update failed', error);
        return EMPTY;
      })
    );
  }

  updateStatus(id: number, status: TransportStatus): Observable<Transport> {
    // No dedicated PATCH endpoint; backend PUT requires a complete TransportRequest.
    // We fetch the current transport then send a full payload with updated status.
    return this.getById(id).pipe(
      switchMap((current) =>
        this.update(id, {
          scheduledDate: current.scheduledDate,
          departureLocationId: current.departureLocationId,
          arrivalLocationId: current.arrivalLocationId,
          status,
          vehicleId: current.vehicleId,
          userId: current.userId,
          eventId: current.eventId
        })
      ),
      catchError((error) => {
        console.error('[TransportService] updateStatus failed', error);
        return EMPTY;
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${id}`, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[TransportService] delete failed', error);
        return EMPTY;
      })
    );
  }

  /**
   * Auto-update all transport statuses based on scheduled dates.
   * Completes PLANNED transports with past dates.
   */
  updateAllStatuses(): Observable<any> {
    return this.http.post<any>(`${this.endpoint}/update-statuses`, {}, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[TransportService] updateAllStatuses failed', error);
        return of({ success: false, updatedCount: 0 });
      })
    );
  }

  getPrediction(
    departureLocationId: number,
    arrivalLocationId: number,
    scheduledDate: string,
    departureCityName?: string,
    arrivalCityName?: string
  ): Observable<TransportPrediction> {
    let params = new HttpParams()
      .set('departureLocationId', departureLocationId.toString())
      .set('arrivalLocationId', arrivalLocationId.toString())
      .set('scheduledDate', scheduledDate);
    
    if (departureCityName) {
      params = params.set('departureName', departureCityName);
    }
    if (arrivalCityName) {
      params = params.set('arrivalName', arrivalCityName);
    }
    
    return this.http.get<TransportPrediction>(`${this.endpoint}/prediction`, {
      headers: this.authHeaders(),
      params
    }).pipe(
      catchError((error) => {
        console.error('[TransportService] getPrediction failed', error);
        return EMPTY;
      })
    );
  }

  private toTime(value: unknown): number {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }

    const text = String(value).trim();
    if (!text) {
      return Number.POSITIVE_INFINITY;
    }

    const time = new Date(text).getTime();
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
  }
}
