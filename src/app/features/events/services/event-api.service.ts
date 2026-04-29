import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export type EventStatus = 'PLANNED'| 'CANCELLED' | 'COMPLETED' | 'ONGOING';
export type EventType = 'OFFLINE' | 'ONLINE';
export type ParticipationStatus =
  | 'REGISTERED'
  | 'ATTENDED'
  | 'CANCELLED'
  | 'WAITING_LIST';

// ══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ══════════════════════════════════════════════════════════════════════════════

export function computeEventStatus(event: EventItem): EventStatus {
  const now = new Date();
  const start = event.startDate ? new Date(event.startDate) : null;
  const end = event.endDate ? new Date(event.endDate) : null;

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
    // ✅ isFull seulement si capacity > 0 ET participantsCount >= capacity
    isFull:   (e.capacity != null && e.capacity > 0)
              ? (e.participantsCount ?? 0) >= e.capacity
              : false,
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
  category?:           string;
  imageUrl?:           string;
  status?:             EventStatus;
  isFull?:             boolean;
  date?:               string;
  cancelledAt?:        string;
  availableSeats?:     number;
  createdAt?:          string;
  updatedAt?:          string;
  campaignId?:         number | null;
  campaign?:           Campaign | null;
  locationId?:         number | null;
  locationName?:       string | null;
  locationAddress?:    string | null;
  locationLatitude?:   string | null;
  locationLongitude?:  string | null;
  eventType?:          EventType;
  meetingUrl?:         string | null;
  targetAudience?:     string;
  budget?:             number;
  maxParticipants?:    number;
  featured?:           boolean;
  isCampaign?:         boolean;
  visibility?:         string;
  views?:              number;
  clicks?:             number;
  registrationCount?:  number;
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
  ownerClubId?:         number;
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
  eventType?:         EventType;
  meetingUrl?:        string | null;
  startDate?:         string;
  endDate?:           string;
  status?:            string;
  capacity?:          number;
  campaignId?:        number | null;
  participantsCount?: number;
  imageUrl?:          string;
  category?:          string;
  isFull?:            boolean;
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

export interface Participation {
  id:                    number;
  eventId?:              number;
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
  fullName?:             string;        // ✅ NEW: Stored participant full name
  participantPhone?:     string;        // ✅ NEW: Stored participant phone
  event?:                EventItem;
}

export interface AiStatisticResponse {
  label: string;
  value: string;
  hint: string;
}

export interface EventAiInsightResponse {
  eventId: number;
  score: number;
  popularityScore: number;
  participationScore: number;
  recencyScore: number;
  trendScore: number;
  conversionScore: number;
  momentum: 'hot' | 'rising' | 'stable';
  badgeLabel?: string;
  reasons: string[];
  urgencyScore?: number;
  predictedTrend?: 'future-trending' | 'watchlist' | 'stable';
  scoreBreakdown?: Array<{ label: string; value: number; weight: number; contribution: number }>;
  dominantFactors?: string[];
  structuredExplanation?: {
    headline: string;
    reasons: string[];
    dominantFactors: string[];
  };
  fallbackStrategy?: string;
}

export interface EventAiRankedEventResponse extends EventItem {
  aiInsight: EventAiInsightResponse;
  campaignTitle?: string | null;
}

export interface EventAiDashboardResponse {
  avgScore: number;
  trending: number;
  popular: number;
  almostFull: number;
  statistics: AiStatisticResponse[];
  rankedEvents: EventAiRankedEventResponse[];
  highlights: EventAiRankedEventResponse[];
  trendingEvents: EventAiRankedEventResponse[];
  almostFullEvents: EventAiRankedEventResponse[];
}

export interface EventAiSchedulingSlotResponse {
  label: string;
  shortLabel: string;
  score: number;
  participants: number;
  fillRate: number;
  sampleSize: number;
}

export interface EventAiSchedulingTrendPointResponse {
  label: string;
  shortLabel: string;
  participants: number;
  fillRate: number;
  score: number;
  projected?: boolean;
  changeRate?: number;
}

export interface EventAiSchedulingResponse {
  recommendationTitle: string;
  recommendationNarrative: string;
  forecastNarrative?: string;
  predictionParticipants: number;
  expectedLift: number;
  confidence: number;
  successProbability?: number;
  trendDirection?: 'up' | 'down' | 'stable' | string;
  trendDeltaPercent?: number;
  analyzedPastEvents: number;
  bestDay?: EventAiSchedulingSlotResponse | null;
  bestHour?: EventAiSchedulingSlotResponse | null;
  bestMonth?: EventAiSchedulingSlotResponse | null;
  topDays: EventAiSchedulingSlotResponse[];
  topHours: EventAiSchedulingSlotResponse[];
  historicalTrend?: EventAiSchedulingTrendPointResponse[];
  forecastTrend?: EventAiSchedulingTrendPointResponse[];
  monthlyTrend: EventAiSchedulingTrendPointResponse[];
  forecastHighlights?: string[];
}

export interface ParticipantAiInsightResponse {
  eventId: number;
  score: number;
  popularityScore: number;
  availabilityScore: number;
  recencyScore: number;
  trendScore: number;
  affinityScore: number;
  urgencyLevel: 'high' | 'medium' | 'low';
  recommendationLabel: string;
  explanation: string;
  decisionMessage: string;
  seatsLeft: number | null;
  badges: string[];
  urgencyScore?: number;
  conversionScore?: number;
  predictedTrend?: 'future-trending' | 'watchlist' | 'stable';
  scoreBreakdown?: Array<{ label: string; value: number; weight: number; contribution: number }>;
  dominantFactors?: string[];
  structuredExplanation?: {
    headline: string;
    reasons: string[];
    dominantFactors: string[];
  };
  affinityProfile?: {
    preferredCategories: string[];
    clickedCategories: string[];
    participationHistoryCount: number;
    interactionBalance: number;
  };
  feedbackSignals?: {
    clicks: number;
    impressions: number;
    ignored: number;
  };
  fallbackStrategy?: string;
}

export interface ParticipantAiRecommendationResponse extends EventItem {
  participationAi: ParticipantAiInsightResponse;
  campaignTitle?: string | null;
}

export interface ParticipantAiDashboardResponse {
  recommended: number;
  trending: number;
  urgent: number;
  profileSignals: number;
  profileSummary: string;
  statistics: AiStatisticResponse[];
  recommendations: ParticipantAiRecommendationResponse[];
  trendingEvents: ParticipantAiRecommendationResponse[];
  urgentEvents: ParticipantAiRecommendationResponse[];
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

  getAllEvents(): Observable<EventItem[]> {
    return this.http.get<EventItem[]>(`${this.baseUrl}/api/events/all`, {
      headers: this.authHeaders(),
    });
  }

  getMyEvents(status?: string): Observable<EventItem[]> {
    const url = status
      ? `${this.baseUrl}/api/events/my-club?status=${status}`
      : `${this.baseUrl}/api/events/my-club`;
    return this.http.get<EventItem[]>(url, { headers: this.authHeaders() });
  }

  getMyClubAiDashboard(): Observable<EventAiDashboardResponse> {
    return this.http.get<EventAiDashboardResponse>(
      `${this.baseUrl}/api/events/my-club/ai-dashboard`,
      { headers: this.authHeaders() }
    );
  }

  getMyClubAiScheduling(): Observable<EventAiSchedulingResponse> {
    return this.http.get<EventAiSchedulingResponse>(
      `${this.baseUrl}/api/events/my-club/ai-scheduling`,
      { headers: this.authHeaders() }
    );
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

  // ── CANCEL EVENT (Set status to CANCELLED + notify participants via SMS)
  cancelEvent(id: number): Observable<EventItem> {
    return this.http.post<EventItem>(`${this.baseUrl}/api/events/${id}/cancel`, {}, {
      headers: this.authHeaders(),
    }).pipe(
      tap(updated => console.log('[API] Event cancelled and SMS sent to participants:', updated)),
      catchError(err => {
        console.error('[API] Cancel failed:', err);
        return throwError(() => err);
      })
    );
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

  getMyWaitingList(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.baseUrl}/api/participants/me/waiting-list`,
      { headers: this.authHeaders() }
    ).pipe(
      tap(r => console.log('[API] My waiting list:', r)),
      catchError(err => {
        console.error('[API] Error fetching waiting list:', err);
        return throwError(() => err);
      })
    );
  }

  getParticipantAiDashboard(): Observable<ParticipantAiDashboardResponse> {
    return this.http.get<ParticipantAiDashboardResponse>(
      `${this.baseUrl}/api/participants/me/ai-dashboard`,
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
   * Le backend retourne la participation mise à jour.
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

  // ── Paiement ──────────────────────────────────────────────────────────────



  // ══════════════════════════════════════════════════════════════════════════
  // RESOURCES & RESERVATIONS
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

  // ══════════════════════════════════════════════════════════════════════════
  // PARTICIPATE — endpoint unifié
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * ✅ Endpoint unifié : le backend décide register OU waiting list.
   *
   * Retourne :
   *   "REGISTERED"         → place disponible, inscription confirmée, SMS envoyé
   *   "WAITING_LIST_ADDED" → event plein, ajouté en liste d'attente, SMS envoyé
   *
   * Lance 409 si déjà inscrit.
   *
   * ✅ FIX : utilise this.baseUrl (et non this.base) + import map depuis rxjs/operators
   */
  participate(payload: ParticipationPayload): Observable<string> {
    return this.http
      .post<{ status: string }>(
        `${this.baseUrl}/api/participants/participate/${payload.eventId}`,
        payload,
        { headers: this.authHeaders() }
      )
      .pipe(map(res => res.status));
  }

  /**
   * Vérifie la disponibilité AVANT d'afficher le formulaire.
   * Retourne :
   *   "PLACE_AVAILABLE_CONFIRM" → place dispo, afficher le formulaire
   *   "ALREADY_REGISTERED"      → déjà inscrit
   *   tout autre string         → event plein, proposer waiting list
   */
  requestParticipation(eventId: number): Observable<string> {
    return this.http.post<string>(
      `${this.baseUrl}/api/participants/request/${eventId}`,
      {},
      { headers: this.authHeaders(), responseType: 'text' as 'json' }
    );
  }

  /**
   * Rejoindre la liste d'attente manuellement (flow confirmé par l'utilisateur).
   */
  joinWaitingList(eventId: number, accept: boolean): Observable<string> {
    return this.http.post<string>(
      `${this.baseUrl}/api/participants/waiting-list/${eventId}?accept=${accept}`,
      {},
      { headers: this.authHeaders(), responseType: 'text' as 'json' }
    );
  }

  /**
   * Confirmer une promotion depuis la liste d'attente.
   */
  confirmPromotion(waitingId: number): Observable<string> {
    return this.http.post<string>(
      `${this.baseUrl}/api/participants/confirm/${waitingId}`,
      {},
      { headers: this.authHeaders(), responseType: 'text' as 'json' }
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SMS REMINDERS (24h before event)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Envoie un SMS de rappel aux participants 24h avant l'événement.
   * ✅ Appel au backend pour déclencher l'envoi des SMS.
   */
  sendReminderSms(participationId: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/api/participants/${participationId}/send-reminder`,
      {},
      { headers: this.authHeaders() }
    );
  }

  /**
   * Envoie des SMS de rappel à tous les participants d'un événement.
   * ✅ Appel au backend pour déclencher l'envoi des SMS en masse.
   */
  sendEventReminders(eventId: number): Observable<{ success: boolean; count: number; message: string }> {
    return this.http.post<{ success: boolean; count: number; message: string }>(
      `${this.baseUrl}/api/events/${eventId}/send-reminders`,
      {},
      { headers: this.authHeaders() }
    );
  }
}
