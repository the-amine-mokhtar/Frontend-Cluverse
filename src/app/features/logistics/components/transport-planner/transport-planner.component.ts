import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TransportPlannerService } from '../../services/transport-planner.service';
import { TransportPlannerResponse, TransportSuggestion } from '../../models/transport-planner.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-transport-planner',
  templateUrl: './transport-planner.component.html',
  styleUrls: ['./transport-planner.component.scss']
})
export class TransportPlannerComponent implements OnInit, OnDestroy {
  startDate: string;
  endDate: string;
  plan: TransportPlannerResponse | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  private routeSubscription?: Subscription;

  constructor(
    private plannerService: TransportPlannerService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    const today = this.getDateString(new Date());
    this.startDate = today;
    this.endDate = this.getDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      if (params.get('autoGenerate') === '1') {
        this.generatePlan();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  private getDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  generatePlan(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    this.isLoading = true;
    this.plan = null;
    this.errorMessage = null;

    console.log('🔄 Generating plan for', this.startDate, 'to', this.endDate);
    this.plannerService.getPlan(this.startDate, this.endDate)
      .subscribe({
        next: (result) => {
          console.log('✅ Plan received:', result);
          this.plan = result;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('❌ Component error:', err);
          const status = err.status || 'unknown';
          const statusText = `${status}`;
          this.errorMessage = 
            `Erreur ${statusText} — Impossible de générer le plan. ` +
            `Vérifiez que le backend est en cours d'exécution sur le port 8081. ` +
            `Vérifiez la console (F12) pour plus de détails.`;
          this.isLoading = false;
        },
        complete: () => {
          console.log('✓ Observable completed');
        }
      });
  }

  getRiskBadgeClass(riskLevel: string): string {
    switch (riskLevel) {
      case 'LOW':
        return 'bg-green-100 text-green-700';
      case 'MEDIUM':
        return 'bg-orange-100 text-orange-700';
      case 'HIGH':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  getRiskIcon(riskLevel: string): string {
    switch (riskLevel) {
      case 'LOW':
        return '🟢';
      case 'MEDIUM':
        return '🟠';
      case 'HIGH':
        return '🔴';
      default:
        return '⚪';
    }
  }

  navigateToCreateTransport(suggestion: TransportSuggestion): void {
    this.router.navigate(['/logistics/transports/new'], {
      queryParams: {
        vehicleId: suggestion.vehicleId,
        scheduledDate: suggestion.suggestedDate
      }
    });
  }
}
