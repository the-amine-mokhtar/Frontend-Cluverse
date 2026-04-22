import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export type EventStatus = 'PLANNED'| 'CANCELLED' | 'COMPLETED' | 'ONGOING';
export type ParticipationStatus =
  | 'REGISTERED'
  | 'ATTENDED'
  | 'CANCELLED';

// ══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ══════════════════════════════════════════════════════════════════════════════

export function computeEventStatus(event: EventItem): EventStatus {
  const now = new Date();
  const start = event.startDate ? new Date(event.startDate) : null;
  const end = event.endDate ? new Date(event.endDate) : null;

  // priorité au backend
  if (event.status === 'CANCELLED') return 'CANCELLED';

  if (end && end < now) return 'COMPLETED';
  if (start && start <= now && (!end || end >= now)) return 'ONGOING';
  if (start && start > now) return 'PLANNED';

  return 'PLANNED';
}
export function normalizeEvent(e: EventItem): EventItem {
  return {
    ...e,
    status:   computeEventStatus(e),
    isFull:   (e.participantsCount ?? 0) >= (e.capacity ?? 0),
    price:    e.price    ?? 0,
    currency: e.currency ?? 'EUR',
    date:     e.startDate,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════════════════════════════════════════

export interface EventItem {
  id:                  number;
  title:               string;
  description:         string;
  startDate:           string;
  endDate:             string;
  capacity:            number;
  participantsCount?:  number;
  isPaid?:             boolean;
  currency?:           string;
  category?:           string;
  imageUrl?:           string;
  status?:             EventStatus;
  isFull?:             boolean;
  price?:              number;
  date?:               string;
  cancelledAt?:        string;
  availableSeats?:     number;
  createdAt?:          string;
  updatedAt?:          string;
  campaignId?:         number | null;
  locationId?:         number | null;
  locationName?:       string | null;
  locationAddress?:    string | null;
  locationLatitude?:   string | null;
  locationLongitude?:  string | null;
  targetAudience?:     string;
  budget?:             number;
  maxParticipants?:    number;
  featured?:           boolean;
  isCampaign?:         boolean;
    visibility?: string;

}

export interface Campaign {
  id:                   number;
  title:                string;
  description?:         string;
  startDate?:           string;
  endDate?:             string;
  visibility?:          string;
  status?:              string;
  ownerClub?:           any;
  canAddEvent?:         boolean;
  maxParticipants?:     number;
  currentParticipants?: number;
}

export interface ResourceItem {
  id:                number;
  name:              string;
  description?:      string;
  quantityTotal:     number;
  availableQuantity: number;
  status:            string;
  imageUrl?:         string;
}

export interface ReservationItem {
  id:               number;
  startDate:        string;
  endDate:          string;
  quantityReserved: number;
  status:           string;
  notes?:           string;
  eventId:          number;
  resourceId:       number;
  userId:           number;
  resourceName?:    string;
}

export interface ReservationRequestPayload {
  startDate:        string;
  endDate:          string;
  quantityReserved: number;
  status:           string;
  notes?:           string;
  eventId:          number;
  resourceId:       number;
  userId:           number;
}

export interface EventRequestPayload {
  title:              string;
  description?:       string;
  location?:          string;
  latitude?:          string;
  longitude?:         string;
  startDate?:         string;
  endDate?:           string;
  status?:            string;
  capacity?:          number;
  campaignId?:        number | null;
  participantsCount?: number;
  imageUrl?:          string;
  category?:          string;
  isFull?:            boolean;
  isPaid:             boolean;
  price?:             number;
}

export interface ParticipationPayload {
  eventId:               number;
  fullName?:             string;
  email?:                string;
  phone?:                string;
  reservedSeats:         number;
  comment?:              string;
  contactInfo?:          string;
  wantsReminder?:        boolean;
  dietaryRequirements?:  string;
  emergencyContact?:     string;
  teamName?:             string;
}

/**
 * Participation retournée par le backend.
 * eventId est toujours présent (champ @Transient de l'entité).
 * event est présent grâce au JOIN FETCH dans le repository.
 */
export interface Participation {
  id:                    number;
  eventId?:              number;       // @Transient — fallback si event est null
  status:                ParticipationStatus;
  reservedSeats?:        number;
  comment?:              string;
  contactInfo?:          string;
  wantsReminder?:        boolean;
  reminderSent?:         boolean;
  registrationDate?:     string;
  dietaryRequirements?:  string;
  emergencyContact?:     string;
  teamName?:             string;
  cancelledAt?:          string;
  userName?:             string;
  userEmail?:            string;
  userPhone?:            string;
  event?:                EventItem;   // chargé via JOIN FETCH
}

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class EventApiService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Auth header ──────────────────────────────────────────────────────────

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders().set('Content-Type', 'application/json');
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  private authHeadersNoContentType(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EVENTS
  // ══════════════════════════════════════════════════════════════════════════

// event-api.service.ts — extraits corrigés

// ✅ FIX #1 — getAllEvents charge TOUS les events (sans filtre club)
// getMyEvents charge uniquement les events du club connecté

  /** Tous les événements (admin / vue publique) */
  getAllEvents(): Observable<EventItem[]> {
    return this.http.get<EventItem[]>(`${this.baseUrl}/api/events/all`, {
      headers: this.authHeaders(),
    });
  }
 
  /** Événements du club connecté */
  getMyEvents(status?: string): Observable<EventItem[]> {
    const url = status
      ? `${this.baseUrl}/api/events/my-club?status=${status}`
      : `${this.baseUrl}/api/events/my-club`;
    return this.http.get<EventItem[]>(url, { headers: this.authHeaders() });
  }
 
  getEventById(id: number): Observable<EventItem> {
    return this.http.get<EventItem>(`${this.baseUrl}/api/events/${id}`, {
      headers: this.authHeaders(),
    });
  }
 
  createEvent(payload: EventRequestPayload): Observable<EventItem> {
    return this.http.post<EventItem>(`${this.baseUrl}/api/events`, payload, {
      headers: this.authHeaders(),
    });
  }
 
  /** ✅ FIX : PUT retourne l'event mis à jour */
  updateEvent(id: number, payload: EventRequestPayload): Observable<EventItem> {
    return this.http.put<EventItem>(`${this.baseUrl}/api/events/${id}`, payload, {
      headers: this.authHeaders(),
    }).pipe(
      tap(updated => console.log('[API] Event updated:', updated)),
      catchError(err => {
        console.error('[API] Update failed:', err);
        return throwError(() => err);
      })
    );
  }
 
  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/events/${id}`, {
      headers: this.authHeaders(),
    });
  }
 
  uploadImage(formData: FormData): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(
      `${this.baseUrl}/api/events/upload-image`,
      formData,
      { headers: this.authHeadersNoContentType() }
    );
  }
 
  getCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${this.baseUrl}/api/campaigns`, {
      headers: this.authHeaders(),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PARTICIPATIONS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Retourne mes participations.
   * Le backend utilise JOIN FETCH → event n'est jamais null.
   */
  getMyParticipations(): Observable<Participation[]> {
    return this.http.get<Participation[]>(`${this.baseUrl}/api/participants`, {
      headers: this.authHeaders(),
    });
  }

  getEventParticipants(eventId: number): Observable<Participation[]> {
    return this.http.get<Participation[]>(
      `${this.baseUrl}/api/participants?eventId=${eventId}`,
      { headers: this.authHeaders() }
    ).pipe(
      tap(r => console.log('[API] Event participants:', r)),
      catchError(err => {
        console.error('[API] Error fetching participants:', err);
        return throwError(() => err);
      })
    );
  }

  getCancelledParticipations(): Observable<Participation[]> {
    return this.http.get<Participation[]>(
      `${this.baseUrl}/api/participants/me/cancelled`,
      { headers: this.authHeaders() }
    );
  }

  /**
   * Inscription directe (place disponible confirmée).
   */
  participate(payload: ParticipationPayload): Observable<Participation> {
    return this.http.post<Participation>(
      `${this.baseUrl}/api/participants`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  updateParticipation(id: number, payload: Partial<ParticipationPayload>): Observable<Participation> {
    return this.http.put<Participation>(
      `${this.baseUrl}/api/participants/${id}`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  /**
   * Réactivation d'une participation annulée.
   */
  reactivateParticipation(id: number): Observable<Participation> {
    return this.http.put<Participation>(
      `${this.baseUrl}/api/participants/${id}`,
      { status: 'REGISTERED' },
      { headers: this.authHeaders() }
    );
  }

  deleteParticipation(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/api/participants/${id}`,
      { headers: this.authHeaders() }
    );
  }

  // ── Flux waiting list ─────────────────────────────────────────────────────

 // ✅ FIX #2 — requestParticipation : le backend retourne maintenant
// "PLACE_AVAILABLE_CONFIRM" | "EVENT_FULL" | "ALREADY_REGISTERED"
requestParticipation(eventId: number): Observable<string> {
  return this.http.post(
    `${this.baseUrl}/api/participants/request/${eventId}`,
    {},
    { headers: this.authHeaders(), responseType: 'text' }
  );
}

// ✅ FIX #3 — joinWaitingList : userId envoyé dans le body
joinWaitingList(eventId: number, accept: boolean): Observable<string> {
  return this.http.post(
    `${this.baseUrl}/api/participants/waiting-list/${eventId}?accept=${accept}`,
    {},
    { headers: this.authHeaders(), responseType: 'text' }
  );
}
  /** Étape 3 — Confirmer la promotion */
  confirmPromotion(waitingId: number): Observable<string> {
    return this.http.post(
      `${this.baseUrl}/api/participants/confirm/${waitingId}`,
      {},
      { headers: this.authHeaders(), responseType: 'text' }
    );
  }

  // ── Paiement ──────────────────────────────────────────────────────────────

  payEvent(eventId: number, userId: number): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/api/payments/create?eventId=${eventId}&userId=${userId}`,
      {},
      { headers: this.authHeaders() }
    );
  }

  confirmPayment(paymentIntentId: string): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/api/payments/confirm?paymentIntentId=${paymentIntentId}`,
      {},
      { headers: this.authHeaders() }
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESOURCES & RESERVATIONS
  // Réservation de ressources : uniquement pour les organisateurs (admin/club)
  // Les participants normaux n'ont pas accès à ces endpoints.
  // ══════════════════════════════════════════════════════════════════════════

  getResources(): Observable<ResourceItem[]> {
    return this.http.get<ResourceItem[]>(`${this.baseUrl}/api/resources`, {
      headers: this.authHeaders(),
    });
  }

  createReservation(payload: ReservationRequestPayload): Observable<ReservationItem> {
    return this.http.post<ReservationItem>(
      `${this.baseUrl}/api/reservations`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  getReservationsByEvent(eventId: number): Observable<ReservationItem[]> {
    return this.http.get<ReservationItem[]>(
      `${this.baseUrl}/api/reservations?eventId=${eventId}`,
      { headers: this.authHeaders() }
    );
  }

  deleteReservation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/reservations/${id}`, {
      headers: this.authHeaders(),
    });
  }
}