import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { defaultIfEmpty } from 'rxjs/operators';

import { Vehicle } from '../models/vehicle.model';
import { Transport, TransportStatus } from '../models/transport.model';

import { VehicleService } from '../services/vehicle.service';
import { TransportService } from '../services/transport.service';
import {
  EventItem,
  LocationItem,
  LogisticsApiService,
  UserItem
} from '../services/logistics-api.service';

import { TRANSPORT_STATUS_LABELS } from '../utils/status-labels';

@Component({
  selector: 'app-transport-form',
  templateUrl: './transport-form.component.html'
})
export class TransportFormComponent implements OnInit {
  pageTitle = 'Planifier un transport';

  loading = false;
  isSubmitting = false;
  errorMessage: string | null = null;

  isEditMode = false;
  transportId: number | null = null;

  vehicles: Vehicle[] = [];
  users: UserItem[] = [];
  events: EventItem[] = [];
  locations: LocationItem[] = [];

  readonly statusLabels = TRANSPORT_STATUS_LABELS;
  readonly statusOptions: TransportStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'];

  form = this.fb.group({
    scheduledDate: ['', [Validators.required, this.futureValidator()]],
    status: ['PLANNED' as TransportStatus, [Validators.required]],

    vehicleId: ['', [Validators.required]],

    departureLocationId: ['', [Validators.required]],
    arrivalLocationId: ['', [Validators.required]],

    userId: ['', [Validators.required]],
    eventId: ['']
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private vehicleService: VehicleService,
    private transportService: TransportService,
    private logisticsApi: LogisticsApiService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.isEditMode = Boolean(idParam);
    this.transportId = idParam ? Number(idParam) : null;

    this.pageTitle = this.isEditMode ? 'Modifier le transport' : 'Planifier un transport';

    if (this.isEditMode && this.transportId) {
      this.loadForEdit(this.transportId);
      return;
    }

    this.loadLookupsForCreate();
  }

  private loadLookupsForCreate(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      vehicles: this.vehicleService.getAvailable(),
      users: this.logisticsApi.getUsers().pipe(defaultIfEmpty([] as UserItem[])),
      events: this.logisticsApi.getEvents().pipe(defaultIfEmpty([] as EventItem[])),
      locations: this.logisticsApi.getLocations().pipe(defaultIfEmpty([] as LocationItem[]))
    }).subscribe({
      next: ({ vehicles, users, events, locations }) => {
        this.vehicles = vehicles;
        this.users = this.sortUsers(users);
        this.events = this.sortEvents(events);
        this.locations = this.sortLocations(locations);
        this.loading = false;
      },
      error: (error) => {
        console.error('[TransportFormComponent] loadLookupsForCreate failed', error);
        this.errorMessage = 'Impossible de charger les données du formulaire.';
        this.vehicles = [];
        this.users = [];
        this.events = [];
        this.locations = [];
        this.loading = false;
      }
    });
  }

  private loadForEdit(id: number): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      transport: this.transportService.getById(id).pipe(defaultIfEmpty(null)),
      vehicles: this.vehicleService.getAvailable(),
      users: this.logisticsApi.getUsers().pipe(defaultIfEmpty([] as UserItem[])),
      events: this.logisticsApi.getEvents().pipe(defaultIfEmpty([] as EventItem[])),
      locations: this.logisticsApi.getLocations().pipe(defaultIfEmpty([] as LocationItem[]))
    }).subscribe({
      next: ({ transport, vehicles, users, events, locations }) => {
        this.vehicles = vehicles;
        this.users = this.sortUsers(users);
        this.events = this.sortEvents(events);
        this.locations = this.sortLocations(locations);

        if (!transport) {
          this.errorMessage = 'Impossible de charger le transport.';
          this.loading = false;
          return;
        }

        this.patchForm(transport);

        this.ensureLookupsContainSelected(transport);

        const currentVehicleId = Number(transport.vehicleId ?? 0);
        const exists = this.vehicles.some((v) => Number(v.id) === currentVehicleId);

        if (currentVehicleId && !exists) {
          // Current vehicle may be unavailable; add it so the select can display it.
          this.vehicleService
            .getById(currentVehicleId)
            .pipe(defaultIfEmpty(null))
            .subscribe({
              next: (currentVehicle) => {
                if (currentVehicle) {
                  this.vehicles = [currentVehicle, ...this.vehicles];
                }
                this.loading = false;
              },
              error: () => {
                this.loading = false;
              }
            });
          return;
        }

        this.loading = false;
      },
      error: (error) => {
        console.error('[TransportFormComponent] loadForEdit failed', error);
        this.errorMessage = 'Impossible de charger le transport.';
        this.loading = false;
      }
    });
  }

  private patchForm(transport: Transport): void {
    const scheduledLocal = this.toDatetimeLocal(transport.scheduledDate);

    this.form.patchValue({
      scheduledDate: scheduledLocal,
      status: transport.status,
      vehicleId: String(transport.vehicleId ?? ''),
      userId: transport.userId ? String(transport.userId) : '',
      departureLocationId: transport.departureLocationId ? String(transport.departureLocationId) : '',
      arrivalLocationId: transport.arrivalLocationId ? String(transport.arrivalLocationId) : '',
      eventId: transport.eventId ? String(transport.eventId) : ''
    });
  }

  submit(): void {
    this.errorMessage = null;
    console.log('[TransportFormComponent] submit() called', {
      formValid: this.form.valid,
      formInvalid: this.form.invalid
    });

    if (this.form.invalid) {
      const errors = this.buildDetailedErrorMessage();
      this.errorMessage = errors;
      console.warn('[TransportFormComponent] Form is invalid:', errors);
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.value;

    const scheduled = String(raw.scheduledDate ?? '').trim();
    const scheduledDate = this.ensureSeconds(scheduled);

    const vehicleId = Number(raw.vehicleId);
    const userId = Number(raw.userId);
    const departureLocationId = Number(raw.departureLocationId);
    const arrivalLocationId = Number(raw.arrivalLocationId);

    if (!vehicleId || !userId || !departureLocationId || !arrivalLocationId) {
      this.errorMessage = 'Veuillez vérifier tous les champs obligatoires.';
      return;
    }

    const eventText = String(raw.eventId ?? '').trim();
    const eventIdNumber = Number(eventText);
    const eventId = !eventText || eventIdNumber === 0 ? null : eventIdNumber;

    const payload: Partial<Transport> = {
      scheduledDate,
      departureLocationId,
      arrivalLocationId,
      status: raw.status as TransportStatus,
      vehicleId,
      userId,
      eventId
    };

    console.log('[TransportFormComponent] Submitting payload:', payload);
    this.isSubmitting = true;

    if (this.isEditMode && this.transportId) {
      let didEmit = false;

      this.transportService.update(this.transportId, payload).subscribe({
        next: () => {
          didEmit = true;
          console.log('[TransportFormComponent] update succeeded');
          this.isSubmitting = false;
          this.router.navigate(['/logistics/transports', this.transportId]);
        },
        error: (error) => {
          didEmit = true;
          console.error('[TransportFormComponent] update failed', error);
          this.errorMessage = 'Impossible d\'enregistrer le transport.';
          this.isSubmitting = false;
        },
        complete: () => {
          if (!didEmit) {
            this.errorMessage = 'Impossible d\'enregistrer le transport.';
            this.isSubmitting = false;
          }
        }
      });

      return;
    }

    let didEmit = false;

    this.transportService.create(payload).subscribe({
      next: () => {
        didEmit = true;
        console.log('[TransportFormComponent] create succeeded');
        this.isSubmitting = false;
        this.router.navigate(['/logistics/transports']);
      },
      error: (error) => {
        didEmit = true;
        console.error('[TransportFormComponent] create failed', error);
        this.errorMessage = 'Impossible de planifier le transport.';
        this.isSubmitting = false;
      },
      complete: () => {
        if (!didEmit) {
          this.errorMessage = 'Impossible de planifier le transport.';
          this.isSubmitting = false;
        }
      }
    });
  }

  private buildDetailedErrorMessage(): string {
    const errors: string[] = [];

    const dateCtrl = this.form.get('scheduledDate');
    if (dateCtrl?.invalid) {
      if (dateCtrl.hasError('required')) {
        errors.push('• Date: champ obligatoire');
      } else if (dateCtrl.hasError('futurDate')) {
        errors.push('• Date: doit être supérieure à aujourd\'hui');
      }
    }

    const statusCtrl = this.form.get('status');
    if (statusCtrl?.invalid) {
      if (statusCtrl.hasError('required')) {
        errors.push('• Statut: champ obligatoire');
      }
    }

    const vehicleCtrl = this.form.get('vehicleId');
    if (vehicleCtrl?.invalid) {
      if (vehicleCtrl.hasError('required')) {
        errors.push('• Véhicule: champ obligatoire');
      }
    }

    const depCtrl = this.form.get('departureLocationId');
    if (depCtrl?.invalid) {
      if (depCtrl.hasError('required')) {
        errors.push('• Lieu de départ: champ obligatoire');
      }
    }

    const arrCtrl = this.form.get('arrivalLocationId');
    if (arrCtrl?.invalid) {
      if (arrCtrl.hasError('required')) {
        errors.push('• Lieu d\'arrivée: champ obligatoire');
      }
    }

    const userCtrl = this.form.get('userId');
    if (userCtrl?.invalid) {
      if (userCtrl.hasError('required')) {
        errors.push('• Responsable: champ obligatoire');
      }
    }

    if (errors.length === 0) {
      return 'Erreur dans le formulaire.';
    }

    return 'Veuillez corriger les erreurs:\n' + errors.join('\n');
  }

  cancel(): void {
    if (this.isEditMode && this.transportId) {
      this.router.navigate(['/logistics/transports', this.transportId]);
      return;
    }

    this.router.navigate(['/logistics/transports']);
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return Boolean(control && control.invalid && control.touched);
  }

  errorForScheduledDate(): string {
    return 'La date est obligatoire';
  }

  errorForVehicleId(): string {
    return 'Veuillez sélectionner un véhicule';
  }

  errorForUserId(): string {
    return 'Veuillez sélectionner un responsable';
  }

  errorForLocation(): string {
    return 'Veuillez sélectionner un lieu';
  }

  userOptionLabel(u: UserItem): string {
    const name = String(u?.fullName ?? '').trim();
    const email = String(u?.email ?? '').trim();
    if (name) {
      return email ? `${name} — ${email}` : name;
    }
    if (email) {
      return email;
    }
    return `Utilisateur #${u.id}`;
  }

  eventOptionLabel(e: EventItem): string {
    const title = String((e as any)?.title ?? '').trim();
    const name = String((e as any)?.name ?? '').trim();
    return title || name || `Événement #${e.id}`;
  }

  locationOptionLabel(l: LocationItem): string {
    const name = String((l as any)?.name ?? '').trim();
    const address = String((l as any)?.address ?? '').trim();
    if (name) {
      return address ? `${name} — ${address}` : name;
    }
    if (address) {
      return address;
    }
    return `Lieu #${l.id}`;
  }

  private ensureLookupsContainSelected(transport: Transport): void {
    const userId = Number(transport.userId ?? 0);
    if (userId && !this.users.some((u) => Number(u.id) === userId)) {
      this.users = [{ id: userId, fullName: `Utilisateur #${userId}` }, ...this.users];
    }

    const depId = Number(transport.departureLocationId ?? 0);
    if (depId && !this.locations.some((l) => Number(l.id) === depId)) {
      this.locations = [{ id: depId, name: `Lieu #${depId}` }, ...this.locations];
    }

    const arrId = Number(transport.arrivalLocationId ?? 0);
    if (arrId && !this.locations.some((l) => Number(l.id) === arrId)) {
      this.locations = [{ id: arrId, name: `Lieu #${arrId}` }, ...this.locations];
    }

    const eventId = Number(transport.eventId ?? 0);
    if (eventId && !this.events.some((e) => Number(e.id) === eventId)) {
      this.events = [{ id: eventId, name: `Événement #${eventId}` }, ...this.events];
    }
  }

  private sortUsers(items: UserItem[]): UserItem[] {
    const arr = Array.isArray(items) ? items.slice() : [];
    return arr.sort((a, b) => this.userOptionLabel(a).localeCompare(this.userOptionLabel(b)));
  }

  private sortEvents(items: EventItem[]): EventItem[] {
    const arr = Array.isArray(items) ? items.slice() : [];
    return arr.sort((a, b) => this.eventOptionLabel(a).localeCompare(this.eventOptionLabel(b)));
  }

  private sortLocations(items: LocationItem[]): LocationItem[] {
    const arr = Array.isArray(items) ? items.slice() : [];
    return arr.sort((a, b) => this.locationOptionLabel(a).localeCompare(this.locationOptionLabel(b)));
  }

  errorForRequired(): string {
    return 'Champ obligatoire';
  }

  errorForStatus(): string {
    return 'Le statut est obligatoire';
  }

  private toDatetimeLocal(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '';
    }

    // If it already looks like yyyy-MM-ddTHH:mm or includes seconds, slice.
    if (text.includes('T') && text.length >= 16) {
      return text.slice(0, 16);
    }

    const d = new Date(text);
    if (!Number.isFinite(d.getTime())) {
      return '';
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private ensureSeconds(value: string): string {
    // datetime-local returns yyyy-MM-ddTHH:mm; backend LocalDateTime often expects seconds.
    if (value && value.length === 16) {
      return `${value}:00`;
    }
    return value;
  }

  getFieldError(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control || !control.invalid) {
      return '';
    }

    if (fieldName === 'scheduledDate') {
      if (control.hasError('required')) return 'La date est obligatoire';
      if (control.hasError('futureDate')) return 'La date doit être supérieure à aujourd\'hui';
    }

    if (fieldName === 'status') {
      if (control.hasError('required')) return 'Le statut est obligatoire';
    }

    if (fieldName === 'vehicleId') {
      if (control.hasError('required')) return 'Veuillez sélectionner un véhicule';
    }

    if (fieldName === 'departureLocationId') {
      if (control.hasError('required')) return 'Veuillez sélectionner un lieu de départ';
    }

    if (fieldName === 'arrivalLocationId') {
      if (control.hasError('required')) return 'Veuillez sélectionner un lieu d\'arrivée';
    }

    if (fieldName === 'userId') {
      if (control.hasError('required')) return 'Veuillez sélectionner un responsable';
    }

    return '';
  }

  private futureValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) return null; // required validator handles this

      // Parse datetime-local string (YYYY-MM-DDTHH:mm)
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!match) return null; // Invalid format, let other validator handle

      const [, yyyy, mm, dd] = match;
      const parsedDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      parsedDate.setHours(0, 0, 0, 0);

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Date must be >= today (future validator for timeslots, next day technically "future")
      return parsedDate.getTime() > now.getTime() ? null : { futureDate: true };
    };
  }

  goBack(): void {
    this.location.back();
  }
}
