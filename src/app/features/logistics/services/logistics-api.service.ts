import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.development';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED';
export type TransportStatus = 'PLANNED' | 'IN_PROGRESS' | 'CANCELED' | 'CANCELLED' | 'COMPLETED';
export type ResourceStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';
export type InventoryTransactionType = 'ADD' | 'REMOVE' | 'UPDATE';

export interface ResourceItem {
  id: number;
  name: string;
  description: string;
  unitCost: number;
  status: ResourceStatus;
  imageUrl: string;
  quantity: number;
  quantityTotal: number;
  availableQuantity: number;
  lastUpdated: string;
  lowStockThreshold: number;
  notes: string;
  clubId?: number;
}

export interface ResourceCreatePayload {
  name: string;
  description: string;
  quantity: number;
  clubId: number;
  unitCost: number;
  status: ResourceStatus;
  quantityTotal: number;
  availableQuantity: number;
  lowStockThreshold: number;
  notes: string;
  imageUrl?: string;
  lastUpdated?: string | null;
}

export interface ReservationItem {
  id: number;
  startDate: string;
  endDate: string;
  status: ReservationStatus;
  quantityReserved: number;
  notes: string;
}

export interface TransportItem {
  id: number;
  scheduledDate: string;
  status: TransportStatus;
}

export interface TransportCreatePayload {
  scheduledDate: string;
  arrivalLocationId: number;
  departureLocationId: number;
  status: TransportStatus;
  userId: number;
  vehicleId: number;
  eventId?: number | null;
}

export interface VehicleItem {
  id: number;
  plateNumber: string;
  model: string;
  available: boolean;
}

export interface VehicleCreatePayload {
  plateNumber: string;
  model: string;
  available: boolean;
}

export interface EventItem {
  id: number;
  title?: string;
  name?: string;
}

export interface ClubItem {
  id: number;
  name?: string;
}

export interface UserItem {
  id: number;
  fullName?: string;
  email?: string;
}

export interface LocationItem {
  id: number;
  name?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
}

export interface ReservationCreatePayload {
  startDate: string;
  endDate: string;
  status: ReservationStatus;
  quantityReserved: number;
  notes: string;
  eventId: number;
  resourceId: number;
  userId: number;
}

export interface InventoryTransactionItem {
  id: number;
  type: InventoryTransactionType;
  quantity: number;
  date: string;
  reason: string;
}

export interface InventoryTransactionCreatePayload {
  type: InventoryTransactionType;
  quantity: number;
  date: string;
  reason: string;
  resourceId: number;
}

@Injectable({ providedIn: 'root' })
export class LogisticsApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private normalizeBackendDateTime(value: unknown): string {
    if (!value) {
      return '';
    }

    const text = String(value).trim();
    if (!text) {
      return '';
    }

    // Common backend format: "YYYY-MM-DD HH:MM:SS.ffffff" -> ISO-like
    // Keep it timezone-agnostic (local) to avoid unexpected shifts.
    const hasSpaceSeparator = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(text);
    if (!hasSpaceSeparator) {
      return text;
    }

    // Trim microseconds to milliseconds if needed.
    const parts = text.split(' ');
    const datePart = parts[0];
    const timePart = parts.slice(1).join(' ');
    const match = timePart.match(/^(\d{2}:\d{2}:\d{2})(\.(\d+))?$/);
    if (!match) {
      return `${datePart}T${timePart}`;
    }

