import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// ══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════════════════════════════════════════

export interface Campaign {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  targetAudience?: string;
  visibility: 'PUBLIC' | 'SHARED' | 'PRIVATE';
  status: 'PLANNED' | 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'ARCHIVED' | 'FINISHED' | 'CANCELLED';
  maxParticipants?: number;
  currentParticipants: number;
  eventsCount?: number;
  views: number;
  featured: boolean;
  createdAt: string;
  ownerClubId?: number;
  ownerClubName?: string;
  events?: any[];
  canAddEvent?: boolean;
}

export interface CampaignRequest {
  title: string;
  description: string;
  targetAudience?: string;
  startDate: string;
  endDate: string;
  visibility?: 'PUBLIC' | 'SHARED' | 'PRIVATE';
  maxParticipants?: number;
  status?: 'PLANNED' | 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'ARCHIVED' | 'FINISHED' | 'CANCELLED';
  imageUrl?: string;
  featured: boolean;
}

export interface Participant {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
  registrationDate: string;
}

export type CampaignPermission = 'VIEW' | 'ADD_EVENT' | 'MANAGE' | 'DELETE' | 'EDIT';

export interface CampaignAccess {
  id: number;
  campaignId: number;
  clubId: number;
  clubName?: string;
  permissions: CampaignPermission[];
}

