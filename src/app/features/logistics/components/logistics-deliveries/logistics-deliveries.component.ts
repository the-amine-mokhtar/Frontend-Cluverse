import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
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
  eventTitle: string;
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
  private rawTransports: any[] = [];
  vehicles: VehicleItem[] = [];
  users: UserItem[] = [];
  locations: LocationItem[] = [];
  events: EventItem[] = [];

  readonly createForm = this.fb.group({
    scheduledDate: ['', [Validators.required]],
    departureLocationId: [null as number | null, [Validators.required]],
    arrivalLocationId: [null as number | null, [Validators.required]],
    vehicleId: [null as string | null, [Validators.required]],
    userId: [null as string | null, [Validators.required]],
    status: ['PLANNED', [Validators.required]],
    eventId: [null as number | null]
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

  private normalizeIdList<T extends { id: any }>(items: T[] | null | undefined): T[] {
    return (items || []).map((item) => ({
      ...item,
      id: Number(item.id)
    }));
  }

  private ensureSelectedDropdownOptions(): void {
    const pickSelectedId = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? num : null;
    };

    const departureLocationId = pickSelectedId(this.createForm.get('departureLocationId')?.value);
    const arrivalLocationId = pickSelectedId(this.createForm.get('arrivalLocationId')?.value);
    const vehicleId = pickSelectedId(this.createForm.get('vehicleId')?.value);
    const userId = pickSelectedId(this.createForm.get('userId')?.value);
    const eventId = pickSelectedId(this.createForm.get('eventId')?.value);

    const ensureOption = <T extends { id: number }>(
      list: T[],
      id: number | null,
      makePlaceholder: (missingId: number) => T
    ): void => {
      if (id === null) return;
      if (!list.some((item) => Number(item.id) === id)) {
        list.push(makePlaceholder(id));
      }
    };

    ensureOption(this.locations, departureLocationId, (id) => ({ id, name: `Lieu #${id} (archive)` } as any));
    ensureOption(this.locations, arrivalLocationId, (id) => ({ id, name: `Lieu #${id} (archive)` } as any));
    ensureOption(this.vehicles, vehicleId, (id) => ({ id, model: `Vehicule #${id} (archive)`, plateNumber: '-', available: false } as any));
    ensureOption(this.users, userId, (id) => ({ id, fullName: `Utilisateur #${id} (archive)`, email: '' } as any));
    ensureOption(this.events, eventId, (id) => ({ id, title: `Event #${id} (archive)` } as any));
  }

  private loadSelectData(): void {
    forkJoin({
      vehicles: this.logisticsApi.getVehicles(),
      users: this.logisticsApi.getUsers(),
      locations: this.logisticsApi.getLocations(),
      events: this.logisticsApi.getEvents()
    }).subscribe({
      next: ({ vehicles, users, locations, events }) => {
        this.vehicles = this.normalizeIdList(vehicles as any);
        this.users = this.normalizeIdList(users as any);
        this.locations = this.normalizeIdList(locations as any);
        this.events = this.normalizeIdList(events as any);
        this.ensureSelectedDropdownOptions();
        this.rebuildDeliveries();
      },
      error: () => {
        this.createError = 'Impossible de charger les listes de selection (lieu, vehicule, utilisateur).';
      }
    });
  }

  private rebuildDeliveries(): void {
    this.deliveries = (this.rawTransports || []).map((raw: any) => this.toDelivery(raw));
  }

  private load(): void {
    this.isLoading = true;
    this.hasError = false;

    this.logisticsApi.getTransports().subscribe({
      next: (items: TransportItem[]) => {
        this.rawTransports = (items || []) as any[];
        this.rebuildDeliveries();
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

    const departureLocationId = pickId(raw?.departureLocationId, raw?.departure_location_id);
    const arrivalLocationId = pickId(raw?.arrivalLocationId, raw?.arrival_location_id);
    const eventId = pickId(raw?.eventId, raw?.event_id);

    const departure = this.resolveLocationLabel(departureLocationId);
    const destination = this.resolveLocationLabel(arrivalLocationId);
    const eventTitle = this.resolveEventTitle(eventId);

    const hasDetails = true;

    return {
      id,
      code: id > 0 ? `TR-${id}` : 'TR-?',
      title: id > 0 ? `Transport #${id}` : 'Transport',
      when: this.formatDate(raw?.scheduledDate ?? raw?.scheduled_date ?? raw?.departureTime ?? raw?.departure_time),
      departure,
      destination,
      eventTitle,
      hasDetails,
      status,
      statusLabel: this.mapStatusLabel(status)
    };
  }

  private resolveLocationLabel(locationId: number | null): string {
    if (locationId === null) {
      return 'Non renseigne';
    }

    const found = this.locations.find((l) => Number(l.id) === locationId);
    const name = (found?.name ?? '').trim();
    return name.length > 0 ? name : `Lieu #${locationId}`;
  }

  private resolveEventTitle(eventId: number | null): string {
    if (eventId === null) {
      return 'Aucun';
    }

    const found = this.events.find((e) => Number(e.id) === eventId);
    const title = ((found as any)?.title ?? (found as any)?.name ?? '').toString().trim();
    return title.length > 0 ? title : `Event #${eventId}`;
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
          if (!list.some((item) => Number(item.id) === id)) {
            list.push(makePlaceholder(id));
          }
        };

        const departureLocationId = pickId(transport.departureLocationId, transport.departureLocation?.id, transport.departure_location_id);
        const arrivalLocationId = pickId(transport.arrivalLocationId, transport.arrivalLocation?.id, transport.arrival_location_id);
        const vehicleId = pickId(transport.vehicleId, transport.vehicle?.id, transport.vehicle_id);
        const userId = pickId(transport.userId, transport.user?.id, transport.user_id);
        const eventId = pickId(transport.eventId, transport.event?.id, transport.event_id);

        ensureOption(this.locations, departureLocationId, (id) => ({ id, name: `Lieu #${id} (archive)` }));
        ensureOption(this.locations, arrivalLocationId, (id) => ({ id, name: `Lieu #${id} (archive)` }));
        ensureOption(this.vehicles, vehicleId, (id) => ({ id, model: `Vehicule #${id} (archive)`, plateNumber: '-', available: false }));
        ensureOption(this.users, userId, (id) => ({ id, fullName: `Utilisateur #${id} (archive)`, email: '' }));
        ensureOption(this.events, eventId, (id) => ({ id, title: `Event #${id} (archive)` } as any));

        this.createForm.patchValue({
          scheduledDate: datetimeToLocal(transport.scheduledDate ?? transport.scheduled_date ?? null),
          departureLocationId,
          arrivalLocationId,
          vehicleId: vehicleId === null ? null : String(vehicleId),
          userId: userId === null ? null : String(userId),
          status: transport.status ?? 'PLANNED',
          eventId
        });

        this.ensureSelectedDropdownOptions();
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
      scheduledDate: '',
      departureLocationId: null,
      arrivalLocationId: null,
      vehicleId: null,
      userId: null,
      status: 'PLANNED',
      eventId: null
    });
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    const payload: TransportCreatePayload = {
      scheduledDate: this.asApiDateTime(value.scheduledDate || ''),
      departureLocationId: Number(value.departureLocationId),
      arrivalLocationId: Number(value.arrivalLocationId),
      status: value.status as TransportCreatePayload['status'],
      vehicleId: Number(value.vehicleId),
      userId: Number(value.userId),
      eventId: value.eventId === null ? null : Number(value.eventId)
    };

    this.isSubmitting = true;
    this.createError = '';
    this.createSuccess = '';

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

  trackById(_: number, item: { id: number }): number {
    return item.id;
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

