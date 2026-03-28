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
  capacity: number;
  arrivalTime?: string | null;
  clubId?: number | null;
  departureTime?: string | null;
  eventId?: number | null;
  departure?: string | null;
  destination?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  notes?: string | null;
  vehicleType?: string | null;
  scheduledDate: string;
  arrivalLocationId?: number | null;
  departureLocationId?: number | null;
  status: TransportStatus;
  userId?: number | null;
  vehicleId?: number | null;
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

@Injectable({ providedIn: 'root' })
export class LogisticsApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

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
    return this.getArrayWithFallback<ResourceItem>(
      ['/api/resources', '/api/logistics/resources'],
      ['resources']
    );
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

    return this.postWithPayloadVariants<ResourceItem>(
      variants,
      ['/api/resources', '/api/logistics/resources']
    );
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

    return this.putWithPayloadVariants<ResourceItem>(
      id,
      variants,
      ['/api/resources', '/api/logistics/resources']
    );
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
        if ((error as any)?.status === 404) {
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
      // Variante 1: Snake_case complet (priorité haute - inclut tous les champs optionnels)
      {
        capacity: payload.capacity,
        arrival_time: payload.arrivalTime ?? null,
        club_id: payload.clubId ?? null,
        departure_time: payload.departureTime ?? null,
        event_id: payload.eventId ?? null,
        departure: payload.departure ?? null,
        destination: payload.destination ?? null,
        driver_name: payload.driverName ?? null,
        driver_phone: payload.driverPhone ?? null,
        notes: payload.notes ?? null,
        vehicle_type: payload.vehicleType ?? null,
        scheduled_date: payload.scheduledDate,
        arrival_location_id: payload.arrivalLocationId,
        departure_location_id: payload.departureLocationId,
        status: payload.status,
        user_id: payload.userId,
        vehicle_id: payload.vehicleId
      },
      // Variante 2: CamelCase complet (fallback si snake_case échoue)
      {
        capacity: payload.capacity,
        arrivalTime: payload.arrivalTime ?? null,
        clubId: payload.clubId ?? null,
        departureTime: payload.departureTime ?? null,
        eventId: payload.eventId ?? null,
        departure: payload.departure ?? null,
        destination: payload.destination ?? null,
        driverName: payload.driverName ?? null,
        driverPhone: payload.driverPhone ?? null,
        notes: payload.notes ?? null,
        vehicleType: payload.vehicleType ?? null,
        scheduledDate: payload.scheduledDate,
        arrivalLocationId: payload.arrivalLocationId,
        departureLocationId: payload.departureLocationId,
        status: payload.status,
        userId: payload.userId,
        vehicleId: payload.vehicleId
      },
      // Variante 3: Payload brut (fallback si formats ci-dessus échouent)
      payload,
      // Variante 4: Minimaliste (dernière chance - contient seulement champs obligatoires)
      {
        scheduledDate: payload.scheduledDate,
        departureLocationId: payload.departureLocationId,
        arrivalLocationId: payload.arrivalLocationId,
        status: payload.status,
        vehicleId: payload.vehicleId,
        userId: payload.userId
      }
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
        const canFallback = status === 0 || status === 404;
        
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
      // Variante 1: Snake_case complet (priorité haute)
      {
        capacity: payload.capacity,
        arrival_time: payload.arrivalTime ?? null,
        club_id: payload.clubId ?? null,
        departure_time: payload.departureTime ?? null,
        event_id: payload.eventId ?? null,
        departure: payload.departure ?? null,
        destination: payload.destination ?? null,
        driver_name: payload.driverName ?? null,
        driver_phone: payload.driverPhone ?? null,
        notes: payload.notes ?? null,
        vehicle_type: payload.vehicleType ?? null,
        scheduled_date: payload.scheduledDate,
        arrival_location_id: payload.arrivalLocationId,
        departure_location_id: payload.departureLocationId,
        status: payload.status,
        user_id: payload.userId,
        vehicle_id: payload.vehicleId
      },
      // Variante 2: CamelCase complet
      {
        capacity: payload.capacity,
        arrivalTime: payload.arrivalTime ?? null,
        clubId: payload.clubId ?? null,
        departureTime: payload.departureTime ?? null,
        eventId: payload.eventId ?? null,
        departure: payload.departure ?? null,
        destination: payload.destination ?? null,
        driverName: payload.driverName ?? null,
        driverPhone: payload.driverPhone ?? null,
        notes: payload.notes ?? null,
        vehicleType: payload.vehicleType ?? null,
        scheduledDate: payload.scheduledDate,
        arrivalLocationId: payload.arrivalLocationId,
        departureLocationId: payload.departureLocationId,
        status: payload.status,
        userId: payload.userId,
        vehicleId: payload.vehicleId
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

