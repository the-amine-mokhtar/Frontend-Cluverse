import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { defaultIfEmpty } from 'rxjs/operators';

import { Transport, TransportStatus } from '../models/transport.model';
import { TransportService } from '../services/transport.service';
import { EventItem, LocationItem, LogisticsApiService, UserItem, VehicleItem } from '../services/logistics-api.service';
import { TRANSPORT_STATUS_LABELS, getStatusBadgeClasses } from '../utils/status-labels';

@Component({
  selector: 'app-transport-list',
  templateUrl: './transport-list.component.html'
})
export class TransportListComponent implements OnInit {
  loading = false;
  errorMessage: string | null = null;

  transports: Transport[] = [];

  users: UserItem[] = [];
  vehicles: VehicleItem[] = [];
  events: EventItem[] = [];
  locations: LocationItem[] = [];

  upcomingTransports: Transport[] = [];
  historyTransports: Transport[] = [];

  filteredUpcoming: Transport[] = [];
  filteredHistory: Transport[] = [];

  pageSize = 4;

  upcomingPage = 1;
  upcomingTotalPages = 1;
  pagedUpcoming: Transport[] = [];
  upcomingPageStart = 0;
  upcomingPageEnd = 0;

  historyPage = 1;
  historyTotalPages = 1;
  pagedHistory: Transport[] = [];
  historyPageStart = 0;
  historyPageEnd = 0;

  searchText = '';
  activeTab: 'UPCOMING' | 'HISTORY' = 'UPCOMING';

  readonly statusLabels = TRANSPORT_STATUS_LABELS;
  readonly getStatusBadgeClasses = getStatusBadgeClasses;

  private readonly upcomingStatuses: TransportStatus[] = ['PLANNED', 'IN_PROGRESS'];
  private readonly historyStatuses: TransportStatus[] = ['COMPLETED', 'CANCELED'];

