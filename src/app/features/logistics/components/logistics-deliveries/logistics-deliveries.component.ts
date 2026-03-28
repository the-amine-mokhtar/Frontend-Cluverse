import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ClubItem,
  EventItem,
  LocationItem,
  LogisticsApiService,
  TransportCreatePayload,
  TransportItem,
  UserItem,
  VehicleItem
} from '../../services/logistics-api.service';

type DeliveryStatus = 'PLANNED' | 'IN_PROGRESS' | 'CANCELED' | 'CANCELLED' | 'COMPLETED' | 'UNKNOWN';

type Delivery = {
  id: number;
  code: string;
  title: string;
  when: string;
  departure: string;
  destination: string;
  driver: string;
  vehicle: string;
  notes: string;
  hasDetails: boolean;
  status: DeliveryStatus;
  statusLabel: string;
};

@Component({
  selector: 'app-logistics-deliveries',
  templateUrl: './logistics-deliveries.component.html',
  styleUrls: ['./logistics-deliveries.component.scss']
})
export class LogisticsDeliveriesComponent {
  isLoading = true;
  hasError = false;
  isSubmitting = false;
  isDeleting = false;
  createError = '';
  createSuccess = '';
  showCreateForm = false;
  editingId: number | null = null;

  deliveries: Delivery[] = [];
  vehicles: VehicleItem[] = [];
  users: UserItem[] = [];
  locations: LocationItem[] = [];
  clubs: ClubItem[] = [];
  events: EventItem[] = [];

  readonly createForm = this.fb.group({
    capacity: [1, [Validators.required, Validators.min(1)]],
    arrivalTime: [''],
    clubId: [null as number | null],
    departureTime: [''],
    eventId: [null as number | null],
    departure: [''],
    destination: [''],
    driverName: [''],
    driverPhone: [''],
    notes: [''],
    vehicleType: [''],
    scheduledDate: ['', [Validators.required]],
    departureLocationId: [null as number | null, [Validators.required]],
    arrivalLocationId: [null as number | null, [Validators.required]],
    vehicleId: [null as number | null, [Validators.required]],
    userId: [null as number | null, [Validators.required]],
    status: ['PLANNED', [Validators.required]]
  });

  get totalDeliveries(): number {
    return this.deliveries.length;
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private location: Location,
    private logisticsApi: LogisticsApiService
  ) {
    this.loadSelectData();
    this.load();
  }

  private loadSelectData(): void {
    forkJoin({
      vehicles: this.logisticsApi.getVehicles(),
      users: this.logisticsApi.getUsers(),
      locations: this.logisticsApi.getLocations(),
      clubs: this.logisticsApi.getClubs(),
      events: this.logisticsApi.getEvents()
    }).subscribe({
      next: ({ vehicles, users, locations, clubs, events }) => {
        this.vehicles = vehicles || [];
        this.users = users || [];
        this.locations = locations || [];
        this.clubs = clubs || [];
        this.events = events || [];
      },
      error: () => {
        this.createError = 'Impossible de charger les listes de selection (club, event, lieu, vehicule, utilisateur).';
      }
    });
  }

