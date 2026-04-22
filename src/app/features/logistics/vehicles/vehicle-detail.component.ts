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
  loadingFuelStatus = false;

  errorMessage: string | null = null;

  vehicle: Vehicle | null = null;
  transports: Transport[] = [];
  events: EventItem[] = [];
  fuelStatus: any = null;

  // Refuel modal
  showRefuelModal = false;
  refuelAmount = 100;
  refueling = false;
  refuelError: string | null = null;

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

        // Load fuel status
        this.loadFuelStatus();

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

  private loadFuelStatus(): void {
    if (!this.vehicle?.id) return;
    
    this.loadingFuelStatus = true;
    this.vehicleService.getFuelStatus(this.vehicle.id).subscribe({
      next: (status) => {
        this.fuelStatus = status;
        this.loadingFuelStatus = false;
        console.log('[VehicleDetailComponent] Fuel status loaded:', status);
      },
      error: (error) => {
        console.error('[VehicleDetailComponent] Failed to load fuel status', error);
        this.fuelStatus = null;
        this.loadingFuelStatus = false;
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

  /**
   * Get CSS classes for fuel status card background and border
   */
  getFuelStatusCardClass(): string {
    if (!this.fuelStatus) return '';
    const status = this.fuelStatus.status;
    switch (status) {
      case 'GREEN': return 'from-green-50 to-green-100 border-green-200';
      case 'YELLOW': return 'from-yellow-50 to-yellow-100 border-yellow-200';
      case 'ORANGE': return 'from-orange-50 to-orange-100 border-orange-200';
      case 'RED': return 'from-red-50 to-red-100 border-red-200';
      default: return 'from-gray-50 to-gray-100 border-gray-200';
    }
  }

  /**
   * Get CSS classes for fuel status text
   */
  getFuelStatusTextClass(): string {
    if (!this.fuelStatus) return 'text-gray-700';
    const status = this.fuelStatus.status;
    switch (status) {
      case 'GREEN': return 'text-green-700';
      case 'YELLOW': return 'text-yellow-700';
      case 'ORANGE': return 'text-orange-700';
      case 'RED': return 'text-red-700';
      default: return 'text-gray-700';
    }
  }

  /**
   * Get CSS classes for fuel status badge
   */
  getFuelStatusBadgeClass(): string {
    if (!this.fuelStatus) return 'bg-gray-500';
    const status = this.fuelStatus.status;
    switch (status) {
      case 'GREEN': return 'bg-green-500';
      case 'YELLOW': return 'bg-yellow-500';
      case 'ORANGE': return 'bg-orange-500';
      case 'RED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }

  /**
   * Open refuel modal
   */
  openRefuelModal(): void {
    this.showRefuelModal = true;
    this.refuelAmount = 100; // Default: fill to 100%
    this.refuelError = null;
  }

  /**
   * Close refuel modal
   */
  closeRefuelModal(): void {
    this.showRefuelModal = false;
    this.refuelError = null;
  }

  /**
   * Calculate predicted fuel level after refueling
   */
  getPredictedFuelAfterRefuel(): number {
    const currentFuel = this.fuelStatus?.fuelLevel || 0;
    return Math.min(100, currentFuel + this.refuelAmount);
  }

  /**
   * Refuel the vehicle - add fuel amount
   */
  refuelVehicle(): void {
    if (!this.vehicle) return;
    
    this.refueling = true;
    this.refuelError = null;

    // Update vehicle fuel level
    const newFuelLevel = Math.min(100, (this.vehicle.fuelLevel || 0) + this.refuelAmount);
    const updatedVehicle = { ...this.vehicle, fuelLevel: newFuelLevel };

    this.vehicleService.update(this.vehicle.id, updatedVehicle).subscribe({
      next: () => {
        this.vehicle = updatedVehicle;
        this.refueling = false;
        this.showRefuelModal = false;
        this.loadFuelStatus(); // Reload fuel status card
        console.log(`[VehicleDetailComponent] Vehicle refueled: ${newFuelLevel}%`);
      },
      error: (error) => {
        console.error('[VehicleDetailComponent] Refuel failed', error);
        this.refuelError = 'Impossible de recharger le véhicule.';
        this.refueling = false;
      }
    });
  }
}