export interface Club {
  id: number;
  name: string;
  description?: string;
  logoUrl?: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  capacity: number;
  currentParticipants: number;
  status: 'PLANNED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  category: string;
  clubId: number;
  clubName?: string;
  imageUrl?: string;
}
export interface DeleteCampaignResult {
  campaignId?: number;
  title?: string;
  totalParticipants?: number;
  totalEvents?: number;
  message?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class CampaignApiService {
  private apiUrl = `${environment.eventsApiUrl}/api/campaigns`;
  private clubsUrl = `${environment.apiUrl}/api/clubs`;

  constructor(private http: HttpClient) {}

  private normalizeCampaignAccess(raw: any): CampaignAccess {
    return {
      id: Number(raw?.id ?? 0),
      campaignId: Number(raw?.campaignId ?? raw?.campaign?.id ?? 0),
      clubId: Number(raw?.clubId ?? raw?.club?.id ?? 0),
      clubName: raw?.clubName ?? raw?.club?.name ?? '',
      permissions: Array.isArray(raw?.permissions) ? raw.permissions : [],
    };
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  // ── GET ALL
  getAllCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(this.apiUrl, { headers: this.getHeaders() }).pipe(
      tap(campaigns => console.log(`[Campaigns] Fetched: ${campaigns.length}`)),
      catchError(err => { console.error('Error fetching campaigns:', err); return throwError(() => err); })
    );
  }

  // ── GET BY ID
  getCampaignById(id: number): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      tap(r => console.log('Campaign fetched:', r)),
      catchError(err => { console.error('Error fetching campaign:', err); return throwError(() => err); })
    );
  }

  // ── RECORD VIEW — POST /api/campaigns/:id/views
  recordCampaignView(id: number): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.apiUrl}/${id}/views`, {}, { headers: this.getHeaders() }).pipe(
      tap(r => console.log(`[Campaign] View recorded for #${id}, total views: ${r.views}`)),
      catchError(err => { console.error('Error recording view:', err); return throwError(() => err); })
    );
  }

  // ── CREATE
  createCampaign(campaign: any, imageFile?: File | null): Observable<Campaign> {
    const formData = new FormData();
    const textFields = ['title', 'description', 'targetAudience', 'visibility',
                        'startDate', 'endDate', 'maxParticipants', 'featured'];
    textFields.forEach(key => {
      if (campaign[key] != null && campaign[key] !== '') {
        formData.append(key, String(campaign[key]));
      }
    });
    if (imageFile) formData.append('imageFile', imageFile, imageFile.name);
    return this.http.post<Campaign>(this.apiUrl, formData, { headers: this.getAuthHeaders() }).pipe(
      tap(r => console.log('[Campaign] Created:', r)),
      catchError(err => { console.error('[Campaign] Create error:', err); return throwError(() => err); })
    );
  }

  // ── UPDATE
  updateCampaign(id: number, campaign: any, imageFile?: File | null): Observable<Campaign> {
    const formData = new FormData();
    const textFields = ['title', 'description', 'targetAudience', 'visibility',
                        'startDate', 'endDate', 'maxParticipants', 'featured'];
    textFields.forEach(key => {
      if (campaign[key] != null && campaign[key] !== '') {
        formData.append(key, String(campaign[key]));
      }
    });
    if (imageFile) formData.append('imageFile', imageFile, imageFile.name);
    return this.http.put<Campaign>(`${this.apiUrl}/${id}`, formData, { headers: this.getAuthHeaders() }).pipe(
      tap(r => console.log('[Campaign] Updated:', r)),
      catchError(err => { console.error('[Campaign] Update error:', err); return throwError(() => err); })
    );
  }

  // ── DELETE
  deleteCampaign(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      tap(r => console.log('[Campaign] Deleted successfully', r)),
      catchError(err => { console.error('Error deleting campaign:', err); return throwError(() => err); })
    );
  }

  // ── CANCEL CAMPAIGN (Set status to CANCELLED + notify Event Managers)
  cancelCampaign(id: number): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.apiUrl}/${id}/cancel`, {}, { headers: this.getHeaders() }).pipe(
      tap(r => console.log('[Campaign] Cancelled and notifications sent:', r)),
      catchError(err => { console.error('Error cancelling campaign:', err); return throwError(() => err); })
    );
  }

  // ── UPDATE STATUS
  updateCampaignStatus(id: number, status: string): Observable<Campaign> {
    return this.http.put<Campaign>(`${this.apiUrl}/${id}/status?status=${status}`, {}, { headers: this.getHeaders() }).pipe(
      tap(r => console.log('[Campaign] Status updated:', r)),
      catchError(err => { console.error('[Campaign] Status update error:', err); return throwError(() => err); })
    );
  }

  // ── PARTICIPANTS
  getCampaignParticipants(campaignId: number): Observable<Participant[]> {
    return this.http.get<Participant[]>(`${this.apiUrl}/${campaignId}/participants`, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error fetching participants:', err); return throwError(() => err); })
    );
  }

  registerForCampaign(campaignId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${campaignId}/register`, {}, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error registering:', err); return throwError(() => err); })
    );
  }

  unregisterFromCampaign(campaignId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${campaignId}/register`, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error unregistering:', err); return throwError(() => err); })
    );
  }

  isUserRegistered(campaignId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${campaignId}/is-registered`, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error checking registration:', err); return throwError(() => err); })
    );
  }

  // ── FILTERS
  getCampaignsByStatus(status: string): Observable<Campaign[]> {
    const params = new HttpParams().set('status', status);
    return this.http.get<Campaign[]>(this.apiUrl, { headers: this.getHeaders(), params }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  getFeaturedCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${this.apiUrl}/featured`, { headers: this.getHeaders() }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  // ── PERMISSIONS
  getCampaignPermissions(campaignId: number): Observable<CampaignAccess[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${campaignId}/permissions`, { headers: this.getHeaders() }).pipe(
      map(list => (list || [])
        .map(item => this.normalizeCampaignAccess(item))
        .filter(item => Number.isFinite(item.clubId) && item.clubId > 0)),
      catchError(err => throwError(() => err))
    );
  }

  grantPermission(campaignId: number, clubId: number, permission: CampaignPermission): Observable<CampaignAccess> {
    if (!Number.isFinite(clubId) || clubId <= 0) {
      return throwError(() => new Error('Invalid clubId for grantPermission'));
    }
    const params = new HttpParams().set('permission', permission);
    return this.http.post<any>(
      `${this.apiUrl}/${campaignId}/permissions/${clubId}`, {},
      { headers: this.getHeaders(), params }
    ).pipe(
      map(item => this.normalizeCampaignAccess(item)),
      catchError(err => throwError(() => err))
    );
  }

  revokePermission(campaignId: number, clubId: number, permission: CampaignPermission): Observable<void> {
    if (!Number.isFinite(clubId) || clubId <= 0) {
      return throwError(() => new Error('Invalid clubId for revokePermission'));
    }
    const params = new HttpParams().set('permission', permission);
    return this.http.delete<void>(
      `${this.apiUrl}/${campaignId}/permissions/${clubId}`,
      { headers: this.getHeaders(), params }
    ).pipe(catchError(err => throwError(() => err)));
  }

  // ── CAMPAIGN EVENTS
  getCampaignEvents(campaignId: number): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.apiUrl}/${campaignId}/events`, { headers: this.getHeaders() }).pipe(
      tap(r => console.log('Campaign events fetched:', r)),
      catchError(err => throwError(() => err))
    );
  }

  assignEventToCampaign(campaignId: number, eventId: number): Observable<Event> {
    return this.http.post<Event>(`${this.apiUrl}/${campaignId}/events/${eventId}`, {}, { headers: this.getHeaders() }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  removeEventFromCampaign(campaignId: number, eventId: number): Observable<Event> {
    return this.http.delete<Event>(`${this.apiUrl}/${campaignId}/events/${eventId}`, { headers: this.getHeaders() }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  // ── TOP 5 — uses backend endpoint GET /api/campaigns/top-5
  getTop5Campaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${this.apiUrl}/top-5`, { headers: this.getHeaders() }).pipe(
      tap(campaigns => console.log('[Campaigns] Top 5 from backend:', campaigns)),
      catchError(err => {
        console.error('[Campaigns] Error fetching top 5:', err);
        return throwError(() => err);
      })
    );
  }

  // ── CAMPAIGNS FOR EVENT FORM — GET /api/campaigns/for-event-form
  getCampaignsForEventForm(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${this.apiUrl}/for-event-form`, { headers: this.getHeaders() }).pipe(
      tap(campaigns => console.log('[Campaigns] For event form:', campaigns.length)),
      catchError(err => {
        console.error('[Campaigns] Error fetching campaigns for event form:', err);
        return throwError(() => err);
      })
    );
  }

  // ── ACCESSIBLE CAMPAIGNS — GET /api/campaigns/accessible
  getAccessibleCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${this.apiUrl}/accessible`, { headers: this.getHeaders() }).pipe(
      catchError(err => {
        console.error('[Campaigns] Error fetching accessible campaigns:', err);
        return throwError(() => err);
      })
    );
  }

  // ── ALL CLUBS — for permission management (to pick clubs to share with)
  getAllClubs(): Observable<Club[]> {
    return this.http.get<Club[]>(this.clubsUrl, { headers: this.getHeaders() }).pipe(
      tap(clubs => console.log('[Clubs] Fetched:', clubs.length)),
      catchError(err => {
        console.error('[Clubs] Error fetching clubs:', err);
        return throwError(() => err);
      })
    );
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN STATUS UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

export type CampaignStatusType = 'PLANNED' | 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'ARCHIVED' | 'FINISHED' | 'CANCELLED';

export const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatusType, { label: string; color: string; icon: string; description: string }> = {
  PLANNED: {
    label: 'Planifiée',
    color: '#9E9E9E',  // Grey
    icon: 'schedule',
    description: 'Campagne en cours de planification'
  },
  ACTIVE: {
    label: 'Active',
    color: '#4CAF50',  // Green
    icon: 'check_circle',
    description: 'Campagne active - événements possibles'
  },
  LOCKED: {
    label: 'Verrouillée',
    color: '#FF9800',  // Orange
    icon: 'lock',
    description: 'Campagne verrouillée - contient des participants'
  },
  DISABLED: {
    label: 'Désactivée',
    color: '#F44336',  // Red
    icon: 'block',
    description: 'Campagne désactivée par un administrateur'
  },
  ARCHIVED: {
    label: 'Archivée',
    color: '#607D8B',  // Blue Grey
    icon: 'archive',
    description: 'Campagne archivée - lecture seule'
  },
  FINISHED: {
    label: 'Terminée',
    color: '#795548',  // Brown
    icon: 'done_all',
    description: 'Campagne terminée'
  },
  CANCELLED: {
    label: 'Annulée',
    color: '#9E9E9E',  // Grey
    icon: 'cancel',
    description: 'Campagne annulée'
  }
};

export function getCampaignStatusLabel(status: CampaignStatusType): string {
  return CAMPAIGN_STATUS_CONFIG[status]?.label || status;
}

export function getCampaignStatusColor(status: CampaignStatusType): string {
  return CAMPAIGN_STATUS_CONFIG[status]?.color || '#9E9E9E';
}

export function getCampaignStatusIcon(status: CampaignStatusType): string {
  return CAMPAIGN_STATUS_CONFIG[status]?.icon || 'help';
}

export function isCampaignDeletable(status: CampaignStatusType): boolean {
  // Can only delete if: NO EVENTS with participants
  // This is checked on backend, but we show the status
  return status !== 'LOCKED' && status !== 'DISABLED' && status !== 'ARCHIVED';
}

export function isCampaignEditable(status: CampaignStatusType): boolean {
  return status === 'PLANNED' || status === 'ACTIVE';
}

export function canAddEventToCampaign(status: CampaignStatusType): boolean {
  return status === 'ACTIVE' || status === 'PLANNED';
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN LOCKED HELPERS
// ══════════════════════════════════════════════════════════════════════════════

export function isCampaignLocked(status: CampaignStatusType): boolean {
  return status === 'LOCKED';
}

export function getLockedMessage(campaign: Campaign): string {
  if (campaign.eventsCount && campaign.eventsCount > 0) {
    return `Cette campagne contient ${campaign.eventsCount} événement(s) avec des participants. `
      + `Elle a été verrouillée pour protéger les données.`;
  }
  return 'Cette campagne est verrouillée et ne peut pas être supprimée.';
}

export function canDeleteCampaign(campaign: Campaign): boolean {
  // Can only delete if: NO EVENTS with participants
  return !isCampaignLocked(campaign.status as CampaignStatusType) 
    && campaign.status !== 'DISABLED' 
    && campaign.status !== 'ARCHIVED';
}

export function getCampaignSummary(campaign: Campaign): string {
  const parts: string[] = [];
  
  if (campaign.eventsCount && campaign.eventsCount > 0) {
    parts.push(`${campaign.eventsCount} événement(s)`);
  }
  
  if (campaign.currentParticipants > 0) {
    parts.push(`${campaign.currentParticipants} participant(s)`);
  }
  
  if (campaign.views > 0) {
    parts.push(`${campaign.views} vue(s)`);
  }
  
  return parts.length > 0 ? parts.join(' • ') : 'Aucune activité';
}