    const base = match[1];
    const fraction = match[3] ?? '';
    const ms = fraction ? fraction.padEnd(3, '0').slice(0, 3) : '';
    return ms ? `${datePart}T${base}.${ms}` : `${datePart}T${base}`;
  }

  private normalizeResourceItem(raw: any): ResourceItem {
    const id = Number(raw?.id ?? 0);
    const name = String(raw?.name ?? '').trim();
    const description = String(raw?.description ?? '').trim();
    const notes = String(raw?.notes ?? '').trim();
    const status = String(raw?.status ?? raw?.category ?? 'AVAILABLE') as ResourceStatus;

    const unitCost = Number(raw?.unitCost ?? raw?.unit_cost ?? 0);
    const quantityTotal = Number(raw?.quantityTotal ?? raw?.quantity_total ?? raw?.quantity ?? 0);
    const availableQuantity = Number(raw?.availableQuantity ?? raw?.available_quantity ?? raw?.quantity ?? 0);
    const quantity = Number(raw?.quantity ?? quantityTotal ?? availableQuantity ?? 0);

    const lowStockThreshold = Number(raw?.lowStockThreshold ?? raw?.low_stock_threshold ?? 0);
    const imageUrlValue = raw?.imageUrl ?? raw?.image_url;
    const imageUrl = imageUrlValue ? String(imageUrlValue).trim() : '';
    const lastUpdated = this.normalizeBackendDateTime(raw?.lastUpdated ?? raw?.last_updated);
    const clubId = Number(raw?.clubId ?? raw?.club_id ?? raw?.club?.id ?? 0) || undefined;

    return {
      id,
      name,
      description,
      unitCost,
      status,
      imageUrl,
      quantity,
      quantityTotal,
      availableQuantity,
      lastUpdated,
      lowStockThreshold,
      notes,
      clubId
    };
  }

  private normalizeInventoryTransactionItem(raw: any): InventoryTransactionItem {
    const id = Number(raw?.id ?? 0);
    const type = String(raw?.type ?? 'UPDATE') as InventoryTransactionType;
    const quantity = Number(raw?.quantity ?? 0);
    const date = this.normalizeBackendDateTime(raw?.date);
    const reason = String(raw?.reason ?? '').trim();

    return { id, type, quantity, date, reason };
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private normalizeArray<T>(payload: any, knownKeys: string[] = []): T[] {
    if (Array.isArray(payload)) {
      return payload as T[];
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    if (Array.isArray(payload.content)) {
      return payload.content as T[];
    }

    if (Array.isArray(payload.data)) {
      return payload.data as T[];
    }

    if (Array.isArray(payload.items)) {
      return payload.items as T[];
    }

    for (const key of knownKeys) {
      if (Array.isArray(payload[key])) {
        return payload[key] as T[];
      }
    }

    const embedded = payload._embedded;
    if (embedded && typeof embedded === 'object') {
      for (const key of knownKeys) {
        if (Array.isArray(embedded[key])) {
          return embedded[key] as T[];
        }
      }

      const firstArray = Object.values(embedded).find(Array.isArray);
      if (Array.isArray(firstArray)) {
        return firstArray as T[];
      }
    }

    return [];
  }

  private getArrayWithFallback<T>(
    endpoints: string[],
    knownKeys: string[] = []
  ): Observable<T[]> {
    const [current, ...rest] = endpoints;
    return this.http.get<any>(`${this.baseUrl}${current}`, { headers: this.authHeaders() }).pipe(
      map((payload) => this.normalizeArray<T>(payload, knownKeys)),
      catchError((error) => {
        if (rest.length > 0) {
          return this.getArrayWithFallback<T>(rest, knownKeys);
        }
        return throwError(() => error);
      })
    );
  }

  private postWithFallback<T>(endpoints: string[], payload: unknown): Observable<T> {
    const [current, ...rest] = endpoints;
    return this.http.post<T>(`${this.baseUrl}${current}`, payload, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        const status = Number((error as any)?.status ?? 0);
        const canFallback = status === 0 || status === 404;
        if (rest.length > 0 && canFallback) {
          return this.postWithFallback<T>(rest, payload);
        }
        return throwError(() => error);
      })
    );
  }

  private postWithPayloadVariants<T>(
    payloadVariants: unknown[],
    endpoints: string[]
  ): Observable<T> {
    const [currentPayload, ...restPayloads] = payloadVariants;
    return this.postWithFallback<T>(endpoints, currentPayload).pipe(
      catchError((error) => {
        if (restPayloads.length > 0) {
          return this.postWithPayloadVariants<T>(restPayloads, endpoints);
        }
        return throwError(() => error);
      })
    );
  }

  getResources(): Observable<ResourceItem[]> {
    return this.getArrayWithFallback<any>(
      ['/api/resources', '/api/logistics/resources'],
      ['resources']
    ).pipe(map((items) => items.map((i) => this.normalizeResourceItem(i))));
  }

  createResource(payload: ResourceCreatePayload): Observable<ResourceItem> {
    const quantity = Number((payload as any).quantity ?? payload.quantityTotal ?? payload.availableQuantity ?? 0);
    const clubId = Number((payload as any).clubId ?? (payload as any).club_id ?? (payload as any).club?.id ?? 0);
    const unitCost = Number((payload as any).unitCost ?? (payload as any).unit_cost ?? 0);
    const lowStockThreshold = Number((payload as any).lowStockThreshold ?? (payload as any).low_stock_threshold ?? 0);
    const quantityTotal = Number((payload as any).quantityTotal ?? (payload as any).quantity_total ?? quantity);
    const availableQuantity = Number((payload as any).availableQuantity ?? (payload as any).available_quantity ?? quantity);
    const status = (payload as any).status ?? 'AVAILABLE';
    const name = (payload as any).name ?? '';
    const description = (payload as any).description ?? '';
    const notes = (payload as any).notes ?? '';
    const imageUrl = (payload as any).imageUrl ?? (payload as any).image_url ?? '';
    const lastUpdated = (payload as any).lastUpdated ?? (payload as any).last_updated ?? null;

    const variants: unknown[] = [
      {
        name,
        description,
        quantity,
        clubId,
        availableQuantity,
        quantityTotal,
        lowStockThreshold,
        status,
        unitCost,
        notes,
        imageUrl,
        lastUpdated
      },
      {
        name,
        description,
        quantity,
        club_id: clubId,
        available_quantity: availableQuantity,
        quantity_total: quantityTotal,
        low_stock_threshold: lowStockThreshold,
        status,
        unit_cost: unitCost,
        notes,
        image_url: imageUrl,
        last_updated: lastUpdated
      },
      {
        name,
        description,
        quantity,
        club: { id: clubId },
        availableQuantity,
        quantityTotal,
        lowStockThreshold,
        status,
        unitCost,
        notes,
        imageUrl,
        lastUpdated
      }
    ];

    return this.postWithPayloadVariants<any>(
      variants,
      ['/api/resources', '/api/logistics/resources']
    ).pipe(map((created) => this.normalizeResourceItem(created)));
  }

  updateResource(id: number, payload: ResourceCreatePayload): Observable<ResourceItem> {
    const quantity = Number((payload as any).quantity ?? payload.quantityTotal ?? payload.availableQuantity ?? 0);
    const clubId = Number((payload as any).clubId ?? (payload as any).club_id ?? (payload as any).club?.id ?? 0);
    const unitCost = Number((payload as any).unitCost ?? (payload as any).unit_cost ?? 0);
    const lowStockThreshold = Number((payload as any).lowStockThreshold ?? (payload as any).low_stock_threshold ?? 0);
    const quantityTotal = Number((payload as any).quantityTotal ?? (payload as any).quantity_total ?? quantity);
    const availableQuantity = Number((payload as any).availableQuantity ?? (payload as any).available_quantity ?? quantity);
    const status = (payload as any).status ?? 'AVAILABLE';
    const name = (payload as any).name ?? '';
    const description = (payload as any).description ?? '';
    const notes = (payload as any).notes ?? '';
    const imageUrl = (payload as any).imageUrl ?? (payload as any).image_url ?? '';
    const lastUpdated = (payload as any).lastUpdated ?? (payload as any).last_updated ?? null;

    const variants: unknown[] = [
      {
        name,
        description,
        quantity,
        clubId,
        availableQuantity,
        quantityTotal,
        lowStockThreshold,
        status,
        unitCost,
        notes,
        imageUrl,
        lastUpdated
      },
      {
        name,
        description,
        quantity,
        club_id: clubId,
        available_quantity: availableQuantity,
        quantity_total: quantityTotal,
        low_stock_threshold: lowStockThreshold,
        status,
        unit_cost: unitCost,
        notes,
        image_url: imageUrl,
        last_updated: lastUpdated
      },
      payload
    ];

    return this.putWithPayloadVariants<any>(
      id,
      variants,
      ['/api/resources', '/api/logistics/resources']
    ).pipe(map((updated) => this.normalizeResourceItem(updated)));
  }

  deleteResource(id: number): Observable<void> {
    const headers = this.authHeaders();
    return this.http.delete<void>(`${this.baseUrl}/api/resources/${id}`, { headers }).pipe(
      catchError((error) => {
        if ((error as any)?.status === 404) {
          return this.http.delete<void>(`${this.baseUrl}/api/logistics/resources/${id}`, { headers });
        }
        return throwError(() => error);
      })
    );
  }

  uploadResourceImage(formData: FormData): Observable<string> {
    const token = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post(`${this.baseUrl}/api/resources/upload-image`, formData, {
      headers,
      responseType: 'text'
    }).pipe(
      catchError((error) => {
        const status = Number((error as any)?.status ?? 0);
        if (status === 404 || status === 405) {
          return this.http.post(`${this.baseUrl}/api/logistics/resources/upload-image`, formData, {
            headers,
            responseType: 'text'
          });
        }
        return throwError(() => error);
      })
    );
  }

  getReservations(): Observable<ReservationItem[]> {
    return this.getArrayWithFallback<ReservationItem>(
      ['/api/reservations', '/api/logistics/reservations'],
      ['reservations']
    );
  }

  createReservation(payload: ReservationCreatePayload): Observable<ReservationItem> {
    return this.postWithFallback<ReservationItem>(
      ['/api/reservations', '/api/logistics/reservations'],
      payload
    );
  }

  getInventoryTransactionsByResource(resourceId: number): Observable<InventoryTransactionItem[]> {
    return this.getArrayWithFallback<any>(
      [`/api/inventory-transactions/resource/${resourceId}`, `/api/logistics/inventory-transactions/resource/${resourceId}`],
      ['inventoryTransactions', 'transactions']
    ).pipe(map((items) => items.map((i) => this.normalizeInventoryTransactionItem(i))));
  }

  createInventoryTransaction(payload: InventoryTransactionCreatePayload): Observable<InventoryTransactionItem> {
    const resourceId = Number((payload as any).resourceId ?? (payload as any).resource_id ?? 0);
    const quantity = Number((payload as any).quantity ?? 0);
    const type = (payload as any).type ?? 'UPDATE';
    const date = (payload as any).date ?? null;
    const reason = (payload as any).reason ?? '';

    const variants: unknown[] = [
      { type, quantity, date, reason, resourceId },
      { type, quantity, date, reason, resource_id: resourceId },
      payload
    ];

    return this.postWithPayloadVariants<any>(
      variants,
      ['/api/inventory-transactions', '/api/logistics/inventory-transactions']
    ).pipe(map((created) => this.normalizeInventoryTransactionItem(created)));
  }

  getTransports(): Observable<TransportItem[]> {
    return this.getArrayWithFallback<TransportItem>(
      ['/api/transports', '/api/logistics/transports'],
      ['transports']
    );
  }

  getTransport(id: number): Observable<any> {
    const token = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<any>(`${this.baseUrl}/api/transports/${id}`, { headers }).pipe(
      catchError((error) => {
        if ((error as any)?.status === 404) {
          return this.http.get<any>(`${this.baseUrl}/api/logistics/transports/${id}`, { headers });
        }
        return throwError(() => error);
      })
    );
  }

  createTransport(payload: TransportCreatePayload): Observable<TransportItem> {
    const variants: unknown[] = [
      // Variante 1: CamelCase (TransportRequest backend)
      {
        scheduledDate: payload.scheduledDate,
        arrivalLocationId: payload.arrivalLocationId,
        departureLocationId: payload.departureLocationId,
        status: payload.status,
        userId: payload.userId,
        vehicleId: payload.vehicleId,
        eventId: payload.eventId ?? null
      },
      // Variante 2: Snake_case (fallback)
      {
        scheduled_date: payload.scheduledDate,
        arrival_location_id: payload.arrivalLocationId,
        departure_location_id: payload.departureLocationId,
        status: payload.status,
        user_id: payload.userId,
        vehicle_id: payload.vehicleId,
        event_id: payload.eventId ?? null
      },
      // Variante 3: Payload brut (fallback si formats ci-dessus échouent)
      payload
    ];

    return this.postWithPayloadVariants<TransportItem>(
      variants,
      ['/api/transports', '/api/logistics/transports']
    );
  }

  private putWithPayloadVariants<T>(
    id: number,
    payloadVariants: unknown[],
    endpoints: string[]
  ): Observable<T> {
    const [currentPayload, ...restPayloads] = payloadVariants;
    const [currentEndpoint, ...restEndpoints] = endpoints;
    const token = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    return this.http.put<T>(`${this.baseUrl}${currentEndpoint}/${id}`, currentPayload, { headers }).pipe(
      catchError((error) => {
        const status = Number((error as any)?.status ?? 0);
        const canFallback = status === 0 || status === 404 || status === 400 || status === 415 || status === 422;
        
        if (restPayloads.length > 0 && canFallback) {
          return this.putWithPayloadVariants<T>(id, restPayloads, endpoints);
        }
        
        if (status === 404 && restEndpoints.length > 0) {
          return this.putWithPayloadVariants<T>(id, [currentPayload, ...restPayloads], restEndpoints);
        }
        
        return throwError(() => error);
      })
    );
  }

  updateTransport(id: number, payload: TransportCreatePayload): Observable<TransportItem> {
    const variants: unknown[] = [
      // Variante 1: CamelCase (TransportRequest backend)
      {
        scheduledDate: payload.scheduledDate,
        arrivalLocationId: payload.arrivalLocationId,
        departureLocationId: payload.departureLocationId,
        status: payload.status,
        userId: payload.userId,
        vehicleId: payload.vehicleId,
        eventId: payload.eventId ?? null
      },
      // Variante 2: Snake_case (fallback)
      {
        scheduled_date: payload.scheduledDate,
        arrival_location_id: payload.arrivalLocationId,
        departure_location_id: payload.departureLocationId,
        status: payload.status,
        user_id: payload.userId,
        vehicle_id: payload.vehicleId,
        event_id: payload.eventId ?? null
      },
      // Variante 3: Payload brut
      payload
    ];

    return this.putWithPayloadVariants<TransportItem>(
      id,
      variants,
      ['/api/transports', '/api/logistics/transports']
    );
  }

  getVehicles(): Observable<VehicleItem[]> {
    return this.getArrayWithFallback<VehicleItem>(
      ['/api/vehicles', '/api/logistics/vehicles'],
      ['vehicles']
    );
  }

  createVehicle(payload: VehicleCreatePayload): Observable<VehicleItem> {
    return this.postWithFallback<VehicleItem>(
      ['/api/vehicles', '/api/logistics/vehicles'],
      payload
    );
  }

  updateVehicle(id: number, payload: VehicleCreatePayload): Observable<VehicleItem> {
    const headers = this.authHeaders();
    return this.http.put<VehicleItem>(`${this.baseUrl}/api/vehicles/${id}`, payload, { headers }).pipe(
      catchError((error) => {
        if ((error as any)?.status === 404) {
          return this.http.put<VehicleItem>(`${this.baseUrl}/api/logistics/vehicles/${id}`, payload, { headers });
        }
        return throwError(() => error);
      })
    );
  }

  deleteVehicle(id: number): Observable<void> {
    const headers = this.authHeaders();
    return this.http.delete<void>(`${this.baseUrl}/api/vehicles/${id}`, { headers }).pipe(
      catchError((error) => {
        if ((error as any)?.status === 404) {
          return this.http.delete<void>(`${this.baseUrl}/api/logistics/vehicles/${id}`, { headers });
        }
        return throwError(() => error);
      })
    );
  }

  getEvents(): Observable<EventItem[]> {
    return this.getArrayWithFallback<EventItem>(
      ['/api/events', '/api/logistics/events'],
      ['events']
    );
  }

  getClubs(): Observable<ClubItem[]> {
    return this.getArrayWithFallback<ClubItem>(
      ['/api/clubs', '/api/logistics/clubs'],
      ['clubs']
    );
  }

  getUsers(): Observable<UserItem[]> {
    return this.getArrayWithFallback<UserItem>(
      ['/api/users', '/api/logistics/users'],
      ['users']
    );
  }

  getLocations(): Observable<LocationItem[]> {
    return this.getArrayWithFallback<LocationItem>(
      ['/api/locations', '/api/logistics/locations'],
      ['locations']
    );
  }

  deleteTransport(id: number): Observable<void> {
    const token = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.delete<void>(`${this.baseUrl}/api/transports/${id}`, { headers }).pipe(
      catchError((error) => {
        if ((error as any)?.status === 404) {
          return this.http.delete<void>(`${this.baseUrl}/api/logistics/transports/${id}`, { headers });
        }
        return throwError(() => error);
      })
    );
  }
}

