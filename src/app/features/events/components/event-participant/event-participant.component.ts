import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  EventApiService, EventItem, Participation, ParticipationPayload, ParticipationStatus,
  ResourceItem, ReservationItem, ReservationRequestPayload, normalizeEvent,
} from '../../services/event-api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { CampaignApiService, Campaign } from '../../services/campaign-api.service';
import { EventNotificationService } from '../../services/event-notification.service';
import { EventStatusChangeService } from '../../services/event-status-change.service';
import { SmsNotificationService, SmsNotification } from '../../services/sms-notification.service';

@Component({
  selector: 'app-event-participant',
  templateUrl: './event-participant.component.html',
  styleUrls: ['./event-participant.component.scss'],
})
export class EventParticipantComponent implements OnInit, OnDestroy {

  events: EventItem[] = [];
  myParticipations: Participation[] = [];
  activeParticipations: Participation[] = [];
  completedParticipations: Participation[] = [];
  cancelledParticipations: Participation[] = [];
  waitingListParticipations: Participation[] = [];
  campaigns: Campaign[] = [];
  isLoadingCampaigns = false;
  resources: ResourceItem[] = [];
  availableResources: ResourceItem[] = [];
  detailReservations: ReservationItem[] = [];
  selectedEvent: EventItem | null = null;
  detailEvent: EventItem | null = null;
  detailParticipants: Participation[] = [];
  editId: number | null = null;
  searchQuery = '';
  isAdmin = false;
  isLoadingEvents = false;
  isLoadingParticipations = false;
  isLoadingReservations = false;
  isSubmitting = false;
  isSubmittingReservation = false;
  isRequestingParticipation = false;
  showReservationForm = false;
  showWaitingListConfirm = false;
  showWaitingListSuccess = false;
  waitingListEvent: EventItem | null = null;
  eventsByCampaign: Map<number | null, EventItem[]> = new Map();
  showWaitingListNotice = false;
  waitingListNoticeEventTitle = '';
  confirmDeleteParticipationId: number | null = null;
  activeTab: 'active' | 'waiting' | 'history' = 'active';
  notifications: any[] = [];
  showNotifications = true;
  participationForm!: FormGroup;
  reservationForm!: FormGroup;
  smsNotificationsByParticipation: Map<number, SmsNotification[]> = new Map();
  smsLoadingMap: Map<number, boolean> = new Map();

  // ✅ Popup states
  showSuccessPopup = false;
  showWaitingPopup = false;
  showErrorPopup = false;
  successMessage = '';
  errorMessage = '';
  successEventTitle = '';

  private destroy$ = new Subject<void>();

