import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription, catchError, of, startWith, switchMap } from 'rxjs';
import {
  FraudAlert,
  FraudAlertStats,
  FraudDetectionService,
  FraudSeverity
} from '../../services/fraud-detection.service';

type SeverityFilter = 'all' | FraudSeverity;
type StatusFilter   = 'active' | 'dismissed' | 'all';

@Component({
  selector: 'app-finance-alerts',
  templateUrl: './finance-alerts.component.html',
  styleUrl: './finance-alerts.component.scss'
})
export class FinanceAlertsComponent implements OnInit, OnDestroy {
  alerts:   FraudAlert[]      = [];
  stats:    FraudAlertStats | null = null;
  isLoading = true;
  errorMessage = '';

  severityFilter: SeverityFilter = 'all';
  statusFilter:   StatusFilter   = 'active';
  searchTerm = '';
  page       = 0;
  readonly pageSize = 10;

  // Simulate panel
  showSimulate  = false;
  simAmount     = 500000;
  simStatus     = 'succeeded';
  simCustomer   = '';
  simDescription = 'Test transaction';
  simScenario   = 'normal';
  simResult: string | null = null;
  isSimulating  = false;

  readonly SCENARIOS: { value: string; label: string }[] = [
    { value: 'normal',                label: 'Normal transaction' },
    { value: 'blocked',               label: 'Always blocked (4100 0000 0000 0019)' },
    { value: 'highest_risk',          label: 'Highest risk — Radar (4000 0000 0000 4954)' },
    { value: 'elevated_risk',         label: 'Elevated risk — Radar (4000 0000 0000 9235)' },
    { value: 'manual_review',         label: 'Queued for manual review (dispute score card)' },
    { value: 'cvc_fail',              label: 'CVC check fails (4000 0000 0000 0101)' },
    { value: 'postal_fail',           label: 'Postal code check fails (4000 0000 0000 0036)' },
    { value: 'address_fail',          label: 'Address line 1 check fails (4000 0000 0000 0028)' },
    { value: 'cvc_postal_elevated',   label: 'CVC + postal fail + elevated (4000 0584 0030 7872)' },
    { value: 'early_fraud_warning',   label: 'Early fraud warning (radar.early_fraud_warning)' },
    { value: 'dispute',               label: 'Charge disputed (charge.dispute.created)' },
  ];

  private buildScenarioOverrides() {
    switch (this.simScenario) {
      case 'blocked':
        return { stripeOutcomeType: 'blocked' } as const;
      case 'highest_risk':
        return { stripeRiskLevel: 'highest', stripeRiskScore: 85 } as const;
      case 'elevated_risk':
        return { stripeRiskLevel: 'elevated', stripeRiskScore: 65 } as const;
      case 'manual_review':
        return { stripeOutcomeType: 'manual_review', stripeRiskLevel: 'elevated' } as const;
      case 'cvc_fail':
        return { cvcCheck: 'fail' } as const;
      case 'postal_fail':
        return { postalCheck: 'fail' } as const;
      case 'address_fail':
        return { addressCheck: 'fail' } as const;
      case 'cvc_postal_elevated':
        return { cvcCheck: 'fail', postalCheck: 'fail', stripeRiskLevel: 'elevated' } as const;
      case 'early_fraud_warning':
        return { isEarlyFraudWarning: true, fraudType: 'card_not_present_fraud' } as const;
      case 'dispute':
        return { isDispute: true, disputeReason: 'fraudulent' } as const;
      default:
        return {};
    }
  }

  dismissingId: number | null = null;

  private pollSub: Subscription | null = null;
  private statsSub: Subscription | null = null;

  constructor(private readonly fraudService: FraudDetectionService) {}

