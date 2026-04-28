import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EMPTY, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.development';

export interface VehicleMaintenanceRecord {
  id?: number;
  vehicleId: number;
  recordDate: string;
  fuelLevel: number;
  engineCondition: number;
  tireCondition: number;
  brakeCondition: number;
  oilLevel: number;
  mileage: number;
  kmSinceLastService: number;
  daysSinceLastService: number;
  totalTransports: number;
  status: 'GOOD' | 'WARNING' | 'CRITICAL';
  notes: string;
  resolved: boolean;
}

export interface MaintenancePredictionResponse {
  vehicleId: number;
  vehicleModel: string;
  vehiclePlate: string;
  breakdownRisk: number;
  riskLevel: 'GOOD' | 'WARNING' | 'CRITICAL';
  overallAdvice: string;
  specificAdvices: string[];
  estimatedKmBeforeService: number;
  urgency: string;
  avgKmPerTransport: number;
  estimatedDaysUntilFailure: number;
  predictedMonthlyTransports: number;
  modelType: string;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly baseUrl = environment.apiUrl;
  private readonly maintenanceEndpoint = `${this.baseUrl}/api/vehicle-maintenance`;
  private readonly predictionEndpoint = `${this.baseUrl}/api/maintenance-prediction`;

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // Maintenance records endpoints
  getAll(): Observable<VehicleMaintenanceRecord[]> {
    return this.http.get<VehicleMaintenanceRecord[]>(this.maintenanceEndpoint, 
      { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[MaintenanceService] getAll failed', error);
        return of([]);
      })
    );
  }

  getById(id: number): Observable<VehicleMaintenanceRecord> {
    return this.http.get<VehicleMaintenanceRecord>(`${this.maintenanceEndpoint}/${id}`, 
      { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[MaintenanceService] getById failed', error);
        return EMPTY;
      })
    );
  }

  getByVehicleId(vehicleId: number): Observable<VehicleMaintenanceRecord[]> {
    return this.http.get<VehicleMaintenanceRecord[]>(
      `${this.maintenanceEndpoint}/vehicle/${vehicleId}`, 
      { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[MaintenanceService] getByVehicleId failed', error);
        return of([]);
      })
    );
  }

  getAlerts(): Observable<VehicleMaintenanceRecord[]> {
    return this.http.get<VehicleMaintenanceRecord[]>(
      `${this.maintenanceEndpoint}/alerts`, 
      { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[MaintenanceService] getAlerts failed', error);
        return of([]);
      })
    );
  }

  create(record: VehicleMaintenanceRecord): Observable<VehicleMaintenanceRecord> {
    console.log('[MaintenanceService] Creating maintenance record:', record);
    return this.http.post<VehicleMaintenanceRecord>(
      this.maintenanceEndpoint, record, 
      { headers: this.authHeaders() }).pipe(
      map((res) => {
        console.log('[MaintenanceService] create response:', res);
        return res;
      }),
      catchError((error) => {
        console.error('[MaintenanceService] create failed', error);
        return throwError(() => error);
      })
    );
  }

  update(id: number, record: VehicleMaintenanceRecord): Observable<VehicleMaintenanceRecord> {
    console.log('[MaintenanceService] Updating maintenance record', id, ':', record);
    return this.http.put<VehicleMaintenanceRecord>(
      `${this.maintenanceEndpoint}/${id}`, record, 
      { headers: this.authHeaders() }).pipe(
      map((res) => {
        console.log('[MaintenanceService] update response:', res);
        return res;
      }),
      catchError((error) => {
        console.error('[MaintenanceService] update failed', error);
        return throwError(() => error);
      })
    );
  }

  resolve(id: number): Observable<VehicleMaintenanceRecord> {
    return this.http.put<VehicleMaintenanceRecord>(
      `${this.maintenanceEndpoint}/${id}/resolve`, {}, 
      { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[MaintenanceService] resolve failed', error);
        return EMPTY;
      })
    );
  }

  // Prediction endpoints
  predictFromLatestRecord(vehicleId: number): Observable<MaintenancePredictionResponse> {
    return this.http.get<MaintenancePredictionResponse>(
      `${this.predictionEndpoint}/${vehicleId}`, 
      { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('[MaintenanceService] predictFromLatestRecord failed', error);
        return EMPTY;
      })
    );
  }

  analyzeMaintenanceData(vehicleId: number, 
    data: VehicleMaintenanceRecord): Observable<MaintenancePredictionResponse> {
    console.log('[MaintenanceService] Analyzing maintenance data for vehicle', vehicleId, ':', data);
    return this.http.post<MaintenancePredictionResponse>(
      `${this.predictionEndpoint}/${vehicleId}/analyze`, data, 
      { headers: this.authHeaders() }).pipe(
      map((res) => {
        console.log('[MaintenanceService] analysis response:', res);
        return res;
      }),
      catchError((error) => {
        console.error('[MaintenanceService] analyzeMaintenanceData failed', error);
        return throwError(() => error);
      })
    );
  }

  // Get all vehicles at risk of breakdown (CRITICAL or WARNING status)
  getVehiclesAtRisk(): Observable<MaintenancePredictionResponse[]> {
    return this.http.get<MaintenancePredictionResponse[]>(
      `${this.predictionEndpoint}/vehicles-at-risk`,
      { headers: this.authHeaders() }
    ).pipe(
      catchError((error) => {
        console.error('[MaintenanceService] getVehiclesAtRisk failed', error);
        return of([]);
      })
    );
  }
}
