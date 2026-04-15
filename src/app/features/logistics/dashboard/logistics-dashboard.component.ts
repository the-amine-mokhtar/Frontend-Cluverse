import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { defaultIfEmpty } from 'rxjs/operators';

import { ResourceService } from '../services/resource.service';
import { VehicleService } from '../services/vehicle.service';
import { TransportService } from '../services/transport.service';
import { LogisticsApiService, LocationItem } from '../services/logistics-api.service';

import { Resource } from '../models/resource.model';
import { Vehicle } from '../models/vehicle.model';
import { Transport } from '../models/transport.model';

import {
  RESOURCE_STATUS_LABELS,
  TRANSPORT_STATUS_LABELS,
  getStatusBadgeClasses
} from '../utils/status-labels';

@Component({
  selector: 'app-logistics-dashboard',
  templateUrl: './logistics-dashboard.component.html'
})
export class LogisticsDashboardComponent implements OnInit {
  loading = false;
  errorMessage: string | null = null;

  clubId = 0;

  resources: Resource[] = [];
  vehicles: Vehicle[] = [];
  transports: Transport[] = [];
  locations: LocationItem[] = [];

  lowStockResources: Resource[] = [];
  upcomingTransports: Transport[] = [];

  kpiTotalResources = 0;
  kpiLowStockResources = 0;
  kpiAvailableVehicles = 0;
  kpiTransportsThisWeek = 0;
  kpiTotalTransports = 0;
  kpiTransportsPlanned = 0;

  readonly resourceStatusLabels = RESOURCE_STATUS_LABELS;
  readonly transportStatusLabels = TRANSPORT_STATUS_LABELS;
  readonly getStatusBadgeClasses = getStatusBadgeClasses;

  constructor(
    private router: Router,
    private resourceService: ResourceService,
    private vehicleService: VehicleService,
    private transportService: TransportService,
    private logisticsApi: LogisticsApiService
  ) {}

  ngOnInit(): void {
    const storedClubId = Number(localStorage.getItem('clubId') ?? 0);
    this.clubId = Number.isFinite(storedClubId) ? storedClubId : 0;

    this.loading = true;
    this.errorMessage = null;

    // First, update all transport statuses automatically
    this.transportService.updateAllStatuses().subscribe({
      next: () => {
        // Then load the current data
        this.loadDashboard();
      },
      error: (error) => {
        console.error('[LogisticsDashboardComponent] updateAllStatuses failed', error);
        // Continue loading even if update fails
        this.loadDashboard();
      }
    });
  }

  private loadDashboard(): void {
    forkJoin({
      resources: this.resourceService.getAll(this.clubId),
      vehicles: this.vehicleService.getAll(),
      transports: this.transportService.getAll(),
      locations: this.logisticsApi.getLocations().pipe(defaultIfEmpty([] as LocationItem[]))
    }).subscribe({
      next: ({ resources, vehicles, transports, locations }) => {
        this.resources = resources;
        this.vehicles = vehicles;
        this.transports = transports;
        this.locations = Array.isArray(locations) ? locations : [];

        this.lowStockResources = this.resources.filter(
          (r) => Number(r.availableQuantity) <= Number(r.lowStockThreshold)
        );

        const now = new Date().getTime();
        this.upcomingTransports = this.transports
          .filter((t) => {
            // Exclure les transports passés
            if (this.toTime(t.scheduledDate) < now) {
              return false;
            }
            return t.status === 'PLANNED' || t.status === 'IN_PROGRESS';
          })
          .sort((a, b) => this.toTime(a.scheduledDate) - this.toTime(b.scheduledDate))
          .slice(0, 5);

        this.kpiTotalResources = this.resources.length;
        this.kpiLowStockResources = this.lowStockResources.length;
        this.kpiAvailableVehicles = this.vehicles.filter((v) => v.available === true).length;
        this.kpiTransportsThisWeek = this.transports.filter((t) => {
          const isActive = t.status === 'PLANNED' || t.status === 'IN_PROGRESS';
          return isActive && this.isInCurrentIsoWeek(t.scheduledDate);
        }).length;
        this.kpiTotalTransports = this.transports.length;
        this.kpiTransportsPlanned = this.transports.filter((t) => t.status === 'PLANNED').length;

        this.loading = false;
      },
      error: (error) => {
        console.error('[LogisticsDashboardComponent] load failed', error);
        this.errorMessage = 'Impossible de charger le dashboard logistique.';
        this.loading = false;
      }
    });
  }

  private toTime(value: unknown): number {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }

    const text = String(value).trim();
    if (!text) {
      return Number.POSITIVE_INFINITY;
    }

    const time = new Date(text).getTime();
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
  }

  private isInCurrentIsoWeek(value: unknown): boolean {
    const time = this.toTime(value);
    if (!Number.isFinite(time)) {
      return false;
    }

    const target = new Date(time);
    const now = new Date();

    const start = this.startOfIsoWeek(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return target >= start && target < end;
  }

  private startOfIsoWeek(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    // ISO week starts Monday. JS getDay(): 0=Sun,1=Mon,...
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    return d;
  }

  getVehicleLabel(vehicleId: number | string | undefined): string {
    const id = Number(vehicleId ?? 0);
    if (!id) {
      return 'Véhicule inconnu';
    }

    const vehicle = this.vehicles.find((v) => Number(v.id) === id);
    if (!vehicle) {
      return `Véhicule #${id}`;
    }

    const plate = String(vehicle.plateNumber ?? '').trim();
    const model = String(vehicle.model ?? '').trim();

    if (plate && model) {
      return `${plate} — ${model}`;
    }
    if (plate) {
      return plate;
    }
    if (model) {
      return model;
    }

    return `Véhicule #${id}`;
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

  scrollTo(sectionId: string): void {
    const id = String(sectionId ?? '').trim();
    if (!id) {
      return;
    }

    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  navigateToLowStockResources(): void {
    this.router.navigate(['/logistics/resources'], { queryParams: { filter: 'low-stock' } });
  }
}