  ngOnInit(): void {
    // Poll alerts every 15 s
    this.pollSub = interval(15_000).pipe(
      startWith(0),
      switchMap(() => {
        const dismissed = this.statusFilter === 'dismissed' ? true
                        : this.statusFilter === 'active'    ? false
                        : undefined;
        return this.fraudService.getAlerts({ dismissed, limit: 200 }).pipe(
          catchError(() => of({ alerts: [] as FraudAlert[] }))
        );
      })
    ).subscribe(({ alerts }) => {
      this.alerts    = alerts;
      this.isLoading = false;
    });

    // Poll stats every 15 s
    this.statsSub = interval(15_000).pipe(
      startWith(0),
      switchMap(() => this.fraudService.getStats().pipe(catchError(() => of(null))))
    ).subscribe(stats => { this.stats = stats; });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.statsSub?.unsubscribe();
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  get filteredAlerts(): FraudAlert[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.alerts.filter(a => {
      if (this.severityFilter !== 'all' && a.severity !== this.severityFilter) return false;

      if (!term) return true;
      return (
        a.transactionId.toLowerCase().includes(term) ||
        (a.description || '').toLowerCase().includes(term) ||
        (a.customerId   || '').toLowerCase().includes(term) ||
        a.reasons.some(r => r.toLowerCase().includes(term))
      );
    });
  }

  get pagedAlerts(): FraudAlert[] {
    const start = this.page * this.pageSize;
    return this.filteredAlerts.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredAlerts.length / this.pageSize));
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  onStatusFilterChange(): void {
    this.page = 0;
    this.reloadAlerts();
  }

  onSeverityFilterChange(): void { this.page = 0; }

  reloadAlerts(): void {
    this.isLoading = true;
    const dismissed = this.statusFilter === 'dismissed' ? true
                    : this.statusFilter === 'active'    ? false
                    : undefined;
    this.fraudService.getAlerts({ dismissed, limit: 200 }).pipe(
      catchError(() => of({ alerts: [] as FraudAlert[] }))
    ).subscribe(({ alerts }) => {
      this.alerts    = alerts;
      this.isLoading = false;
    });
  }

  dismiss(alert: FraudAlert): void {
    this.dismissingId = alert.internalId;
    this.fraudService.dismissAlert(alert.internalId).subscribe({
      next: () => {
        alert.dismissed   = true;
        alert.dismissedAt = new Date().toISOString();
        this.dismissingId = null;
        if (this.statusFilter === 'active') {
          this.alerts = this.alerts.filter(a => a.internalId !== alert.internalId);
        }
        this.fraudService.getStats().subscribe(s => { this.stats = s; });
      },
      error: () => { this.dismissingId = null; }
    });
  }

  runSimulation(): void {
    this.isSimulating = true;
    this.simResult    = null;
    this.fraudService.simulateTransaction({
      amount:      this.simAmount,
      status:      this.simStatus,
      customer:    this.simCustomer || undefined,
      description: this.simDescription,
      ...this.buildScenarioOverrides(),
    }).subscribe({
      next: ({ alert, stored }) => {
        this.isSimulating = false;
        this.simResult = stored
          ? `Flagged — Risk score: ${alert.riskScore}/100 (${alert.severity}). Reasons: ${alert.reasons.join(', ')}`
          : `Below threshold — Risk score: ${alert.riskScore}/100 (${alert.severity}). Not stored.`;
        if (stored) this.reloadAlerts();
      },
      error: () => {
        this.isSimulating = false;
        this.simResult = 'Error: fraud service offline. Run: cd stripe-fraud-detection-service && npm start';
      }
    });
  }

  prevPage(): void { if (this.page > 0) this.page--; }
  nextPage(): void { if (this.page < this.totalPages - 1) this.page++; }

  severityClass(severity: FraudSeverity): string {
    return `badge badge--${severity}`;
  }

  scoreBarClass(score: number): string {
    if (score >= 80) return 'score-bar__fill--critical';
    if (score >= 60) return 'score-bar__fill--high';
    if (score >= 35) return 'score-bar__fill--medium';
    return 'score-bar__fill--low';
  }

  formatAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
