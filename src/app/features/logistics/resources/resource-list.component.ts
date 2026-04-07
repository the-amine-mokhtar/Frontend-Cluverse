import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Resource, ResourceStatus } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { RESOURCE_STATUS_LABELS, getStatusBadgeClasses } from '../utils/status-labels';

@Component({
  selector: 'app-resource-list',
  templateUrl: './resource-list.component.html'
})
export class ResourceListComponent implements OnInit {
  loading = false;
  errorMessage: string | null = null;

  clubId = 0;

  resources: Resource[] = [];
  filteredResources: Resource[] = [];

  pageSize = 6;
  currentPage = 1;
  totalPages = 1;
  pagedResources: Resource[] = [];
  pageStart = 0;
  pageEnd = 0;

  searchText = '';
  statusFilter: 'ALL' | ResourceStatus = 'ALL';

  readonly statusLabels = RESOURCE_STATUS_LABELS;
  readonly getStatusBadgeClasses = getStatusBadgeClasses;
  readonly statusOptions: ResourceStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];

  constructor(
    private resourceService: ResourceService,
    private location: Location
  ) {}

  ngOnInit(): void {
    const storedClubId = Number(localStorage.getItem('clubId') ?? 0);
    this.clubId = Number.isFinite(storedClubId) ? storedClubId : 0;

    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;

    this.resourceService.getAll(this.clubId).subscribe({
      next: (items) => {
        this.resources = items;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('[ResourceListComponent] load failed', error);
        this.errorMessage = 'Impossible de charger les ressources.';
        this.resources = [];
        this.filteredResources = [];
        this.pagedResources = [];
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
    const status = this.statusFilter;

    this.filteredResources = this.resources.filter((r) => {
      const matchesName = !query || (r.name ?? '').toLowerCase().includes(query);
      const matchesStatus = status === 'ALL' || r.status === status;
      return matchesName && matchesStatus;
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

    // Match common UX: 1 2 3 4 ... N  OR  1 ... (c-1) c (c+1) ... N  OR  1 ... (N-3) (N-2) (N-1) N
    if (current <= 3) {
      return [1, 2, 3, 4, '...', total];
    }

    if (current >= total - 2) {
      return [1, '...', total - 3, total - 2, total - 1, total];
    }

    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  private applyPagination(): void {
    const total = this.filteredResources.length;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.pagedResources = this.filteredResources.slice(startIndex, startIndex + this.pageSize);

    if (total === 0) {
      this.pageStart = 0;
      this.pageEnd = 0;
      return;
    }

    this.pageStart = startIndex + 1;
    this.pageEnd = Math.min(startIndex + this.pageSize, total);
  }

  isLowStock(resource: Resource): boolean {
    return Number(resource.availableQuantity) <= Number(resource.lowStockThreshold);
  }

  getInitials(name: string): string {
    const cleaned = (name ?? '').trim();
    if (!cleaned) {
      return '?';
    }

    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1]?.[0] ?? '' : (parts[0]?.[1] ?? '');
    return (first + second).toUpperCase();
  }

  unitCostValue(resource: Resource): number | null {
    const raw: any = resource as any;
    const value = raw?.unitCost ?? raw?.unit_cost ?? raw?.unitcost;
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
      const n = Number(normalized);
      return Number.isFinite(n) ? n : null;
    }

    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  unitCostText(resource: Resource): string {
    const raw: any = resource as any;
    const value = raw?.unitCost ?? raw?.unit_cost ?? raw?.unitcost;
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    const n = this.unitCostValue(resource);
    if (n === null) {
      return String(value);
    }

    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  delete(resource: Resource): void {
    const ok = confirm(`Supprimer la ressource "${resource.name}" ?`);
    if (!ok) {
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.resourceService.delete(resource.id).subscribe({
      next: () => {
        this.load();
      },
      error: (error) => {
        console.error('[ResourceListComponent] delete failed', error);
        this.errorMessage = 'Impossible de supprimer la ressource.';
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.location.back();
  }
}
