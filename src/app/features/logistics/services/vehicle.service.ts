import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EMPTY, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.development';
import { Vehicle } from '../models/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly baseUrl = environment.apiUrl;
  private readonly endpoint = `${this.baseUrl}/api/vehicles`;

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAll(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(this.endpoint, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[VehicleService] getAll failed', error);
        return of([]);
      })
    );
  }

  getById(id: number): Observable<Vehicle> {
    return this.http.get<Vehicle>(`${this.endpoint}/${id}`, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[VehicleService] getById failed', error);
        return EMPTY;
      })
    );
  }

  getAvailable(): Observable<Vehicle[]> {
    // No dedicated backend endpoint; filter client-side.
    return this.getAll().pipe(
      map((items) => items.filter((v) => Boolean((v as any).available) === true)),
      catchError((error) => {
        console.error('[VehicleService] getAvailable failed', error);
        return of([]);
      })
    );
  }

  create(payload: Partial<Vehicle>): Observable<Vehicle> {
    // Backend accepts Vehicle entity directly.
    return this.http.post<Vehicle>(this.endpoint, payload, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[VehicleService] create failed', error);
        return EMPTY;
      })
    );
  }

  update(id: number, payload: Partial<Vehicle>): Observable<Vehicle> {
    // Backend uses PUT /api/vehicles/{id} and sets the id internally.
    return this.http.put<Vehicle>(`${this.endpoint}/${id}`, payload, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[VehicleService] update failed', error);
        return EMPTY;
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${id}`, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[VehicleService] delete failed', error);
        return EMPTY;
      })
    );
  }
}
