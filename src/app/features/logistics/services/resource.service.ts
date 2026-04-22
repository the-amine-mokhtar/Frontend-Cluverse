import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.development';
import { Resource } from '../models/resource.model';

@Injectable({ providedIn: 'root' })
export class ResourceService {
  private readonly baseUrl = environment.apiUrl;
  private readonly endpoint = `${this.baseUrl}/api/resources`;

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAll(clubId: number): Observable<Resource[]> {
    // Backend currently exposes GET /api/resources with no club filter.
    // We still send clubId as a query param for forward-compat.
    const params = new HttpParams().set('clubId', String(clubId));

    return this.http
      .get<Resource[]>(this.endpoint, { headers: this.authHeaders(), params })
      .pipe(
        map((items) => {
          if (!Array.isArray(items)) {
            return [];
          }

          // Best-effort client-side filter if the backend later exposes clubId.
          const filtered = items.filter((item: any) => {
            const itemClubId = Number(item?.clubId ?? item?.club?.id ?? 0);
            return !clubId || itemClubId === clubId;
          });

          return clubId ? filtered : items;
        }),
        catchError((error) => {
          console.error('[ResourceService] getAll failed', error);
          return of([]);
        })
      );
  }

  getById(id: number): Observable<Resource> {
    return this.http
      .get<Resource>(`${this.endpoint}/${id}`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('[ResourceService] getById failed', error);
          return throwError(() => error);
        })
      );
  }

  create(resource: Partial<Resource>): Observable<Resource> {
    return this.http
      .post<Resource>(this.endpoint, resource, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('[ResourceService] create failed', error);
          return throwError(() => error);
        })
      );
  }

  update(id: number, resource: Partial<Resource>): Observable<Resource> {
    return this.http
      .put<Resource>(`${this.endpoint}/${id}`, resource, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('[ResourceService] update failed', error);
          return throwError(() => error);
        })
      );
  }

  uploadImage(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post(`${this.endpoint}/upload-image`, formData, {
        headers: this.authHeaders(),
        responseType: 'text'
      })
      .pipe(
        catchError((error) => {
          console.error('[ResourceService] uploadImage failed', error);
          return throwError(() => error);
        })
      );
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.endpoint}/${id}`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('[ResourceService] delete failed', error);
          return throwError(() => error);
        })
      );
  }

  getLowStock(clubId: number): Observable<Resource[]> {
    // UI definition: availableQuantity <= lowStockThreshold (derived, not a backend status).
    return this.getAll(clubId).pipe(
      map((items) =>
        items.filter(
          (r) => Number(r.availableQuantity) <= Number(r.lowStockThreshold)
        )
      ),
      catchError((error) => {
        console.error('[ResourceService] getLowStock failed', error);
        return of([]);
      })
    );
  }

  getByBarcode(barcode: string): Observable<Resource> {
    return this.http
      .get<Resource>(`${this.endpoint}/barcode/${barcode}`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('[ResourceService] getByBarcode failed', error);
          return throwError(() => error);
        })
      );
  }
}
