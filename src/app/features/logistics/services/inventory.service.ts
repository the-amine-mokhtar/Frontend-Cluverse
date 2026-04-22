import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EMPTY, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.development';
import {
  InventoryTransaction,
  InventoryTransactionCreatePayload
} from '../models/inventory-transaction.model';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly baseUrl = environment.apiUrl;
  private readonly endpoint = `${this.baseUrl}/api/inventory-transactions`;

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getByResource(resourceId: number): Observable<InventoryTransaction[]> {
    return this.http
      .get<InventoryTransaction[]>(`${this.endpoint}/resource/${resourceId}`, {
        headers: this.authHeaders()
      })
      .pipe(
        catchError((error) => {
          console.error('[InventoryService] getByResource failed', error);
          return of([]);
        })
      );
  }

  create(payload: InventoryTransactionCreatePayload): Observable<InventoryTransaction> {
    // Backend DTO: { type, quantity, date, reason, resourceId }
    // Backend sets `applied=true` automatically on creation.
    return this.http
      .post<InventoryTransaction>(this.endpoint, payload, {
        headers: this.authHeaders()
      })
      .pipe(
        catchError((error) => {
          console.error('[InventoryService] create failed', error);
          return EMPTY;
        })
      );
  }
}
