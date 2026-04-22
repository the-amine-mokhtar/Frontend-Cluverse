import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LogisticsApiService, ReservationItem, ResourceItem, TransportItem, VehicleItem } from '../../services/logistics-api.service';

type LogisticsKpi = {
  label: string;
  value: string;
  hint?: string;
};

type LogisticsQuickAction = {
  title: string;
  description: string;
  cta: string;
  icon: 'request' | 'truck' | 'box' | 'vehicle';
  disabled?: boolean;
};

type LogisticsRow = {
  id: number;
  title: string;
  meta: string;
  status: string;
};

@Component({
  selector: 'app-logistics-home',
  templateUrl: './logistics-home.component.html',
  styleUrls: ['./logistics-home.component.scss']
})
export class LogisticsHomeComponent {
  isLoading = true;
  warnings: string[] = [];

  constructor(
    private router: Router,
    private logisticsApi: LogisticsApiService
  ) {
    this.loadData();
  }

  kpis: LogisticsKpi[] = [
    { label: 'Demandes ouvertes', value: '0', hint: 'À traiter' },
    { label: 'Livraisons', value: '0', hint: 'Planifiées' },
    { label: 'Articles en stock', value: '0', hint: 'Inventaire' },
    { label: 'Véhicules', value: '0', hint: 'Disponibles' }
  ];

  readonly quickActions: LogisticsQuickAction[] = [
    {
      title: 'Créer une demande',
      description: 'Besoin de matériel pour un événement ? Soumets une demande.',
      cta: 'Nouvelle demande',
      icon: 'request'
    },
    {
      title: 'Planifier une livraison',
      description: 'Organise la récupération / livraison et assigne un responsable.',
      cta: 'Planifier',
      icon: 'truck'
    },
    {
      title: 'Gérer l’inventaire',
      description: 'Entrées/sorties, seuils bas, suivi par catégorie.',
      cta: 'Ouvrir inventaire',
      icon: 'box'
    },
    {
      title: 'Véhicules',
      description: 'Disponibilité des véhicules de transport.',
      cta: 'Voir véhicules',
      icon: 'vehicle'
    }
  ];

  recentRequests: LogisticsRow[] = [];

  upcomingDeliveries: LogisticsRow[] = [];

  trackById(_: number, item: LogisticsRow): string {
    return String(item.id);
  }

  private loadData(): void {
    this.isLoading = true;
    this.warnings = [];

    forkJoin({
      reservations: this.logisticsApi.getReservations().pipe(
        map((data) => ({ data, hasError: false })),
        catchError(() => of({ data: [] as ReservationItem[], hasError: true }))
      ),
      transports: this.logisticsApi.getTransports().pipe(
        map((data) => ({ data, hasError: false })),
        catchError(() => of({ data: [] as TransportItem[], hasError: true }))
      ),
      resources: this.logisticsApi.getResources().pipe(
        map((data) => ({ data, hasError: false })),
        catchError(() => of({ data: [] as ResourceItem[], hasError: true }))
      ),
      vehicles: this.logisticsApi.getVehicles().pipe(
        map((data) => ({ data, hasError: false })),
        catchError(() => of({ data: [] as VehicleItem[], hasError: true }))
      )
    }).subscribe({
      next: ({ reservations, transports, resources, vehicles }) => {
        this.applyReservations(reservations.data);
        this.applyTransports(transports.data);
        this.applyResources(resources.data);
        this.applyVehicles(vehicles.data);

        if (reservations.hasError) {
          this.kpis[0].value = '-';
          this.warnings.push('Le backend des reservations est indisponible.');
        }
        if (transports.hasError) {
          this.kpis[1].value = '-';
          this.warnings.push('Le backend des transports est en erreur (HTTP 400).');
        }
        if (resources.hasError) {
          this.kpis[2].value = '-';
          this.warnings.push('Le backend des ressources est indisponible.');
        }
        if (vehicles.hasError) {
          this.kpis[3].value = '-';
          this.warnings.push('Le backend des vehicules est indisponible.');
        }
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  private applyReservations(reservations: ReservationItem[]): void {
    const open = reservations.filter(r => r.status === 'PENDING' || r.status === 'CONFIRMED').length;
    this.kpis[0].value = String(open);
    this.recentRequests = reservations.slice(0, 5).map(r => ({
      id: r.id,
      title: r.notes || `Demande #${r.id}`,
      meta: `${r.quantityReserved} unités • ${this.formatDate(r.startDate)}`,
      status: r.status
    }));
  }

  private applyTransports(transports: TransportItem[]): void {
    this.kpis[1].value = String(transports.length);
    this.upcomingDeliveries = transports.slice(0, 5).map(t => ({
      id: t.id,
      title: `Transport #${t.id}`,
      meta: this.formatDate(t.scheduledDate),
      status: t.status
    }));
  }

  private applyResources(resources: ResourceItem[]): void {
    const totalAvailable = resources.reduce((sum, r) => sum + (r.availableQuantity || 0), 0);
    this.kpis[2].value = String(totalAvailable);
  }

  private applyVehicles(vehicles: VehicleItem[]): void {
    const available = vehicles.filter(v => v.available).length;
    this.kpis[3].value = String(available);
  }

  private formatDate(value: string): string {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  goToRequests(): void {
    void this.router.navigateByUrl('/dashboard/logistics/requests');
  }

  goToManageRequest(): void {
    void this.router.navigateByUrl('/dashboard/logistics/requests/new');
  }

  goToNewRequest(): void {
    void this.router.navigateByUrl('/dashboard/logistics/requests/new');
  }

  goToDeliveries(): void {
    void this.router.navigateByUrl('/dashboard/logistics/deliveries');
  }

  goToInventory(): void {
    void this.router.navigateByUrl('/dashboard/logistics/inventory');
  }

  goToVehicles(): void {
    void this.router.navigateByUrl('/dashboard/logistics/vehicles');
  }
}
