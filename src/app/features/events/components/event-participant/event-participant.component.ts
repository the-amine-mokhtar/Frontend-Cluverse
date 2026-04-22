import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  EventApiService,
  EventItem,
  EventStatus,
  Participation,
  ParticipationPayload,
  ResourceItem,
  ReservationItem,
  ReservationRequestPayload,
  normalizeEvent   // AMÉLIORATION: import de la fonction centralisée
} from '../../services/event-api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-event-participant',
  templateUrl: './event-participant.component.html',
  styleUrls: ['./event-participant.component.scss']
})
export class EventParticipantComponent implements OnInit {

  events:           EventItem[]     = [];
  myParticipations: Participation[] = [];

  participationForm!: FormGroup;
  reservationForm!:   FormGroup;

  resources:         ResourceItem[]  = [];
  availableResources:ResourceItem[]  = [];
  detailReservations:ReservationItem[] = [];
  showReservationForm     = false;
  isLoadingReservations   = false;
  isSubmittingReservation = false;

  selectedEvent:    EventItem   | null = null;
  detailEvent:      EventItem   | null = null;
  detailParticipants: Participation[]  = [];
  editId:           number | null      = null;

  activeParticipations:    Participation[] = [];
  completedParticipations: Participation[] = [];
  cancelledParticipations: Participation[] = [];

  campaigns:       any[] = [];
  selectedCampaign: any  = null;

  searchQuery  = '';
  isSubmitting = false;
  isLoadingEvents         = false;
  isLoadingParticipations = false;
  confirmDeleteParticipationId: number | null = null;
  isAdmin = false;

  constructor(
    private eventService: EventApiService,
    private fb:           FormBuilder,
    private authHelper:   AuthHelperService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initReservationForm();
    this.loadEvents();
    this.loadMyParticipations();
  }

  // ── Forms ───────────────────────────────────────────────────────────────────

  initForm(): void {
    this.participationForm = this.fb.group({
      fullName:           ['', Validators.required],
      email:              ['', [Validators.required, Validators.email]],
      phone:              ['', Validators.required],
      reservedSeats:      [1, [Validators.required, Validators.min(1)]],
      contactInfo:        [''],
      comment:            [''],
      wantsReminder:      [true],
      dietaryRequirements:[''],
      emergencyContact:   [''],
      teamName:           [''],
    });
  }

