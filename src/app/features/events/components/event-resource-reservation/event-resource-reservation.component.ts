import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { EventApiService, ResourceItem, ReservationRequestPayload } from '../../services/event-api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import {
  noPastDatesValidator,
  dateRangeValidator,
  maxQuantityValidator,
  minQuantityValidator
} from '../../validators/reservation.validators';

interface ReservationCartItem {
  resourceId:       number;
  resourceName:     string;
  quantityReserved: number;
  startDate:        string;
  endDate:          string;
  notes:            string;
}

interface ValidationError {
  field:   string;
  message: string;
  type:    string;
}

@Component({
  selector:    'app-event-resource-reservation',
  templateUrl: './event-resource-reservation.component.html',
  styleUrls:   ['./event-resource-reservation.component.scss']
})
export class EventResourceReservationComponent implements OnInit {

  reservationForm!:    FormGroup;
  resources:           ResourceItem[] = [];
  availableResources:  ResourceItem[] = [];
  cartItems:           ReservationCartItem[] = [];
  existingReservations: any[] = [];
  eventId?:            number;
  isSubmitting         = false;
  submittedCount       = 0;
  isLoadingReservations = false;
  minDateTime:         string = '';

  // Search filter
  reservationSearch = '';

  // Modal
  showConfirmationModal = false;
  pendingReservation:   ReservationCartItem | null = null;
  confirmationMessage  = '';

  constructor(
    private fb:          FormBuilder,
    private eventService: EventApiService,
    private authHelper:  AuthHelperService,
    private route:       ActivatedRoute,
    private router:      Router,
    private location:    Location
  ) {}

  ngOnInit(): void {
    if (!this.authHelper.isLoggedIn()) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.eventId = +this.route.snapshot.params['eventId'];
    this.setMinDateTime();
    this.initForm();
    this.loadResourcesThenReservations();
  }

  // ── Computed ────────────────────────────────────────────────────────────