  private load(): void {
    this.isLoading = true;
    this.hasError = false;

    this.logisticsApi.getTransports().subscribe({
      next: (items: TransportItem[]) => {
        this.deliveries = (items || []).map((raw: any) => this.toDelivery(raw));
      },
      error: () => {
        this.hasError = true;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  private toDelivery(raw: any): Delivery {
    const id = Number(raw?.id ?? raw?.transportId ?? raw?.transport_id ?? 0);
    const status = this.normalizeStatus(raw?.status);
    const departure = this.readText(raw?.departure ?? raw?.departureLocation?.name ?? raw?.departure_location?.name);
    const destination = this.readText(raw?.destination ?? raw?.arrivalLocation?.name ?? raw?.arrival_location?.name);
    const driver = this.readText(raw?.driverName ?? raw?.driver_name ?? raw?.user?.fullName ?? raw?.user?.name);
    const vehicle = this.readText(raw?.vehicle?.model ?? raw?.vehicleType ?? raw?.vehicle_type);
    const notes = this.readText(raw?.notes);
    const hasDetails = [departure, destination, driver, vehicle, notes].some((value) => value !== 'Non renseigne');

    return {
      id,
      code: id > 0 ? `TR-${id}` : 'TR-?',
      title: id > 0 ? `Transport #${id}` : 'Transport',
      when: this.formatDate(raw?.scheduledDate ?? raw?.scheduled_date ?? raw?.departureTime ?? raw?.departure_time),
      departure,
      destination,
      driver,
      vehicle,
      notes,
      hasDetails,
      status,
      statusLabel: this.mapStatusLabel(status)
    };
  }

  private normalizeStatus(value: unknown): DeliveryStatus {
    if (typeof value !== 'string') {
      return 'UNKNOWN';
    }

    const normalized = value.toUpperCase();
    if (normalized === 'PLANNED' || normalized === 'IN_PROGRESS' || normalized === 'COMPLETED' || normalized === 'CANCELED' || normalized === 'CANCELLED') {
      return normalized;
    }

    return 'UNKNOWN';
  }

  private mapStatusLabel(status: DeliveryStatus): string {
    switch (status) {
      case 'PLANNED':
        return 'Planifie';
      case 'IN_PROGRESS':
        return 'En cours';
      case 'COMPLETED':
        return 'Termine';
      case 'CANCELED':
      case 'CANCELLED':
        return 'Annule';
      default:
        return 'Inconnu';
    }
  }

  private readText(value: unknown): string {
    if (typeof value !== 'string') {
      return 'Non renseigne';
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'Non renseigne';
  }

  private formatDate(value: unknown): string {
    if (typeof value !== 'string' || !value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    this.editingId = null;
    this.createError = '';
    this.createSuccess = '';

    if (!this.showCreateForm) {
      this.resetForm();
    }
  }

  openCreateForm(): void {
    this.editingId = null;
    this.showCreateForm = true;
    this.createError = '';
    this.createSuccess = '';
    this.resetForm();
  }

  closeCreateForm(): void {
    this.showCreateForm = false;
    this.editingId = null;
    this.createError = '';
    this.createSuccess = '';
    this.resetForm();
  }

  editTransport(deliveryId: number): void {
    this.logisticsApi.getTransport(deliveryId).subscribe({
      next: (transport: any) => {
        this.editingId = deliveryId;
        this.showCreateForm = true;
        this.createError = '';
        this.createSuccess = '';

        const datetimeToLocal = (isoString: string | null): string => {
          if (!isoString) return '';
          try {
            const d = new Date(isoString);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          } catch {
            return '';
          }
        };

        const pickId = (...candidates: unknown[]): number | null => {
          for (const candidate of candidates) {
            if (candidate === null || candidate === undefined) {
              continue;
            }
            const num = Number(candidate);
            if (!Number.isNaN(num) && num > 0) {
              return num;
            }
          }
          return null;
        };

        const ensureOption = <T extends { id: number }>(
          list: T[],
          id: number | null,
          makePlaceholder: (missingId: number) => T
        ): void => {
          if (id === null) {
            return;
          }
          if (!list.some((item) => item.id === id)) {
            list.push(makePlaceholder(id));
          }
        };

        const clubId = pickId(transport.clubId, transport.club?.id, transport.club_id);
        const eventId = pickId(transport.eventId, transport.event?.id, transport.event_id);
        const departureLocationId = pickId(transport.departureLocationId, transport.departureLocation?.id, transport.departure_location_id);
        const arrivalLocationId = pickId(transport.arrivalLocationId, transport.arrivalLocation?.id, transport.arrival_location_id);
        const vehicleId = pickId(transport.vehicleId, transport.vehicle?.id, transport.vehicle_id);
        const userId = pickId(transport.userId, transport.user?.id, transport.user_id);

        ensureOption(this.clubs, clubId, (id) => ({ id, name: `Club #${id} (archive)` }));
        ensureOption(this.events, eventId, (id) => ({ id, title: `Event #${id} (archive)` }));
        ensureOption(this.locations, departureLocationId, (id) => ({ id, name: `Lieu #${id} (archive)` }));
        ensureOption(this.locations, arrivalLocationId, (id) => ({ id, name: `Lieu #${id} (archive)` }));
        ensureOption(this.vehicles, vehicleId, (id) => ({ id, model: `Vehicule #${id} (archive)`, plateNumber: '-', available: false }));
        ensureOption(this.users, userId, (id) => ({ id, fullName: `Utilisateur #${id} (archive)`, email: '' }));

        this.createForm.patchValue({
          capacity: transport.capacity ?? 1,
          arrivalTime: datetimeToLocal(transport.arrivalTime),
          clubId,
          departureTime: datetimeToLocal(transport.departureTime),
          eventId,
          departure: transport.departure ?? '',
          destination: transport.destination ?? '',
          driverName: transport.driverName ?? '',
          driverPhone: transport.driverPhone ?? '',
          notes: transport.notes ?? '',
          vehicleType: transport.vehicleType ?? '',
          scheduledDate: datetimeToLocal(transport.scheduledDate),
          departureLocationId,
          arrivalLocationId,
          vehicleId,
          userId,
          status: transport.status ?? 'PLANNED'
        });
      },
      error: (err) => {
        console.error('Erreur lors du chargement du transport:', err);
        this.createError = 'Impossible de charger les details du transport. Code: ' + (err?.status ?? 'inconnu');
      }
    });
  }

  deleteTransport(deliveryId: number, deliveryTitle: string): void {
    const confirmed = window.confirm(
      `Es-tu sur de vouloir supprimer "${deliveryTitle}"?\n\nCette action est irreversible.`
    );

    if (!confirmed) return;

    this.isDeleting = true;

    this.logisticsApi.deleteTransport(deliveryId).subscribe({
      next: () => {
        this.isDeleting = false;
        this.createSuccess = `Transport supprime avec succes.`;
        this.load();
      },
      error: (err) => {
        this.isDeleting = false;
        console.error('Erreur lors de la suppression:', err);
        this.createError = 'Impossible de supprimer le transport. Code: ' + (err?.status ?? 'inconnu');
      }
    });
  }

  private resetForm(): void {
    this.createForm.reset({
      capacity: 1,
      arrivalTime: '',
      clubId: null,
      departureTime: '',
      eventId: null,
      departure: '',
      destination: '',
      driverName: '',
      driverPhone: '',
      notes: '',
      vehicleType: '',
      scheduledDate: '',
      departureLocationId: null,
      arrivalLocationId: null,
      vehicleId: null,
      userId: null,
      status: 'PLANNED'
    });
  }

  submitCreate(): void {
    // Validation intelligente: en création, les IDs requis. En modification, seulement les champs visibles
    const isCreating = !this.editingId;
    
    if (isCreating) {
      // Mode création: validation stricte
      if (this.createForm.invalid) {
        this.createForm.markAllAsTouched();
        return;
      }
    } else {
      // Mode modification: validation minimale (juste les champs visibles et importants)
      const value = this.createForm.getRawValue();
      if (!value.scheduledDate || value.scheduledDate.trim().length === 0) {
        this.createError = 'Erreur: la date planifiée est requise.';
        return;
      }
      if (!value.status || value.status.trim().length === 0) {
        this.createError = 'Erreur: le statut est requis.';
        return;
      }
    }

    const value = this.createForm.getRawValue();
    const payload: TransportCreatePayload = {
      capacity: Number(value.capacity),
      arrivalTime: this.asNullableApiDateTime(value.arrivalTime || ''),
      clubId: this.asNullableNumber(value.clubId),
      departureTime: this.asNullableApiDateTime(value.departureTime || ''),
      eventId: this.asNullableNumber(value.eventId),
      departure: this.asNullableText(value.departure || ''),
      destination: this.asNullableText(value.destination || ''),
      driverName: this.asNullableText(value.driverName || ''),
      driverPhone: this.asNullableText(value.driverPhone || ''),
      notes: this.asNullableText(value.notes || ''),
      vehicleType: this.asNullableText(value.vehicleType || ''),
      scheduledDate: this.asApiDateTime(value.scheduledDate || ''),
      departureLocationId: this.asNullableNumber(value.departureLocationId),
      arrivalLocationId: this.asNullableNumber(value.arrivalLocationId),
      status: value.status as TransportCreatePayload['status'],
      vehicleId: this.asNullableNumber(value.vehicleId),
      userId: this.asNullableNumber(value.userId)
    };

    this.isSubmitting = true;
    this.createError = '';
    this.createSuccess = '';

    console.log('submitCreate - isCreating:', isCreating, 'editingId:', this.editingId);
    const request = this.editingId 
      ? this.logisticsApi.updateTransport(this.editingId, payload)
      : this.logisticsApi.createTransport(payload);

    request.subscribe({
      next: (response) => {
        console.log('submitCreate - success response:', response);
        this.isSubmitting = false;
        const action = this.editingId ? 'modifie' : 'ajoute';
        this.showCreateForm = false;
        this.editingId = null;
        this.createSuccess = `Transport ${action} avec succes.`;
        this.resetForm();
        this.load();
      },
      error: (error: unknown) => {
        console.error('submitCreate - error:', error);
        this.isSubmitting = false;
        this.createError = this.extractErrorMessage(error);
      }
    });
  }

  private asApiDateTime(value: string): string {
    if (!value) {
      return value;
    }
    return value.length === 16 ? `${value}:00` : value;
  }

  private asNullableApiDateTime(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return this.asApiDateTime(trimmed);
  }

  private asNullableText(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private asNullableNumber(value: unknown): number | null {
    if (value === null || Number.isNaN(Number(value))) {
      return null;
    }
    return Number(value);
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  eventLabel(event: EventItem): string {
    return (event.title || event.name || `Event #${event.id}`).trim();
  }

  clubLabel(club: ClubItem): string {
    return (club.name || `Club #${club.id}`).trim();
  }

  private extractErrorMessage(error: unknown): string {
    const fallback = 'Impossible d\'ajouter le transport. Verifie les champs et les donnees disponibles.';

    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    const payload = error.error;
    if (typeof payload === 'string' && payload.trim().length > 0) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      const message = obj['message'];
      const errorText = obj['error'];

      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }

      if (typeof errorText === 'string' && errorText.trim().length > 0) {
        return errorText;
      }
    }

    const status = Number(error.status || 0);
    const url = typeof error.url === 'string' ? error.url : '';
    const statusText = typeof error.statusText === 'string' ? error.statusText : '';

    if (typeof error.message === 'string' && error.message.trim().length > 0) {
      return `[HTTP ${status}${statusText ? ` ${statusText}` : ''}] ${error.message}${url ? ` (${url})` : ''}`;
    }

    return `[HTTP ${status}] ${fallback}${url ? ` (${url})` : ''}`;
  }

  back(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    const fallback = this.router.url.startsWith('/logistics')
      ? '/logistics'
      : '/dashboard/logistics';
    void this.router.navigateByUrl(fallback);
  }
}

