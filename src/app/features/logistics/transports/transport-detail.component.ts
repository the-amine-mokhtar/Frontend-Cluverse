import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { defaultIfEmpty } from 'rxjs/operators';

import { Transport, TransportStatus } from '../models/transport.model';
import { TransportService } from '../services/transport.service';
import { EventItem, LocationItem, LogisticsApiService, UserItem, VehicleItem } from '../services/logistics-api.service';
import { TRANSPORT_STATUS_LABELS, getStatusBadgeClasses } from '../utils/status-labels';

@Component({
  selector: 'app-transport-detail',
  templateUrl: './transport-detail.component.html'
})
export class TransportDetailComponent implements OnInit {
  transportId = 0;

  loading = false;
  errorMessage: string | null = null;

  isUpdatingStatus = false;
  isDeleting = false;

  transport: Transport | null = null;

  users: UserItem[] = [];
  events: EventItem[] = [];
  locations: LocationItem[] = [];
  vehicles: VehicleItem[] = [];

  readonly statusLabels = TRANSPORT_STATUS_LABELS;
  readonly getStatusBadgeClasses = getStatusBadgeClasses;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private transportService: TransportService,
    private logisticsApi: LogisticsApiService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.transportId = Number(idParam ?? 0);

    if (!this.transportId) {
      this.errorMessage = 'Transport introuvable.';
      return;
    }

    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      transport: this.transportService.getById(this.transportId).pipe(defaultIfEmpty(null)),
      users: this.logisticsApi.getUsers().pipe(defaultIfEmpty([] as UserItem[])),
      events: this.logisticsApi.getEvents().pipe(defaultIfEmpty([] as EventItem[])),
      locations: this.logisticsApi.getLocations().pipe(defaultIfEmpty([] as LocationItem[])),
      vehicles: this.logisticsApi.getVehicles().pipe(defaultIfEmpty([] as VehicleItem[]))
    }).subscribe({
      next: ({ transport, users, events, locations, vehicles }) => {
        this.transport = transport;
        this.users = Array.isArray(users) ? users : [];
        this.events = Array.isArray(events) ? events : [];
        this.locations = Array.isArray(locations) ? locations : [];
        this.vehicles = Array.isArray(vehicles) ? vehicles : [];

        if (!this.transport) {
          this.errorMessage = 'Impossible de charger le transport.';
        }

        this.loading = false;
      },
      error: (error) => {
        console.error('[TransportDetailComponent] load failed', error);
        this.transport = null;
        this.users = [];
        this.events = [];
        this.locations = [];
        this.vehicles = [];
        this.errorMessage = 'Impossible de charger le transport.';
        this.loading = false;
      }
    });
  }

  vehicleText(vehicleId: number): string {
    const id = Number(vehicleId ?? 0);
    const found = this.vehicles.find((v) => Number(v.id) === id);
    const plate = String((found as any)?.plateNumber ?? '').trim();
    const model = String((found as any)?.model ?? '').trim();
    if (plate && model) {
      return `${plate} — ${model}`;
    }
    if (plate) {
      return plate;
    }
    if (model) {
      return model;
    }
    return id ? `Véhicule #${id}` : '—';
  }

  userText(userId: number): string {
    const id = Number(userId ?? 0);
    const found = this.users.find((u) => Number(u.id) === id);
    const name = String(found?.fullName ?? '').trim();
    const email = String(found?.email ?? '').trim();
    if (name) {
      return email ? `${name} — ${email}` : name;
    }
    if (email) {
      return email;
    }
    return id ? `Utilisateur #${id}` : '—';
  }

  eventText(eventId: number | null): string {
    const id = Number(eventId ?? 0);
    if (!id) {
      return '—';
    }
    const found = this.events.find((e) => Number(e.id) === id);
    const title = String((found as any)?.title ?? '').trim();
    const name = String((found as any)?.name ?? '').trim();
    return title || name || `Événement #${id}`;
  }

  locationText(locationId: number | null): string {
    const id = Number(locationId ?? 0);
    if (!id) {
      return '—';
    }
    const found = this.locations.find((l) => Number(l.id) === id);
    const name = String((found as any)?.name ?? '').trim();
    const address = String((found as any)?.address ?? '').trim();
    if (name) {
      return address ? `${name} — ${address}` : name;
    }
    if (address) {
      return address;
    }
    return `Lieu #${id}`;
  }

  getLocationById(locationId: number | null): LocationItem | null {
    const id = Number(locationId ?? 0);
    if (!id) {
      return null;
    }
    return this.locations.find((l) => Number(l.id) === id) || null;
  }

  isClosed(): boolean {
    const status = this.transport?.status;
    return status === 'COMPLETED' || status === 'CANCELED';
  }

  updateStatus(nextStatus: TransportStatus): void {
    if (!this.transport || this.isUpdatingStatus) {
      return;
    }

    this.isUpdatingStatus = true;
    this.errorMessage = null;

    let didEmit = false;

    this.transportService.updateStatus(this.transport.id, nextStatus).subscribe({
      next: () => {
        didEmit = true;
        this.isUpdatingStatus = false;
        this.load();
      },
      error: (error) => {
        didEmit = true;
        console.error('[TransportDetailComponent] updateStatus failed', error);
        this.errorMessage = 'Impossible de mettre à jour le statut.';
        this.isUpdatingStatus = false;
      },
      complete: () => {
        // TransportService returns EMPTY on error; detect completion-without-next.
        if (!didEmit) {
          this.errorMessage = 'Impossible de mettre à jour le statut.';
          this.isUpdatingStatus = false;
        }
      }
    });
  }

  delete(): void {
    if (!this.transport || this.isDeleting) {
      return;
    }

    const ok = confirm(`Supprimer le transport #${this.transport.id} ?`);
    if (!ok) {
      return;
    }

    this.isDeleting = true;
    this.errorMessage = null;

    let didEmit = false;

    this.transportService.delete(this.transport.id).subscribe({
      next: () => {
        didEmit = true;
        this.isDeleting = false;
        this.router.navigate(['/logistics/transports']);
      },
      error: (error) => {
        didEmit = true;
        console.error('[TransportDetailComponent] delete failed', error);
        this.errorMessage = 'Impossible de supprimer le transport.';
        this.isDeleting = false;
      },
      complete: () => {
        if (!didEmit) {
          this.errorMessage = 'Impossible de supprimer le transport.';
          this.isDeleting = false;
        }
      }
    });
  }

  goBack(): void {
    this.location.back();
  }
}
