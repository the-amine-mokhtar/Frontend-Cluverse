import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { LogisticsApiService, ReservationItem } from '../../services/logistics-api.service';

type RequestStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED';

type LogisticsRequest = {
  id: number;
  title: string;
  category: string;
  quantity: number;
  neededBy: string;
  status: RequestStatus;
};

@Component({
  selector: 'app-logistics-requests',
  templateUrl: './logistics-requests.component.html',
  styleUrls: ['./logistics-requests.component.scss']
})
export class LogisticsRequestsComponent {
  isLoading = true;
  hasError = false;

  requests: LogisticsRequest[] = [];

  constructor(
    private router: Router,
    private location: Location,
    private logisticsApi: LogisticsApiService
  ) {
    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoading = true;
    this.hasError = false;
    this.logisticsApi.getReservations().subscribe({
      next: (items) => {
        this.requests = items.map((r: ReservationItem) => ({
          id: r.id,
          title: r.notes || `Demande #${r.id}`,
          category: 'Reservation',
          quantity: r.quantityReserved,
          neededBy: this.toDate(r.startDate),
          status: r.status
        }));
      },
      error: () => {
        this.hasError = true;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  private toDate(value: string): string {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
  }

  goToNew(): void {
    void this.router.navigateByUrl('/dashboard/logistics/requests/new');
  }

  backToHome(): void {
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