  constructor(
    private transportService: TransportService,
    private logisticsApi: LogisticsApiService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      transports: this.transportService.getAll().pipe(defaultIfEmpty([] as Transport[])),
      users: this.logisticsApi.getUsers().pipe(defaultIfEmpty([] as UserItem[])),
      vehicles: this.logisticsApi.getVehicles().pipe(defaultIfEmpty([] as VehicleItem[])),
      events: this.logisticsApi.getEvents().pipe(defaultIfEmpty([] as EventItem[])),
      locations: this.logisticsApi.getLocations().pipe(defaultIfEmpty([] as LocationItem[]))
    }).subscribe({
      next: ({ transports, users, vehicles, events, locations }) => {
        this.transports = Array.isArray(transports) ? transports : [];
        this.users = Array.isArray(users) ? users : [];
        this.vehicles = Array.isArray(vehicles) ? vehicles : [];
        this.events = Array.isArray(events) ? events : [];
        this.locations = Array.isArray(locations) ? locations : [];
        this.computeBuckets();
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('[TransportListComponent] load failed', error);
        this.errorMessage = 'Impossible de charger les transports.';
        this.transports = [];
        this.users = [];
        this.vehicles = [];
        this.events = [];
        this.locations = [];
        this.upcomingTransports = [];
        this.historyTransports = [];
        this.filteredUpcoming = [];
        this.filteredHistory = [];
        this.loading = false;
      }
    });
  }

  setTab(tab: 'UPCOMING' | 'HISTORY'): void {
    this.activeTab = tab;
    this.applyFilters();
  }

  applyFilters(): void {
    const query = this.searchText.trim();

    const matchesQuery = (t: Transport): boolean => {
      if (!query) {
        return true;
      }

      const q = query.toLowerCase();
      const vehicleText = this.vehicleText(t.vehicleId).toLowerCase();
      const userText = this.userText(t.userId).toLowerCase();
      const eventText = this.eventText(t.eventId).toLowerCase();
      const routeText = `${this.locationText(t.departureLocationId)} ${this.locationText(t.arrivalLocationId)}`.toLowerCase();
      return vehicleText.includes(q) || userText.includes(q) || eventText.includes(q) || routeText.includes(q);
    };

    this.filteredUpcoming = this.upcomingTransports.filter(matchesQuery);
    this.filteredHistory = this.historyTransports.filter(matchesQuery);

    this.upcomingPage = 1;
    this.historyPage = 1;
    this.applyPagination();
  }

  setUpcomingPage(page: number): void {
    if (!Number.isFinite(page)) {
      return;
    }

    const safePage = Math.max(1, Math.min(Math.trunc(page), this.upcomingTotalPages));
    if (safePage === this.upcomingPage) {
      return;
    }

    this.upcomingPage = safePage;
    this.applyPagination();
  }

  prevUpcomingPage(): void {
    this.setUpcomingPage(this.upcomingPage - 1);
  }

  nextUpcomingPage(): void {
    this.setUpcomingPage(this.upcomingPage + 1);
  }

  setHistoryPage(page: number): void {
    if (!Number.isFinite(page)) {
      return;
    }

    const safePage = Math.max(1, Math.min(Math.trunc(page), this.historyTotalPages));
    if (safePage === this.historyPage) {
      return;
    }

    this.historyPage = safePage;
    this.applyPagination();
  }

  prevHistoryPage(): void {
    this.setHistoryPage(this.historyPage - 1);
  }

  nextHistoryPage(): void {
    this.setHistoryPage(this.historyPage + 1);
  }

  get upcomingPaginationItems(): Array<number | '...'> {
    return this.buildPaginationItems(this.upcomingTotalPages, this.upcomingPage);
  }

  get historyPaginationItems(): Array<number | '...'> {
    return this.buildPaginationItems(this.historyTotalPages, this.historyPage);
  }

  private computeBuckets(): void {
    const all = Array.isArray(this.transports) ? [...this.transports] : [];
    const now = new Date().getTime();

    this.upcomingTransports = all
      .filter((t) => {
        if (this.historyStatuses.includes(t.status)) {
          return false;
        }
        // Si statut PLANNED et date passée, c'est de l'historique
        if (t.status === 'PLANNED' && this.toTime(t.scheduledDate) < now) {
          return false;
        }
        return this.upcomingStatuses.includes(t.status);
      })
      .sort((a, b) => this.toTime(a.scheduledDate) - this.toTime(b.scheduledDate));

    this.historyTransports = all
      .filter((t) => {
        if (this.historyStatuses.includes(t.status)) {
          return true;
        }
        // Si statut PLANNED et date passée, c'est de l'historique
        if (t.status === 'PLANNED' && this.toTime(t.scheduledDate) < now) {
          return true;
        }
        return false;
      })
      .sort((a, b) => this.toTime(b.scheduledDate) - this.toTime(a.scheduledDate));
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

  private buildPaginationItems(totalPages: number, currentPage: number): Array<number | '...'> {
    const total = totalPages;
    const current = currentPage;

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
    // Upcoming
    const upcomingTotal = this.filteredUpcoming.length;
    this.upcomingTotalPages = Math.max(1, Math.ceil(upcomingTotal / this.pageSize));
    if (this.upcomingPage > this.upcomingTotalPages) {
      this.upcomingPage = this.upcomingTotalPages;
    }

    const upcomingStartIndex = (this.upcomingPage - 1) * this.pageSize;
    this.pagedUpcoming = this.filteredUpcoming.slice(upcomingStartIndex, upcomingStartIndex + this.pageSize);

    if (upcomingTotal === 0) {
      this.upcomingPageStart = 0;
      this.upcomingPageEnd = 0;
    } else {
      this.upcomingPageStart = upcomingStartIndex + 1;
      this.upcomingPageEnd = Math.min(upcomingStartIndex + this.pageSize, upcomingTotal);
    }

    // History
    const historyTotal = this.filteredHistory.length;
    this.historyTotalPages = Math.max(1, Math.ceil(historyTotal / this.pageSize));
    if (this.historyPage > this.historyTotalPages) {
      this.historyPage = this.historyTotalPages;
    }

    const historyStartIndex = (this.historyPage - 1) * this.pageSize;
    this.pagedHistory = this.filteredHistory.slice(historyStartIndex, historyStartIndex + this.pageSize);

    if (historyTotal === 0) {
      this.historyPageStart = 0;
      this.historyPageEnd = 0;
    } else {
      this.historyPageStart = historyStartIndex + 1;
      this.historyPageEnd = Math.min(historyStartIndex + this.pageSize, historyTotal);
    }
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

  goBack(): void {
    this.location.back();
  }
}