  initReservationForm(): void {
    this.reservationForm = this.fb.group({
      resourceId:       ['', Validators.required],
      quantityReserved: [1, [Validators.required, Validators.min(1)]],
      startDate:        ['', Validators.required],
      endDate:          ['', Validators.required],
      notes:            ['']
    });
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  loadEvents(): void {
    this.isLoadingEvents = true;
    this.eventService.getAllEvents().subscribe({
      next: res => {
        // FIX #5: normalizeEvent retourne EventStatus complet → COMPLETED et ONGOING sont valides
        // AMÉLIORATION: fonction centralisée, plus de duplication
        this.events = res.map(e => ({
          ...normalizeEvent(e),
          imageUrl: this.getImageUrl(e.imageUrl) ?? undefined
        }));
        this.isLoadingEvents = false;
      },
      error: err => {
        console.error(err);
        this.isLoadingEvents = false;
      }
    });
  }

  loadMyParticipations(): void {
    this.isLoadingParticipations = true;
    this.eventService.getMyParticipations().subscribe({
      next: res => {
        const normalized = res.map(p => ({
          ...p,
          event: p.event ? normalizeEvent(p.event) : undefined
        }));

        this.myParticipations = normalized;

        // FIX #5: 'REGISTERED' est maintenant valide dans ParticipationStatus
        // FIX #5: 'COMPLETED' est maintenant valide dans EventStatus
        this.activeParticipations = normalized.filter(p =>
          p.status === 'REGISTERED' && p.event?.status !== 'COMPLETED'
        );

        // FIX #5: 'ATTENDED' est maintenant valide dans ParticipationStatus
        this.completedParticipations = normalized.filter(p =>
          p.status === 'ATTENDED' || p.event?.status === 'COMPLETED'
        );

        this.cancelledParticipations = normalized.filter(p => p.status === 'CANCELLED');
        this.isLoadingParticipations = false;
      },
      error: err => {
        console.error(err);
        this.isLoadingParticipations = false;
      }
    });
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  get filteredEvents(): EventItem[] {
    // FIX #5: 'COMPLETED' est valide → pas d'erreur TS2367
    const visible = this.events.filter(e => e.status !== 'COMPLETED');
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(e =>
      e.title?.toLowerCase().includes(q)       ||
      e.description?.toLowerCase().includes(q) ||
      e.locationName?.toLowerCase().includes(q)
    );
  }

  applyFilters(): void { /* déclenche le getter via Change Detection */ }

  getParticipation(eventId: number): Participation | undefined {
    return this.myParticipations.find(
      p => p.event?.id === eventId &&
           p.status !== 'CANCELLED' &&
           p.event?.status !== 'COMPLETED'
    );
  }

  countByStatus(s: string): number {
    return this.myParticipations.filter(p => p.status === s).length;
  }

  isEventCompleted(event?: EventItem | null): boolean {
    return event?.status === 'COMPLETED';
  }

  canJoin(event: EventItem): boolean {
    return !this.isEventFull(event) && event.status !== 'COMPLETED';
  }

  isEventFull(event: EventItem): boolean {
    return (event.participantsCount ?? 0) >= (event.capacity ?? 0);
  }

  isParticipating(eventId: number): boolean {
    return this.myParticipations.some(
      p => p.event?.id === eventId && p.status !== 'CANCELLED'
    );
  }

  // ── Image ───────────────────────────────────────────────────────────────────

  getImageUrl(url?: string): string | null {
    if (!url?.trim()) return null;
    if (url.startsWith('http')) return url;
    return `http://localhost:8081${url}`;
  }

  onImgError(e: Event): void {
    (e.target as HTMLImageElement).style.display = 'none';
  }

  // ── Modals ──────────────────────────────────────────────────────────────────

  openPayment(): void {
    if (!this.selectedEvent) return;
    console.log('Redirect to payment for event:', this.selectedEvent.id);
  }

  openJoin(event: EventItem): void {
    if (this.isEventFull(event) || this.isEventCompleted(event)) return;
    this.selectedEvent = event;
    this.editId        = null;
    this.detailEvent   = null;
    this.participationForm.reset({
      fullName: '', email: '', phone: '', reservedSeats: 1,
      contactInfo: '', comment: '', wantsReminder: true,
      dietaryRequirements: '', emergencyContact: '', teamName: ''
    });
    if (event.isPaid && (event.price ?? 0) > 0) this.openPayment();
  }

  openEdit(eventId: number): void {
    const p = this.myParticipations.find(
      x => x.event?.id === eventId && x.status !== 'CANCELLED'
    );
    if (!p?.event || this.isEventCompleted(p.event)) return;
    this.selectedEvent = p.event;
    this.editId        = p.id;
    this.detailEvent   = null;
    this.participationForm.patchValue({
      fullName:            p.userName            ?? '',
      email:               p.userEmail           ?? '',
      phone:               p.userPhone           ?? '',
      reservedSeats:       p.reservedSeats       ?? 1,
      contactInfo:         p.contactInfo         ?? '',
      comment:             p.comment             ?? '',
      wantsReminder:       p.wantsReminder       ?? true,
      dietaryRequirements: p.dietaryRequirements ?? '',
      emergencyContact:    p.emergencyContact    ?? '',
      teamName:            p.teamName            ?? ''
    });
  }

  openDetail(event: EventItem): void {
    this.detailEvent       = event;
    this.selectedEvent     = null;
    this.editId            = null;
    this.detailParticipants = [];
    this.detailReservations = [];
    this.showReservationForm = false;
    this.reservationForm.reset({ resourceId: '', quantityReserved: 1, startDate: '', endDate: '', notes: '' });
    this.loadResources();
    this.loadEventReservations(event.id);
    this.loadEventParticipants(event.id);
  }

  private loadEventParticipants(eventId: number): void {
    this.eventService.getEventParticipants(eventId).subscribe({
      next: participants => {
        this.detailParticipants = participants.map(p => ({
          ...p,
          userName:  p.userName  || p.contactInfo || 'Participant',
          userEmail: p.userEmail,
          userPhone: p.userPhone
        }));
      },
      error: err => {
        console.error('Unable to load participants:', err);
        this.detailParticipants = [];
      }
    });
  }

  private loadResources(onComplete?: () => void): void {
    this.eventService.getResources().subscribe({
      next: resources => {
        this.resources          = resources;
        this.availableResources = resources.filter(r => r.availableQuantity > 0);
        onComplete?.();
      },
      error: err => {
        console.error('Unable to load resources:', err);
        this.resources = this.availableResources = [];
        onComplete?.();
      }
    });
  }

  private loadEventReservations(eventId: number): void {
    this.isLoadingReservations = true;
    this.eventService.getReservationsByEvent(eventId).subscribe({
      next: r => { this.detailReservations = r; this.isLoadingReservations = false; },
      error: err => {
        console.error('Unable to load reservations:', err);
        this.detailReservations = [];
        this.isLoadingReservations = false;
      }
    });
  }

  getResourceName(resourceId: number): string {
    if (!resourceId) return 'Unknown';
    return this.resources.find(r => r.id === resourceId)?.name ?? `Resource #${resourceId}`;
  }

  getSelectedResource(): ResourceItem | undefined {
    return this.resources.find(r => r.id === +this.reservationForm.value.resourceId);
  }

  onReservationResourceChange(): void {
    const resource = this.getSelectedResource();
    if (!resource) return;
    const current = this.reservationForm.value.quantityReserved || 1;
    this.reservationForm.patchValue({
      quantityReserved: Math.min(Math.max(current, 1), resource.availableQuantity)
    });
  }

  toggleReservationForm(): void {
    this.showReservationForm = !this.showReservationForm;
    if (this.showReservationForm && !this.resources.length) this.loadResources();
  }

  // ── Submit reservation ──────────────────────────────────────────────────────

  submitReservation(): void {
    if (!this.detailEvent) return;
    if (this.reservationForm.invalid || this.isSubmittingReservation) {
      this.reservationForm.markAllAsTouched();
      return;
    }
    const value    = this.reservationForm.value;
    const resource = this.getSelectedResource();
    if (!resource) { alert('Please select a valid resource.'); return; }
    if (+value.quantityReserved < 1 || +value.quantityReserved > resource.availableQuantity) {
      alert(`Quantity must be between 1 and ${resource.availableQuantity}.`);
      return;
    }
    if (new Date(value.endDate) <= new Date(value.startDate)) {
      alert('End date must be after start date.');
      return;
    }
    this.isSubmittingReservation = true;
    const payload: ReservationRequestPayload = {
      resourceId:       +value.resourceId,
      eventId:          this.detailEvent.id,
      userId:           this.authHelper.getUserId(),
      quantityReserved: +value.quantityReserved,
      startDate:        value.startDate,
      endDate:          value.endDate,
      status:           'PENDING',
      notes:            value.notes
    };
    this.eventService.createReservation(payload).subscribe({
      next: () => {
        alert('Resource reserved successfully');
        this.loadEventReservations(this.detailEvent!.id);
        this.loadResources();
        this.reservationForm.reset({ resourceId: '', quantityReserved: 1, startDate: '', endDate: '', notes: '' });
        this.showReservationForm     = false;
        this.isSubmittingReservation = false;
      },
      error: err => {
        alert(err?.error?.message || err?.message || 'Unable to create reservation.');
        this.isSubmittingReservation = false;
      }
    });
  }

  // ── Close ───────────────────────────────────────────────────────────────────

  closeModal(): void {
    this.selectedEvent      = null;
    this.detailEvent        = null;
    this.detailParticipants = [];
    this.detailReservations = [];
    this.editId             = null;
    this.showReservationForm     = false;
    this.isSubmitting            = false;
    this.isSubmittingReservation = false;
  }

  closeModalOnOverlay(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) this.closeModal();
  }

  // ── Submit participation ────────────────────────────────────────────────────

  submitParticipation(): void {
    if (!this.selectedEvent) return;
    if (this.isEventFull(this.selectedEvent) || this.isEventCompleted(this.selectedEvent)) {
      alert('Event is full or already completed.');
      return;
    }
    if (this.participationForm.invalid || this.isSubmitting) {
      this.participationForm.markAllAsTouched();
      return;
    }
    if (this.editId === null && this.isParticipating(this.selectedEvent.id)) {
      this.openEdit(this.selectedEvent.id);
      return;
    }
    this.isSubmitting = true;
    if (this.editId !== null) {
      this.eventService.updateParticipation(this.editId, this.participationForm.value).subscribe({
        next: () => { this.loadMyParticipations(); this.closeModal(); },
        error: err => { console.error(err); this.isSubmitting = false; }
      });
    } else {
      const payload: ParticipationPayload = {
        ...this.participationForm.value,
        eventId: this.selectedEvent.id
      };
      this.eventService.participate(payload).subscribe({
        next: () => {
          const ev = this.events.find(e => e.id === this.selectedEvent?.id);
          if (ev) {
            ev.participantsCount = (ev.participantsCount ?? 0) + 1;
            ev.isFull = ev.participantsCount >= (ev.capacity ?? 0);
          }
          this.loadMyParticipations();
          this.closeModal();
        },
        error: err => { console.error(err); this.isSubmitting = false; }
      });
    }
  }

  // ── Cancel / Delete ─────────────────────────────────────────────────────────

  cancelParticipation(id: number):  void { this.requestCancelParticipation(id); }
  deleteParticipation(id: number):  void { this.requestCancelParticipation(id); }
  requestCancelParticipation(id: number): void { this.confirmDeleteParticipationId = id; }
  cancelDeleteParticipation():      void { this.confirmDeleteParticipationId = null; }

  confirmDeleteParticipation(): void {
    const id = this.confirmDeleteParticipationId;
    if (!id) return;
    this.confirmDeleteParticipationId = null;
    const participation = this.myParticipations.find(p => p.id === id);
    this.eventService.deleteParticipation(id).subscribe({
      next: () => {
        const ev = this.events.find(e => e.id === participation?.event?.id);
        if (ev && (ev.participantsCount ?? 0) > 0) {
          ev.participantsCount = (ev.participantsCount ?? 0) - 1;
          ev.isFull = (ev.participantsCount ?? 0) >= (ev.capacity ?? 0);
        }
        this.loadMyParticipations();
      },
      error: err => console.error(err)
    });
  }

  reactivateParticipation(id: number): void {
    this.eventService.reactivateParticipation(id).subscribe({
      next:  () => this.loadMyParticipations(),
      error: err => console.error(err)
    });
  }
}