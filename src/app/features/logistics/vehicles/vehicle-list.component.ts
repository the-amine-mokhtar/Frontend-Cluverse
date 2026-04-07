import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Vehicle } from '../models/vehicle.model';
import { VehicleService } from '../services/vehicle.service';

@Component({
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html'
})
export class VehicleListComponent implements OnInit {
  loading = false;
  errorMessage: string | null = null;

  vehicles: Vehicle[] = [];
  filteredVehicles: Vehicle[] = [];

  pageSize = 6;
  currentPage = 1;
  totalPages = 1;
  pagedVehicles: Vehicle[] = [];
  pageStart = 0;
  pageEnd = 0;

  searchText = '';
  availabilityFilter: 'ALL' | 'AVAILABLE' | 'UNAVAILABLE' = 'ALL';

  constructor(
    private vehicleService: VehicleService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;

    this.vehicleService.getAll().subscribe({
      next: (items) => {
        this.vehicles = items;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('[VehicleListComponent] load failed', error);
        this.errorMessage = 'Impossible de charger les véhicules.';
        this.vehicles = [];
        this.filteredVehicles = [];
        this.pagedVehicles = [];
        this.totalPages = 1;
        this.currentPage = 1;
        this.pageStart = 0;
        this.pageEnd = 0;
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    const query = this.searchText.trim().toLowerCase();
    const availability = this.availabilityFilter;

    this.filteredVehicles = this.vehicles.filter((v) => {
      const model = (v.model ?? '').toLowerCase();
      const plate = (v.plateNumber ?? '').toLowerCase();
      const matchesQuery = !query || model.includes(query) || plate.includes(query);

      const matchesAvailability =
        availability === 'ALL' ||
        (availability === 'AVAILABLE' ? Boolean(v.available) === true : Boolean(v.available) === false);

      return matchesQuery && matchesAvailability;
    });

    this.currentPage = 1;
    this.applyPagination();
  }

  setPage(page: number): void {
    if (!Number.isFinite(page)) {
      return;
    }

    const safePage = Math.max(1, Math.min(Math.trunc(page), this.totalPages));
    if (safePage === this.currentPage) {
      return;
    }

    this.currentPage = safePage;
    this.applyPagination();
  }

  prevPage(): void {
    this.setPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.setPage(this.currentPage + 1);
  }

  get paginationItems(): Array<number | '...'> {
    const total = this.totalPages;
    const current = this.currentPage;

    if (!Number.isFinite(total) || total <= 1) {
      return [1];
    }

    if (total <= 6) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    if (current <= 3) {
      return [1, 2, 3, 4, '...', total];
    }

    if (current >= total - 2) {
      return [1, '...', total - 3, total - 2, total - 1, total];
    }

    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  private applyPagination(): void {
    const total = this.filteredVehicles.length;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.pagedVehicles = this.filteredVehicles.slice(startIndex, startIndex + this.pageSize);

    if (total === 0) {
      this.pageStart = 0;
      this.pageEnd = 0;
      return;
    }

    this.pageStart = startIndex + 1;
    this.pageEnd = Math.min(startIndex + this.pageSize, total);
  }

  resetFilters(): void {
    this.searchText = '';
    this.availabilityFilter = 'ALL';
    this.applyFilters();
  }

  delete(vehicle: Vehicle): void {
    const ok = confirm(`Supprimer le véhicule "${vehicle.model}" ?`);
    if (!ok) {
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    let didEmit = false;

    this.vehicleService.delete(vehicle.id).subscribe({
      next: () => {
        didEmit = true;
        this.load();
      },
      error: (error) => {
        didEmit = true;
        console.error('[VehicleListComponent] delete failed', error);
        this.errorMessage = 'Impossible de supprimer le véhicule.';
        this.loading = false;
      },
      complete: () => {
        // VehicleService returns EMPTY on error; detect completion-without-next.
        if (!didEmit) {
          this.errorMessage = 'Impossible de supprimer le véhicule.';
          this.loading = false;
        }
      }
    });
  }

  goBack(): void {
    this.location.back();
  }
}