  get filteredReservations(): any[] {
    if (!this.reservationSearch.trim()) return this.existingReservations;
    const q = this.reservationSearch.toLowerCase();
    return this.existingReservations.filter(r =>
      this.getResourceName(r.resourceId)?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  private loadResourcesThenReservations(): void {
    this.eventService.getResources().subscribe({
      next: (resources) => {
        this.resources          = resources;
        this.availableResources = resources.filter(r => r.availableQuantity > 0);
        this.loadExistingReservations();
      },
      error: () => {
        alert('Error loading resources');
        this.loadExistingReservations();
      }
    });
  }

  loadExistingReservations(): void {
    if (!this.eventId) return;
    this.isLoadingReservations = true;
    this.eventService.getReservationsByEvent(this.eventId).subscribe({
      next: (reservations) => {
        this.existingReservations  = reservations;
        this.isLoadingReservations = false;
      },
      error: (err) => {
        console.error('Error loading reservations:', err);
        this.existingReservations  = [];
        this.isLoadingReservations = false;
      }
    });
  }

  loadResources(): void {
    this.eventService.getResources().subscribe({
      next: (resources) => {
        this.resources          = resources;
        this.availableResources = resources.filter(r => r.availableQuantity > 0);
      },
      error: () => alert('Error loading resources')
    });
  }

  // ── Reservation CRUD ─────────────────────────────────────────────────────

  /**
   * Permanently deletes a reservation (removes from list).
   */
  deleteConfirmedReservation(id: number): void {
    if (!confirm('Permanently delete this reservation? This action cannot be undone.')) return;
    this.existingReservations = this.existingReservations.filter(r => r.id !== id);

    // Uncomment when backend DELETE endpoint is available:
    // this.eventService.deleteReservation(id).subscribe({
    //   error: () => {
    //     alert('Failed to delete reservation. Please try again.');
    //     this.loadExistingReservations();
    //   }
    // });
  }

  /**
   * ✅ NEW — Cancels a reservation (status → CANCELLED).
   * The reservation stays visible in the list with a CANCELLED badge.
   * Uses optimistic update + rollback on error.
   */
  cancelReservation(id: number): void {
    const res = this.existingReservations.find(r => r.id === id);
    if (!res || res.status === 'CANCELLED') return;

    const name = res.resourceName || this.getResourceName(res.resourceId);
    if (!confirm(`Cancel the reservation for "${name}"?\n\nThe reservation will be marked as cancelled.`)) return;

    // Optimistic update
    const previousStatus = res.status;
    res.status = 'CANCELLED';
    this.existingReservations = [...this.existingReservations];

    // Uncomment when backend PATCH/PUT endpoint is available:
    // this.eventService.cancelReservation(id).subscribe({
    //   error: () => {
    //     // Rollback on failure
    //     res.status = previousStatus;
    //     this.existingReservations = [...this.existingReservations];
    //     alert('Failed to cancel reservation. Please try again.');
    //   }
    // });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  setMinDateTime(): void {
    const now   = new Date();
    const y     = now.getFullYear();
    const m     = String(now.getMonth() + 1).padStart(2, '0');
    const d     = String(now.getDate()).padStart(2, '0');
    const h     = String(now.getHours()).padStart(2, '0');
    const min   = String(now.getMinutes()).padStart(2, '0');
    this.minDateTime = `${y}-${m}-${d}T${h}:${min}`;
  }

  initForm(): void {
    this.reservationForm = this.fb.group({
      resourceId:       ['', Validators.required],
      quantityReserved: [1, [Validators.required, minQuantityValidator()]],
      startDate:        ['', [Validators.required, noPastDatesValidator()]],
      endDate:          ['', [Validators.required, noPastDatesValidator()]],
      notes:            ['']
    }, { validators: dateRangeValidator() });
  }

  getResourceName(resourceId: number): string {
    if (!resourceId) return 'Unknown';
    const resource = this.resources.find(r => r.id === resourceId);
    return resource?.name || `Resource #${resourceId}`;
  }

  onResourceChange(): void {
    const resourceId = this.reservationForm.value.resourceId;
    const resource   = this.resources.find(r => r.id === +resourceId);
    if (!resource) return;

    const qControl = this.reservationForm.get('quantityReserved');
    if (qControl) {
      qControl.setValue(Math.min(1, resource.availableQuantity));
      qControl.setValidators([
        Validators.required,
        minQuantityValidator(),
        maxQuantityValidator(resource.availableQuantity)
      ]);
      qControl.updateValueAndValidity();
    }
  }

  getSelectedResource(): ResourceItem | undefined {
    const resourceId = this.reservationForm.value.resourceId;
    return this.resources.find(r => r.id === +resourceId);
  }

  getErrorMessage(controlName: string): string {
    const control = this.reservationForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';
    const e = control.errors;
    if (e['required'])         return 'This field is required';
    if (e['pastDate'])         return '⚠️ Date cannot be in the past';
    if (e['minQuantity'])      return '⚠️ Quantity must be at least 1';
    if (e['quantityExceeded']) return `⚠️ Maximum ${e['quantityExceeded'].max} unit(s) available`;
    return 'Invalid value';
  }

  getFormLevelError(): string {
    if (!this.reservationForm.errors) return '';
    const e = this.reservationForm.errors;
    if (e['dateRangeMismatch']) return '⚠️ End date must be after start date';
    return '';
  }

  private validateReservation(formValue: any, resource: ResourceItem): ValidationError[] {
    const errors: ValidationError[] = [];
    const now   = new Date();
    const start = new Date(formValue.startDate);
    const end   = new Date(formValue.endDate);

    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start < now) errors.push({ field: 'startDate', message: '⚠️ Start date cannot be in the past', type: 'PAST_DATE' });
    if (end < now)   errors.push({ field: 'endDate',   message: '⚠️ End date cannot be in the past',   type: 'PAST_DATE' });
    if (end <= start) errors.push({ field: 'endDate',  message: '⚠️ End date must be strictly after start date', type: 'DATE_RANGE_INVALID' });

    const qty = parseInt(formValue.quantityReserved, 10);
    if (isNaN(qty) || qty < 1) errors.push({ field: 'quantityReserved', message: '⚠️ Quantity must be at least 1', type: 'QUANTITY_INVALID' });
    if (qty > resource.availableQuantity) errors.push({ field: 'quantityReserved', message: `⚠️ Only ${resource.availableQuantity} unit(s) available`, type: 'QUANTITY_EXCEEDED' });

    return errors;
  }

  // ── Cart ─────────────────────────────────────────────────────────────────

  addToCart(): void {
    if (this.reservationForm.invalid) {
      this.reservationForm.markAllAsTouched();
      return;
    }

    const formValue = this.reservationForm.value;
    const resource  = this.getSelectedResource();

    if (!resource) { alert('⚠️ Please select a valid resource'); return; }

    const validationErrors = this.validateReservation(formValue, resource);
    if (validationErrors.length > 0) { alert(validationErrors.map(e => e.message).join('\n')); return; }

    const existingIndex = this.cartItems.findIndex(item =>
      item.resourceId === resource.id &&
      item.startDate  === formValue.startDate &&
      item.endDate    === formValue.endDate
    );

    const reservationItem: ReservationCartItem = {
      resourceId:       resource.id,
      resourceName:     resource.name,
      quantityReserved: formValue.quantityReserved,
      startDate:        formValue.startDate,
      endDate:          formValue.endDate,
      notes:            formValue.notes
    };

    if (existingIndex >= 0) {
      this.pendingReservation = {
        ...this.cartItems[existingIndex],
        quantityReserved: this.cartItems[existingIndex].quantityReserved + formValue.quantityReserved
      };
      this.confirmationMessage = `Update quantity for "${resource.name}"?\n\nCurrent: ${this.cartItems[existingIndex].quantityReserved} → New: ${this.pendingReservation.quantityReserved} units`;
    } else {
      this.pendingReservation = reservationItem;
      const s = new Date(formValue.startDate).toLocaleString();
      const e = new Date(formValue.endDate).toLocaleString();
      this.confirmationMessage = `Add "${resource.name}" to cart?\n\n📦 Quantity: ${formValue.quantityReserved} unit(s)\n📅 From: ${s}\n⏳ Until: ${e}${formValue.notes ? `\n📝 Notes: ${formValue.notes}` : ''}`;
    }

    this.showConfirmationModal = true;
  }

  confirmAddToCart(): void {
    if (!this.pendingReservation) return;

    const existingIndex = this.cartItems.findIndex(item =>
      item.resourceId === this.pendingReservation!.resourceId &&
      item.startDate  === this.pendingReservation!.startDate  &&
      item.endDate    === this.pendingReservation!.endDate
    );

    if (existingIndex >= 0) {
      this.cartItems[existingIndex].quantityReserved = this.pendingReservation.quantityReserved;
    } else {
      this.cartItems.push(this.pendingReservation);
    }

    this.reservationForm.reset({ resourceId: '', quantityReserved: 1, startDate: '', endDate: '', notes: '' });
    this.closeConfirmationModal();
  }

  closeConfirmationModal(): void {
    this.showConfirmationModal = false;
    this.pendingReservation    = null;
    this.confirmationMessage   = '';
  }

  removeFromCart(index: number): void {
    this.cartItems.splice(index, 1);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  submit(): void {
    if (this.cartItems.length === 0) { alert('Please add at least one resource to reserve'); return; }

    this.isSubmitting   = true;
    this.submittedCount = 0;
    const userId        = this.authHelper.getUserId();

    const reservations = this.cartItems.map(item => {
      const payload: ReservationRequestPayload = {
        resourceId:       item.resourceId,
        eventId:          this.eventId!,
        userId,
        quantityReserved: item.quantityReserved,
        startDate:        item.startDate,
        endDate:          item.endDate,
        status:           'PENDING',
        notes:            item.notes
      };
      return this.eventService.createReservation(payload);
    });

    Promise.all(reservations.map(obs => obs.toPromise())).then(
      () => {
        this.cartItems    = [];
        this.isSubmitting = false;
        this.loadResourcesThenReservations();
      },
      (error) => {
        alert('❌ Error creating some reservations. Please try again.');
        console.error(error);
        this.isSubmitting = false;
      }
    );
  }


  /**
   * ✅ Navigates back to the previous page (browser history).
   * Falls back to a safe route if there is no history.
   */
  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/dashboard/events']);
    }
  }
  cancel(): void {
    if (this.cartItems.length === 0) return;
    if (confirm('Discard all items in your cart?')) {
      this.cartItems = [];
    }
  }
}