import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EMPTY, Observable, of, throwError } from 'rxjs';
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
        return throwError(() => error);
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
    console.log('[VehicleService] Creating vehicle with payload:', payload);
    return this.http.post<Vehicle>(this.endpoint, payload, { headers: this.authHeaders() }).pipe(
      map((res) => {
        console.log('[VehicleService] create response:', res);
        return res;
      }),
      catchError((error) => {
        console.error('[VehicleService] create failed', error);
        return throwError(() => error);
      })
    );
  }

  update(id: number, payload: Partial<Vehicle>): Observable<Vehicle> {
    // Backend uses PUT /api/vehicles/{id} and sets the id internally.
    console.log('[VehicleService] Updating vehicle', id, 'with payload:', payload);
    return this.http.put<Vehicle>(`${this.endpoint}/${id}`, payload, { headers: this.authHeaders() }).pipe(
      map((res) => {
        console.log('[VehicleService] update response:', res);
        return res;
      }),
      catchError((error) => {
        console.error('[VehicleService] update failed', error);
        return throwError(() => error);
      })
    );
  }

  delete(id: number): Observable<void> {
    console.log('[VehicleService] Deleting vehicle', id);
    return this.http.delete<void>(`${this.endpoint}/${id}`, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[VehicleService] delete failed', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get fuel status for a vehicle including remaining range and alert status
   */
  getFuelStatus(vehicleId: number): Observable<any> {
    return this.http.get<any>(`${this.endpoint}/${vehicleId}/fuel-status`, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[VehicleService] getFuelStatus failed', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get nearest fuel stations for a vehicle at given coordinates
   */
  getNearestFuelStations(vehicleId: number, latitude: number, longitude: number, limit: number = 3): Observable<any> {
    const params = `?latitude=${latitude}&longitude=${longitude}&limit=${limit}`;
    return this.http.get<any>(`${this.endpoint}/${vehicleId}/fuel-stations${params}`, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[VehicleService] getNearestFuelStations failed', error);
        return throwError(() => error);
      })
    );
  }
}