  constructor(
    private eventService: EventApiService,
    private fb: FormBuilder,
    private authHelper: AuthHelperService,
    private campaignService: CampaignApiService,
    private router: Router,
    private notificationService: EventNotificationService,
    private statusChangeService: EventStatusChangeService,
    private smsNotificationService: SmsNotificationService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authHelper.getRole() === 'SUPER_ADMIN'
      || this.authHelper.getRole() === 'PRESIDENT';
    this.buildParticipationForm();
    this.buildReservationForm();

    this.notificationService.notifications
      .pipe(takeUntil(this.destroy$))
      .subscribe(notification => {
        this.notifications.unshift(notification);
        setTimeout(() => {
          this.notifications = this.notifications.filter(n => n.timestamp !== notification.timestamp);
        }, 8000);
      });

    this.statusChangeService.onReloadEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.notificationService.reset();
        this.loadEventsAndCampaigns();
        this.loadMyParticipations();
      });

    this.loadEventsAndCampaigns();
    this.loadMyParticipations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildParticipationForm(): void {
    this.participationForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      reservedSeats: [1, [Validators.required, Validators.min(1)]],
      contactInfo: [''],
      comment: [''],
      wantsReminder: [true],
      dietaryRequirements: [''],
      emergencyContact: [''],
      teamName: [''],
    });
  }

  private buildReservationForm(): void {
    this.reservationForm = this.fb.group({
      resourceId: ['', Validators.required],
      quantityReserved: [1, [Validators.required, Validators.min(1)]],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      notes: [''],
    });
  }

  loadEventsAndCampaigns(): void {
    this.isLoadingEvents = true;
    this.isLoadingCampaigns = true;
    forkJoin({ events: this.eventService.getAllEvents(), campaigns: this.campaignService.getAllCampaigns() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ events, campaigns }) => {
          const now = new Date();
          this.campaigns = campaigns.filter(c => {
            if (c.status !== 'ACTIVE' && c.status !== 'PLANNED') return false;
            if (c.endDate && new Date(c.endDate) < now) return false;
            return true;
          });
          this.events = events.map(e => {
            const normalized = { ...normalizeEvent(e), imageUrl: this.resolveImageUrl(e.imageUrl) ?? undefined };
            if (!normalized.campaign && normalized.campaignId) {
              const matched = this.campaigns.find(c => c.id === normalized.campaignId);
              if (matched) normalized.campaign = matched;
            }
            return normalized;
          });
          this.isLoadingEvents = false;
          this.isLoadingCampaigns = false;
        },
        error: () => { this.loadEventsFallback(); this.isLoadingCampaigns = false; },
      });
  }

  private loadEventsFallback(): void {
    this.eventService.getAllEvents().pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.events = res.map(e => ({ ...normalizeEvent(e), imageUrl: this.resolveImageUrl(e.imageUrl) ?? undefined }));
        this.isLoadingEvents = false;
      },
      error: () => { this.isLoadingEvents = false; },
    });
  }

  loadMyParticipations(): void {
    this.isLoadingParticipations = true;
    forkJoin({
      participations: this.eventService.getMyParticipations(),
      waitingList: this.eventService.getMyWaitingList()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ participations, waitingList }) => {
        // Normalize participations
        const normalizedParticipations = participations.map(p => {
          const normalizedEvent = p.event ? normalizeEvent(p.event) : undefined;
          if (normalizedEvent && !normalizedEvent.campaign && normalizedEvent.campaignId) {
            const matched = this.campaigns.find(c => c.id === normalizedEvent.campaignId);
            if (matched) normalizedEvent.campaign = matched;
          }
          return { ...p, event: normalizedEvent };
        });

        // Convert waiting list items to Participation-like objects
        const waitingListAsParticipations = (waitingList || []).map(wl => ({
          id: wl.id,
          status: 'WAITING_LIST' as ParticipationStatus,
          eventId: wl.eventId,
          event: undefined,
          registrationDate: wl.joinedAt,
          comment: `Position in queue: ${wl.positionInQueue || 'N/A'}`
        } as Participation));

        // Combine both lists
        const allParticipations = [...normalizedParticipations, ...waitingListAsParticipations];
        
        this.myParticipations = allParticipations;
        this.splitParticipations(allParticipations);
        this.notificationService.checkUpcomingEvents(normalizedParticipations);
        this.isLoadingParticipations = false;
      },
      error: () => { 
        // Fallback: try to get participations only
        this.eventService.getMyParticipations().pipe(takeUntil(this.destroy$)).subscribe({
          next: res => {
            const normalized = res.map(p => {
              const normalizedEvent = p.event ? normalizeEvent(p.event) : undefined;
              if (normalizedEvent && !normalizedEvent.campaign && normalizedEvent.campaignId) {
                const matched = this.campaigns.find(c => c.id === normalizedEvent.campaignId);
                if (matched) normalizedEvent.campaign = matched;
              }
              return { ...p, event: normalizedEvent };
            });
            this.myParticipations = normalized;
            this.splitParticipations(normalized);
            this.notificationService.checkUpcomingEvents(normalized);
            this.isLoadingParticipations = false;
          },
          error: () => { this.isLoadingParticipations = false; },
        });
      },
    });
  }
  /**
   * Load SMS notifications for a specific participation
   */
  loadSmsNotifications(participationId: number): void {
    if (this.smsNotificationsByParticipation.has(participationId)) {
      return; // Already loaded
    }

    this.smsLoadingMap.set(participationId, true);
    this.smsNotificationService.getSmsHistory(participationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.smsNotificationsByParticipation.set(participationId, result.notifications || []);
          this.smsLoadingMap.set(participationId, false);
        },
        error: (err) => {
          console.error('Error loading SMS notifications:', err);
          this.smsNotificationsByParticipation.set(participationId, []);
          this.smsLoadingMap.set(participationId, false);
        }
      });
  }

  /**
   * Get SMS notifications for a participation
   */
  getSmsNotifications(participationId: number): SmsNotification[] {
    return this.smsNotificationsByParticipation.get(participationId) || [];
  }

  /**
   * Check if SMS notifications are loading
   */
  isSmsLoading(participationId: number): boolean {
    return this.smsLoadingMap.get(participationId) || false;
  }

  /**
   * Toggle SMS notifications visibility for a participation
   */
  toggleSmsNotifications(participationId: number): void {
    if (!this.smsNotificationsByParticipation.has(participationId)) {
      this.loadSmsNotifications(participationId);
    } else {
      // Toggle visibility - can be extended to show/hide
    }
  }
  private loadResources(): void {
    if (!this.isAdmin) { this.resources = this.availableResources = []; return; }
    this.eventService.getResources().pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.resources = data; this.availableResources = data.filter(r => r.availableQuantity > 0); },
      error: () => { this.resources = this.availableResources = []; },
    });
  }

  private loadEventReservations(eventId: number): void {
    if (!this.isAdmin) { this.detailReservations = []; return; }
    this.isLoadingReservations = true;
    this.eventService.getReservationsByEvent(eventId).pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.detailReservations = data; this.isLoadingReservations = false; },
      error: () => { this.detailReservations = []; this.isLoadingReservations = false; },
    });
  }

  private loadEventParticipants(eventId: number): void {
    if (!this.isAdmin) { this.detailParticipants = []; return; }
    this.eventService.getEventParticipants(eventId).pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.detailParticipants = data; },
      error: () => { this.detailParticipants = []; },
    });
  }

  private splitParticipations(list: Participation[]): void {
    this.activeParticipations = list.filter(p => p.status === 'REGISTERED' && p.event?.status !== 'COMPLETED');
    this.completedParticipations = list.filter(p => p.status === 'ATTENDED' || (p.status === 'REGISTERED' && p.event?.status === 'COMPLETED'));
    this.cancelledParticipations = list.filter(p => p.status === 'CANCELLED');
    this.waitingListParticipations = list.filter(p => p.status === 'WAITING_LIST');
  }

  get filteredEvents(): EventItem[] {
    const participatedEventIds = new Set(
      this.myParticipations.filter(p => p.status !== 'CANCELLED')
        .map(p => p.event?.id ?? p.eventId).filter((id): id is number => id != null)
    );
    const visible = this.events.filter(e => {
      if (e.status === 'CANCELLED') return false;
      if (e.status === 'COMPLETED' && !participatedEventIds.has(e.id)) return false;
      return true;
    });
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(e =>
      e.title?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.locationName?.toLowerCase().includes(q)
    );
  }

  getEventsByCampaign(): Map<number | null, EventItem[]> {
    const grouped = new Map<number | null, EventItem[]>();
    this.filteredEvents.forEach(event => {
      const campaignId = event.campaignId ?? null;
      if (!grouped.has(campaignId)) grouped.set(campaignId, []);
      grouped.get(campaignId)?.push(event);
    });
    return grouped;
  }

  getCampaignTitle(campaignId: number | null): string {
    if (!campaignId) return 'Other Events';
    const campaign = this.campaigns.find(c => c.id === campaignId);
    return campaign?.title ?? `Campaign #${campaignId}`;
  }

  applyFilters(): void {}

  getParticipation(eventId: number): Participation | undefined {
    return this.myParticipations.find(p => (p.event?.id === eventId || p.eventId === eventId) && p.status !== 'CANCELLED');
  }

  isParticipating(eventId: number): boolean { return !!this.getParticipation(eventId); }
  isEventFull(event: EventItem): boolean { return (event.participantsCount ?? 0) >= (event.capacity ?? 0); }
  isEventCompleted(event?: EventItem | null): boolean { return event?.status === 'COMPLETED'; }
  countByStatus(s: string): number { return this.myParticipations.filter(p => p.status === s).length; }
  setTab(tab: 'active' | 'waiting' | 'history'): void { this.activeTab = tab; }
  dismissNotification(eventId: number): void { this.notifications = this.notifications.filter(n => n.eventId !== eventId); }

  getVisibilityLabel(visibility: string | undefined): string {
    if (!visibility) return '';
    const map: Record<string, string> = { PUBLIC: '🌍 Public', SHARED: '👥 Shared', PRIVATE: '🔒 Private' };
    return map[visibility] ?? visibility;
  }

  getCampaignStatusLabel(status: string | undefined): string {
    if (!status) return '';
    const map: Record<string, string> = { PLANNED: '🕐 Planned', ACTIVE: '🟢 Active', FINISHED: '✅ Finished', CANCELLED: '❌ Cancelled' };
    return map[status] ?? status;
  }

  formatDate(date?: string): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
  }

  // ── Popups ────────────────────────────────────────────────────────────────
  showSuccess(message: string, eventTitle = ''): void {
    this.successMessage = message;
    this.successEventTitle = eventTitle;
    this.showSuccessPopup = true;
  }

  showWaiting(eventTitle = ''): void {
    this.successEventTitle = eventTitle;
    this.showWaitingPopup = true;
  }

  showError(message: string): void {
    this.errorMessage = message;
    this.showErrorPopup = true;
  }

  closeSuccessPopup(): void { this.showSuccessPopup = false; }
  closeWaitingPopup(): void { this.showWaitingPopup = false; }
  closeErrorPopup(): void { this.showErrorPopup = false; }

  // ── Modals ────────────────────────────────────────────────────────────────
  openJoin(event: EventItem): void { this.requestParticipationFlow(event); }

  private openParticipationForm(event: EventItem): void {
    this.selectedEvent = event;
    this.editId = null;
    this.detailEvent = null;
    this.participationForm.reset({
      fullName: '', email: '', phone: '', reservedSeats: 1,
      contactInfo: '', comment: '', wantsReminder: true,
      dietaryRequirements: '', emergencyContact: '', teamName: '',
    });
  }

  openEdit(eventId: number): void {
    const p = this.getParticipation(eventId);
    if (!p?.event || this.isEventCompleted(p.event)) return;
    this.selectedEvent = p.event;
    this.editId = p.id;
    this.detailEvent = null;
    this.participationForm.patchValue({
      fullName: p.userName ?? '', email: p.userEmail ?? '', phone: p.userPhone ?? '',
      reservedSeats: p.reservedSeats ?? 1, contactInfo: p.contactInfo ?? '',
      comment: p.comment ?? '', wantsReminder: p.wantsReminder ?? true,
      dietaryRequirements: p.dietaryRequirements ?? '', emergencyContact: p.emergencyContact ?? '',
      teamName: p.teamName ?? '',
    });
  }

  openDetail(event: EventItem): void {
    this.detailEvent = event;
    this.selectedEvent = null;
    this.editId = null;
    this.detailParticipants = [];
    this.detailReservations = [];
    this.showReservationForm = false;
    this.reservationForm.reset({ resourceId: '', quantityReserved: 1, startDate: '', endDate: '', notes: '' });
    if (this.isAdmin) {
      this.loadResources();
      this.loadEventReservations(event.id);
      this.loadEventParticipants(event.id);
    }
  }

  closeModal(): void {
    this.selectedEvent = null;
    this.detailEvent = null;
    this.detailParticipants = [];
    this.detailReservations = [];
    this.editId = null;
    this.showReservationForm = false;
    this.showWaitingListConfirm = false;
    this.showWaitingListNotice = false;
    this.waitingListEvent = null;
    this.isSubmitting = false;
    this.isSubmittingReservation = false;
  }

  closeModalOnOverlay(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) this.closeModal();
  }

  toggleReservationForm(): void { this.showReservationForm = !this.showReservationForm; }
  dismissWaitingListNotice(): void { this.showWaitingListNotice = false; }

  requestParticipationFlow(event: EventItem): void {
    if (this.isEventCompleted(event)) return;
    this.openParticipationForm(event);
  }

  confirmWaitingList(accept: boolean): void {
    const event = this.waitingListEvent;
    this.showWaitingListConfirm = false;
    this.waitingListEvent = null;
    if (!event || !accept) return;
    this.eventService.joinWaitingList(event.id, true).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        if (result === 'WAITING_LIST_ADDED') {
          this.showWaiting(event.title);
          this.loadMyParticipations();
        }
      },
      error: () => { this.showError('Error joining waiting list. Please try again.'); },
    });
  }

  confirmPromotion(waitingId: number): void {
    this.eventService.confirmPromotion(waitingId).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        if (result === 'CONFIRMED') {
          this.showSuccess('Your spot is confirmed! See you at the event.', '');
          this.loadMyParticipations();
          this.loadEventsAndCampaigns();
        }
      },
      error: () => { this.showError('Error confirming your spot.'); },
    });
  }

  submitParticipation(): void {
    if (!this.selectedEvent) return;
    if (this.participationForm.invalid || this.isSubmitting) {
      this.participationForm.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;

    if (this.editId !== null) {
      this.eventService.updateParticipation(this.editId, this.participationForm.value)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.isSubmitting = false;
            this.closeModal();
            this.showSuccess('Your registration has been updated successfully.');
            this.loadMyParticipations();
          },
          error: err => {
            this.isSubmitting = false;
            this.showError(err?.error?.message || 'Error updating participation.');
          },
        });
    } else {
      const payload: ParticipationPayload = { ...this.participationForm.value, eventId: this.selectedEvent.id };
      const eventTitle = this.selectedEvent.title;
      this.eventService.participate(payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: (status: string) => {
          this.isSubmitting = false;
          this.closeModal();
          if (status === 'REGISTERED') {
            const ev = this.events.find(e => e.id === payload.eventId);
            if (ev) { ev.participantsCount = (ev.participantsCount ?? 0) + 1; ev.isFull = ev.participantsCount >= (ev.capacity ?? 0); }
            this.showSuccess('You are now registered for this event!', eventTitle);
            this.loadMyParticipations();
            this.loadEventsAndCampaigns();
          } else if (status === 'WAITING_LIST_ADDED') {
            this.showWaiting(eventTitle);
            this.loadMyParticipations();
            this.loadEventsAndCampaigns();
          }
        },
        error: err => {
          this.isSubmitting = false;
          if (err?.status === 409) {
            this.showError('You are already registered for this event.');
          } else {
            this.showError(err?.error?.message || 'Error registering for event.');
          }
        },
      });
    }
  }

  requestCancelParticipation(id: number): void { this.confirmDeleteParticipationId = id; }
  cancelDeleteParticipation(): void { this.confirmDeleteParticipationId = null; }
  cancelParticipation(id: number): void { this.requestCancelParticipation(id); }
  deleteParticipation(id: number): void { this.requestCancelParticipation(id); }

  confirmDeleteParticipation(): void {
    const id = this.confirmDeleteParticipationId;
    if (!id) return;
    this.confirmDeleteParticipationId = null;
    const participation = this.myParticipations.find(p => p.id === id);
    this.eventService.deleteParticipation(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        const ev = this.events.find(e => e.id === (participation?.event?.id ?? participation?.eventId));
        if (ev && (ev.participantsCount ?? 0) > 0) {
          ev.participantsCount = (ev.participantsCount ?? 0) - 1;
          ev.isFull = (ev.participantsCount ?? 0) >= (ev.capacity ?? 0);
        }
        this.showSuccess('Your participation has been cancelled.');
        this.loadMyParticipations();
      },
      error: () => { this.showError('Could not cancel participation.'); },
    });
  }

  reactivateParticipation(id: number): void {
    this.eventService.reactivateParticipation(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess('Participation reactivated successfully!');
        this.loadMyParticipations();
        this.loadEventsAndCampaigns();
      },
      error: err => {
        if (err?.status === 409) {
          this.showError('This event is now full. You can join the waiting list instead.');
        } else {
          this.showError(err?.error?.message || 'Could not reactivate participation.');
        }
      },
    });
  }

  getSelectedResource(): ResourceItem | undefined {
    const id = this.reservationForm.value.resourceId;
    return id ? this.resources.find(r => r.id === +id) : undefined;
  }

  getResourceName(resourceId: number): string {
    return this.resources.find(r => r.id === resourceId)?.name ?? `Resource #${resourceId}`;
  }

  onReservationResourceChange(): void {
    const resource = this.getSelectedResource();
    if (!resource) return;
    const current = this.reservationForm.value.quantityReserved || 1;
    this.reservationForm.patchValue({ quantityReserved: Math.min(Math.max(current, 1), resource.availableQuantity) });
  }

  submitReservation(): void {
    if (!this.isAdmin || !this.detailEvent) return;
    if (this.reservationForm.invalid || this.isSubmittingReservation) { this.reservationForm.markAllAsTouched(); return; }
    const value = this.reservationForm.value;
    const resource = this.getSelectedResource();
    if (!resource) { this.showError('Please select a valid resource.'); return; }
    if (+value.quantityReserved < 1 || +value.quantityReserved > resource.availableQuantity) {
      this.showError(`Quantity must be between 1 and ${resource.availableQuantity}.`); return;
    }
    if (new Date(value.endDate) <= new Date(value.startDate)) { this.showError('End date must be after start date.'); return; }
    this.isSubmittingReservation = true;
    const payload: ReservationRequestPayload = {
      resourceId: +value.resourceId, eventId: this.detailEvent.id, userId: this.authHelper.getUserId(),
      quantityReserved: +value.quantityReserved, startDate: value.startDate, endDate: value.endDate,
      status: 'PENDING', notes: value.notes,
    };
    this.eventService.createReservation(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess('Resource reserved successfully.');
        this.loadEventReservations(this.detailEvent!.id);
        this.loadResources();
        this.reservationForm.reset({ resourceId: '', quantityReserved: 1, startDate: '', endDate: '', notes: '' });
        this.showReservationForm = false;
        this.isSubmittingReservation = false;
      },
      error: err => { this.showError(err?.error?.message || 'Unable to create reservation.'); this.isSubmittingReservation = false; },
    });
  }

  editEvent(eventId: number): void { this.router.navigate(['/dashboard/events/edit', eventId]); }

  resolveImageUrl(url?: string): string | null {
    if (!url?.trim()) return null;
    if (url.startsWith('http')) return url;
    return `http://localhost:8081${url}`;
  }

  onImgError(e: Event): void { (e.target as HTMLImageElement).style.display = 'none'; }
}