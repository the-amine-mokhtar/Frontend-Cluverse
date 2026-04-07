import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { defaultIfEmpty } from 'rxjs/operators';

import { Vehicle } from '../models/vehicle.model';
import { Transport } from '../models/transport.model';

import { VehicleService } from '../services/vehicle.service';
import { TransportService } from '../services/transport.service';
import { EventItem, LogisticsApiService } from '../services/logistics-api.service';

import { TRANSPORT_STATUS_LABELS, getStatusBadgeClasses } from '../utils/status-labels';

@Component({
  selector: 'app-vehicle-detail',
  templateUrl: './vehicle-detail.component.html'
})
export class VehicleDetailComponent implements OnInit {
  vehicleId = 0;

  loadingVehicle = false;
  loadingTransports = false;
  isDeleting = false;

  errorMessage: string | null = null;

  vehicle: Vehicle | null = null;
  transports: Transport[] = [];
  events: EventItem[] = [];

  readonly transportStatusLabels = TRANSPORT_STATUS_LABELS;
  readonly getStatusBadgeClasses = getStatusBadgeClasses;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private vehicleService: VehicleService,
    private transportService: TransportService,
    private logisticsApi: LogisticsApiService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.vehicleId = Number(idParam ?? 0);

    if (!this.vehicleId) {
      this.errorMessage = 'Véhicule introuvable.';
      return;
    }

    this.load();
  }

  load(): void {
    this.errorMessage = null;
    this.loadingVehicle = true;
    this.loadingTransports = true;

    forkJoin({
      vehicle: this.vehicleService.getById(this.vehicleId).pipe(defaultIfEmpty(null)),
      allTransports: this.transportService.getAll(),
      events: this.logisticsApi.getEvents().pipe(defaultIfEmpty([] as EventItem[]))
    }).subscribe({
      next: ({ vehicle, allTransports, events }) => {
        this.vehicle = vehicle;
        this.events = Array.isArray(events) ? events : [];

        if (!this.vehicle) {
          this.errorMessage = 'Impossible de charger le véhicule.';
          this.transports = [];
          this.loadingVehicle = false;
          this.loadingTransports = false;
          return;
        }

        const filtered = (allTransports ?? []).filter((t) => Number(t.vehicleId) === Number(this.vehicle!.id));
        this.transports = this.sortTransports(filtered);

        this.loadingVehicle = false;
        this.loadingTransports = false;
      },
      error: (error) => {
        console.error('[VehicleDetailComponent] load failed', error);
        this.errorMessage = 'Impossible de charger le véhicule.';
        this.vehicle = null;
        this.transports = [];
        this.events = [];
        this.loadingVehicle = false;
        this.loadingTransports = false;
      }
    });
  }

  availabilityLabel(): string {
    if (!this.vehicle) {
      return '—';
    }

    return this.vehicle.available ? 'Disponible' : 'Indisponible';
  }

  availabilityBadgeClasses(): string {
    if (!this.vehicle) {
      return 'px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500';
    }

    return this.vehicle.available
      ? 'px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'
      : 'px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800';
  }

  delete(): void {
    if (!this.vehicle) {
      return;
    }

    const ok = confirm(`Supprimer le véhicule "${this.vehicle.model}" ?`);
    if (!ok) {
      return;
    }

    this.isDeleting = true;
    this.errorMessage = null;

    let didEmit = false;

    this.vehicleService.delete(this.vehicle.id).subscribe({
      next: () => {
        didEmit = true;
        this.isDeleting = false;
        this.router.navigate(['/logistics/vehicles']);
      },
      error: (error) => {
        didEmit = true;
        console.error('[VehicleDetailComponent] delete failed', error);
        this.errorMessage = 'Impossible de supprimer le véhicule.';
        this.isDeleting = false;
      },
      complete: () => {
        // VehicleService returns EMPTY on error; detect completion-without-next.
        if (!didEmit) {
          this.errorMessage = 'Impossible de supprimer le véhicule.';
          this.isDeleting = false;
        }
      }
    });
  }

  private sortTransports(items: Transport[]): Transport[] {
    const list = Array.isArray(items) ? [...items] : [];
    return list.sort((a, b) => this.toTime(b.scheduledDate) - this.toTime(a.scheduledDate));
  }

  private toTime(value: unknown): number {
    if (!value) {
      return 0;
    }

    const text = String(value).trim();
    if (!text) {
      return 0;
    }

    const time = new Date(text).getTime();
    return Number.isFinite(time) ? time : 0;
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

  goBack(): void {
    this.location.back();
  }
}
