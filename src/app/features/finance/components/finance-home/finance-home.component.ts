import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ChartData, ChartOptions } from 'chart.js';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { ApiService } from '../../../../core/services/api.service';
import {
  AiCashFlowForecastResult,
  AiCashFlowProjection,
  BudgetAlertEmailPayload,
  BudgetDto,
  FinanceService,
  ForecastHorizon,
  SponsorDto,
  SponsorshipDto,
  TransactionDto
} from '../../../../core/services/finance.service';
import { FraudAlert, FraudDetectionService, FraudSeverity } from '../../services/fraud-detection.service';

interface BudgetItem {
  title: string;
  department: string;
  spent: number;
  total: number;
}

type AlertLevel = 'warning' | 'critical' | 'limit';

interface BudgetUtilizationAlert {
  title: string;
  department: string;
  utilization: number;
  reachedThreshold: 70 | 90 | 100;
  level: AlertLevel;
}

type TransactionType = 'income' | 'expense';
type TransactionFilter = 'all' | TransactionType;
type BudgetFilter = 'all' | 'healthy' | 'warning' | 'critical';

interface TransactionItem {
  type: TransactionType;
  description: string;
  category: string;
  date: string;
  addedBy: string;
  amount: number;
}

interface MonthlyTrendRow {
  monthLabel: string;
  income: number;
  expense: number;
  net: number;
}

interface InvoiceLine {
  description: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

@Component({
  selector: 'app-finance-home',
  templateUrl: './finance-home.component.html',
  styleUrl: './finance-home.component.scss'
})
export class FinanceHomeComponent implements OnInit {
  private allBudgets: BudgetDto[] = [];
  private allTransactions: TransactionDto[] = [];
  private allSponsors: SponsorDto[] = [];
  private allSponsorships: SponsorshipDto[] = [];

  budgetItems: BudgetItem[] = [];
  recentTransactions: TransactionItem[] = [];
  selectedExerciseYear = new Date().getFullYear();
  declaredBankBalance: number | null = null;
  readonly forecastMonths = 3;
  reportTitle = 'Rapport Financier Personnalise';
  clubName = 'Cluverse Club';
  clubLogoUrl = '';
  brandPrimaryColor = '#1d4ed8';
  brandAccentColor = '#0f172a';
  showBrandingPanel = false;
  showInvoicePanel = false;
  selectedSponsorId: number | null = null;
  invoiceNumber = this.generateInvoiceNumber();
  invoiceIssueDate = this.toDateInputValue(new Date());
  invoiceDueDate = this.toDateInputValue(this.addDays(new Date(), 30));
  invoiceVatRate = 20;
  invoiceDiscount = 0;
  invoiceTitle = 'FACTURE';
  budgetSearchTerm = '';
  budgetFilter: BudgetFilter = 'all';
  transactionSearchTerm = '';
  transactionFilter: TransactionFilter = 'all';
  showBudgetAlertPopup = false;
  selectedForecastHorizon: ForecastHorizon = 3;
  aiForecast: AiCashFlowForecastResult | null = null;
  isLoading = false;
  errorMessage = '';
  private dismissedBudgetAlertKeys = new Set<string>();
  emailAlertsEnabled = true;
  budgetAlertEmailStatus = '';
  budgetAlertEmailStatusTone: 'info' | 'success' | 'error' = 'info';
  isSendingBudgetAlertEmail = false;
  private readonly alertEmailPreferenceStorageKey = 'finance.budgetAlert.emailPreference';
  private readonly emailedAlertDeliveryStorageKey = 'finance.budgetAlert.emailDeliveryKeys';
  private emailedBudgetAlertDeliveryKeys = new Set<string>();
  statsView: 'kpi' | 'pie' = 'kpi';

  readonly pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', font: { size: 12, family: 'inherit' }, padding: 20 }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${this.formatCurrency(ctx.raw as number)}`
        }
      }
    }
  };

  trendPage = 0;
  readonly trendPageSize = 4;
  budgetPage = 0;
  readonly budgetPageSize = 3;
  transactionPage = 0;
  readonly transactionPageSize = 5;

  fraudAlerts: FraudAlert[] = [];
  fraudAlertsLoading = false;
  dismissingFraudId: number | null = null;

  constructor(
    private readonly financeService: FinanceService,
    private readonly authHelperService: AuthHelperService,
    private readonly apiService: ApiService,
    private readonly fraudService: FraudDetectionService
  ) {}

  ngOnInit(): void {
    this.initializeBudgetAlertEmailSettings();
    this.loadEmailedBudgetAlertDeliveryKeys();
    this.loadDashboardData();
    this.loadFraudAlerts();
  }

  get totalBudget(): number {
    return this.budgetItems.reduce((sum, item) => sum + item.total, 0);
  }

  get totalSpent(): number {
    // Keep top summary aligned with KPI stats by using realized expense transactions.
    return this.expenseTotal;
  }

  get remainingBudget(): number {
    return this.totalBudget - this.totalSpent;
  }

  get netFlow(): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return this.exerciseTransactions.reduce((sum, transaction) => {
      const transactionDate = new Date(transaction.date);
      if (transactionDate.getMonth() !== currentMonth || transactionDate.getFullYear() !== currentYear) {
        return sum;
      }

      return transaction.type === 'INCOME'
        ? sum + transaction.amount
        : sum - transaction.amount;
    }, 0);
  }

  get absoluteNetFlow(): number {
    return Math.abs(this.netFlow);
  }

  get filteredBudgetItems(): BudgetItem[] {
    const search = this.budgetSearchTerm.trim().toLowerCase();

    return this.budgetItems.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search) ||
        item.department.toLowerCase().includes(search);

      if (!matchesSearch) {
        return false;
      }

      const utilization = this.utilization(item);
      if (this.budgetFilter === 'healthy') {
        return utilization < 70;
      }
      if (this.budgetFilter === 'warning') {
        return utilization >= 70 && utilization <= 90;
      }
      if (this.budgetFilter === 'critical') {
        return utilization > 90;
      }
      return true;
    });
  }

  get budgetUtilizationAlerts(): BudgetUtilizationAlert[] {
    return this.budgetItems
      .map((item) => {
        const utilization = this.utilization(item);
        if (utilization < 70) {
          return null;
        }

        if (utilization >= 100) {
          return {
            title: item.title,
            department: item.department,
            utilization,
            reachedThreshold: 100,
            level: 'limit' as const
          };
        }

        if (utilization >= 90) {
          return {
            title: item.title,
            department: item.department,
            utilization,
            reachedThreshold: 90,
            level: 'critical' as const
          };
        }

        return {
          title: item.title,
          department: item.department,
          utilization,
          reachedThreshold: 70,
          level: 'warning' as const
        };
      })
      .filter((alert): alert is BudgetUtilizationAlert => alert !== null)
      .sort((a, b) => b.utilization - a.utilization);
  }

  get popupBudgetUtilizationAlerts(): BudgetUtilizationAlert[] {
    return this.budgetUtilizationAlerts.filter((alert) => !this.dismissedBudgetAlertKeys.has(this.getAlertKey(alert)));
  }

  get forecastProjections(): AiCashFlowProjection[] {
    return this.aiForecast?.projections ?? [];
  }

  get selectedForecastProjection(): AiCashFlowProjection | null {
    return this.forecastProjections.find((projection) => projection.horizonMonths === this.selectedForecastHorizon) ?? null;
  }

  get filteredRecentTransactions(): TransactionItem[] {
    const search = this.transactionSearchTerm.trim().toLowerCase();

    return this.recentTransactions.filter((transaction) => {
      const matchesType = this.transactionFilter === 'all' || transaction.type === this.transactionFilter;
      if (!matchesType) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        transaction.description,
        transaction.category,
        transaction.date,
        transaction.addedBy,
        String(transaction.amount)
      ].join(' ').toLowerCase().includes(search);
    });
  }

  get availableExerciseYears(): number[] {
    const years = new Set<number>();

    this.allBudgets.forEach((budget) => years.add(this.normalizeYear(budget.year)));
    this.allTransactions.forEach((transaction) => {
      const d = new Date(transaction.date);
      if (!Number.isNaN(d.getTime())) {
        years.add(d.getFullYear());
      }
    });

    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }

  get incomeTotal(): number {
    return this.exerciseTransactions
      .filter((transaction) => transaction.type === 'INCOME')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  get expenseTotal(): number {
    return this.exerciseTransactions
      .filter((transaction) => transaction.type === 'EXPENSE')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  get netResult(): number {
    return this.incomeTotal - this.expenseTotal;
  }

  get openingCash(): number {
    const exerciseStart = new Date(Date.UTC(this.selectedExerciseYear, 0, 1));
    return this.allTransactions.reduce((sum, transaction) => {
      const d = new Date(transaction.date);
      if (Number.isNaN(d.getTime()) || d >= exerciseStart) {
        return sum;
      }

      return transaction.type === 'INCOME'
        ? sum + transaction.amount
        : sum - transaction.amount;
    }, 0);
  }

  get closingCash(): number {
    return this.openingCash + this.netResult;
  }

  get equityTotal(): number {
    return this.allTransactions.reduce((sum, transaction) => {
      return transaction.type === 'INCOME'
        ? sum + transaction.amount
        : sum - transaction.amount;
    }, 0);
  }

  get receivables(): number | null {
    return null;
  }

  get liabilities(): number | null {
    return null;
  }

  get reconciliationGap(): number | null {
    const declared = Number(this.declaredBankBalance);
    if (!Number.isFinite(declared)) {
      return null;
    }
    return declared - this.closingCash;
  }

  get avgMonthlyInflow(): number {
    return this.averageMonthlyAmount('INCOME', 6);
  }

  get avgMonthlyOutflow(): number {
    return this.averageMonthlyAmount('EXPENSE', 6);
  }

  get projectedNetFlow(): number {
    return this.avgMonthlyInflow - this.avgMonthlyOutflow;
  }

  get projectedClosingCash(): number {
    return this.closingCash + this.projectedNetFlow * this.forecastMonths;
  }

  get budgetConsumptionRate(): number {
    if (this.totalBudget <= 0) {
      return 0;
    }
    return (this.expenseTotal / this.totalBudget) * 100;
  }

  get incomeExpenseRatio(): number {
    if (this.expenseTotal <= 0) {
      return this.incomeTotal > 0 ? this.incomeTotal : 0;
    }
    return this.incomeTotal / this.expenseTotal;
  }

  get averageTransactionAmount(): number {
    if (this.exerciseTransactions.length === 0) {
      return 0;
    }
    const total = this.exerciseTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    return total / this.exerciseTransactions.length;
  }

  get largestExpense(): number {
    return this.exerciseTransactions
      .filter((transaction) => transaction.type === 'EXPENSE')
      .reduce((max, transaction) => Math.max(max, transaction.amount), 0);
  }

  get largestIncome(): number {
    return this.exerciseTransactions
      .filter((transaction) => transaction.type === 'INCOME')
      .reduce((max, transaction) => Math.max(max, transaction.amount), 0);
  }

  get monthlyBurnRate(): number {
    return this.averageMonthlyAmount('EXPENSE', 6);
  }

  get runwayMonths(): number {
    if (this.monthlyBurnRate <= 0) {
      return this.closingCash > 0 ? 999 : 0;
    }
    return this.closingCash / this.monthlyBurnRate;
  }

  get savingsRate(): number {
    if (this.incomeTotal <= 0) {
      return 0;
    }
    return (this.netResult / this.incomeTotal) * 100;
  }

  get budgetVariance(): number {
    return this.totalBudget - this.expenseTotal;
  }

  get incomeSharePercent(): number {
    const totalFlow = this.incomeTotal + this.expenseTotal;
    if (totalFlow <= 0) {
      return 0;
    }
    return (this.incomeTotal / totalFlow) * 100;
  }

  get expenseSharePercent(): number {
    const totalFlow = this.incomeTotal + this.expenseTotal;
    if (totalFlow <= 0) {
      return 0;
    }
    return (this.expenseTotal / totalFlow) * 100;
  }

  get pieChartData(): ChartData<'pie'> {
    const clubExpenses = this.exerciseTransactions
      .filter((t) => t.type === 'EXPENSE' && (t.scope === 'CLUB' || (!t.eventId && !t.budgetId)))
      .reduce((sum, t) => sum + t.amount, 0);

    const eventExpenses = this.exerciseTransactions
      .filter((t) => t.type === 'EXPENSE' && (t.scope === 'EVENT' || t.eventId != null))
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      labels: ['Income', 'Club Expenses', 'Event Expenses'],
      datasets: [{
        data: [this.incomeTotal, clubExpenses, eventExpenses],
        backgroundColor: ['rgba(74,222,128,0.85)', 'rgba(251,146,60,0.85)', 'rgba(167,139,250,0.85)'],
        borderColor: ['#1a1a2e', '#1a1a2e', '#1a1a2e'],
        borderWidth: 2,
        hoverOffset: 8
      }]
    };
  }

  get monthlyTrendRows(): MonthlyTrendRow[] {
    const rows: MonthlyTrendRow[] = [];

    for (let month = 0; month < 12; month += 1) {
      const monthStart = new Date(Date.UTC(this.selectedExerciseYear, month, 1));
      const monthEnd = new Date(Date.UTC(this.selectedExerciseYear, month + 1, 1));

      let income = 0;
      let expense = 0;

      this.exerciseTransactions.forEach((transaction) => {
        const d = new Date(transaction.date);
        if (Number.isNaN(d.getTime()) || d < monthStart || d >= monthEnd) {
          return;
        }

        if (transaction.type === 'INCOME') {
          income += transaction.amount;
        } else {
          expense += transaction.amount;
        }
      });

      rows.push({
        monthLabel: monthStart.toLocaleString('en-US', { month: 'short' }),
        income,
        expense,
        net: income - expense
      });
    }

    return rows;
  }

  get pagedTrendRows(): MonthlyTrendRow[] {
    const start = this.trendPage * this.trendPageSize;
    return this.monthlyTrendRows.slice(start, start + this.trendPageSize);
  }

  get trendTotalPages(): number {
    return Math.ceil(this.monthlyTrendRows.length / this.trendPageSize);
  }

  trendPrev(): void {
    if (this.trendPage > 0) this.trendPage--;
  }

  trendNext(): void {
    if (this.trendPage < this.trendTotalPages - 1) this.trendPage++;
  }

  get pagedBudgetItems(): BudgetItem[] {
    const start = this.budgetPage * this.budgetPageSize;
    return this.filteredBudgetItems.slice(start, start + this.budgetPageSize);
  }

  get budgetTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredBudgetItems.length / this.budgetPageSize));
  }

  budgetPrev(): void { if (this.budgetPage > 0) this.budgetPage--; }
  budgetNext(): void { if (this.budgetPage < this.budgetTotalPages - 1) this.budgetPage++; }
  resetBudgetPage(): void { this.budgetPage = 0; }

  get pagedRecentTransactions(): TransactionItem[] {
    const start = this.transactionPage * this.transactionPageSize;
    return this.filteredRecentTransactions.slice(start, start + this.transactionPageSize);
  }

  get transactionTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRecentTransactions.length / this.transactionPageSize));
  }

  transactionPrev(): void { if (this.transactionPage > 0) this.transactionPage--; }
  transactionNext(): void { if (this.transactionPage < this.transactionTotalPages - 1) this.transactionPage++; }
  resetTransactionPage(): void { this.transactionPage = 0; }

  onExerciseYearChange(year: number | string): void {
    const parsed = Number(year);
    if (!Number.isFinite(parsed)) {
      return;
    }

    this.selectedExerciseYear = parsed;
    this.refreshDashboardView();
  }

  forecastTab: 'breakdown' | 'insights' = 'breakdown';

  setForecastHorizon(horizon: ForecastHorizon): void {
    this.selectedForecastHorizon = horizon;
  }

  setForecastTab(tab: 'breakdown' | 'insights'): void {
    this.forecastTab = tab;
  }

  alertCountByLevel(level: AlertLevel): number {
    return this.budgetUtilizationAlerts.filter(a => a.level === level).length;
  }

  fraudCountBySeverity(severity: FraudSeverity): number {
    return this.fraudAlerts.filter(a => a.severity === severity).length;
  }

  fraudSeverityClass(severity: FraudSeverity): string {
    return `badge badge--${severity}`;
  }

  fraudScoreBarClass(score: number): string {
    if (score >= 80) return 'score-bar__fill--critical';
    if (score >= 60) return 'score-bar__fill--high';
    if (score >= 35) return 'score-bar__fill--medium';
    return 'score-bar__fill--low';
  }

  formatFraudAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  }

  formatFraudDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  dismissFraudAlert(alert: FraudAlert): void {
    this.dismissingFraudId = alert.internalId;
    this.fraudService.dismissAlert(alert.internalId).subscribe({
      next: () => {
        this.fraudAlerts = this.fraudAlerts.filter(a => a.internalId !== alert.internalId);
        this.dismissingFraudId = null;
      },
      error: () => { this.dismissingFraudId = null; }
    });
  }

  getConfidenceLabel(forecast: AiCashFlowProjection): string {
    return forecast.confidenceLevel || (forecast.confidenceScore >= 75 ? 'High' : forecast.confidenceScore >= 50 ? 'Medium' : 'Low');
  }

  getConfidenceToneClass(forecast: AiCashFlowProjection): string {
    const label = this.getConfidenceLabel(forecast);
    if (label === 'High') {
      return 'reliability-badge--green';
    }
    if (label === 'Medium') {
      return 'reliability-badge--amber';
    }
    return 'reliability-badge--red';
  }

  getRiskToneClass(forecast: AiCashFlowProjection): string {
    const level = forecast.riskLevel || 'Moderate';
    if (level === 'Low') {
      return 'reliability-badge--green';
    }
    if (level === 'Moderate') {
      return 'reliability-badge--amber';
    }
    return 'reliability-badge--red';
  }

  utilization(item: BudgetItem): number {
    if (item.total <= 0) {
      return 0;
    }
    return Math.round((item.spent / item.total) * 100);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(value);
  }

  absValue(value: number): number {
    return Math.abs(value);
  }

  openExportCustomization(): void {
    this.showBrandingPanel = true;
  }

  cancelExportCustomization(): void {
    this.showBrandingPanel = false;
  }

  openInvoicePanel(): void {
    this.showInvoicePanel = true;
  }

  cancelInvoicePanel(): void {
    this.showInvoicePanel = false;
  }

  closeBudgetAlertPopup(): void {
    this.showBudgetAlertPopup = false;
  }

  dismissBudgetAlert(alert: BudgetUtilizationAlert): void {
    this.dismissedBudgetAlertKeys.add(this.getAlertKey(alert));
    if (this.popupBudgetUtilizationAlerts.length === 0) {
      this.showBudgetAlertPopup = false;
    }
  }

  saveBudgetAlertEmailSettings(): void {
    this.persistBudgetAlertEmailSettings();
    this.budgetAlertEmailStatus = this.emailAlertsEnabled
      ? 'Email alerts are enabled. Alerts will be sent to your current account email automatically.'
      : 'Email alerts are disabled.';
    this.budgetAlertEmailStatusTone = 'success';
  }

  sendBudgetAlertsNow(): void {
    this.trySendBudgetAlertEmail(true);
  }

  get sponsorOptions(): SponsorDto[] {
    return this.allSponsors;
  }

  exportSponsorInvoice(): void {
    this.showInvoicePanel = false;

    const sponsor = this.sponsorOptions.find((item) => item.id === this.selectedSponsorId);
    if (!sponsor) {
      this.errorMessage = 'Please select a sponsor before exporting the invoice.';
      return;
    }

    const issueDate = this.invoiceIssueDate || this.toDateInputValue(new Date());
    const dueDate = this.invoiceDueDate || this.toDateInputValue(this.addDays(new Date(), 30));
    const lines = this.buildInvoiceLines(sponsor);
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
    const discountAmount = Math.max(0, subtotal * (this.invoiceDiscount / 100));
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const vatAmount = taxableBase * (this.invoiceVatRate / 100);
    const totalTtc = taxableBase + vatAmount;

    const reportWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!reportWindow) {
      this.errorMessage = 'Unable to open invoice window. Please allow popups and try again.';
      return;
    }

    const safePrimary = this.sanitizeHexColor(this.brandPrimaryColor, '#1d4ed8');
    const safeAccent = this.sanitizeHexColor(this.brandAccentColor, '#0f172a');
    const safeTitle = this.escapeHtml(this.invoiceTitle.trim() || 'FACTURE');
    const safeClubName = this.escapeHtml(this.clubName.trim() || 'Cluverse Club');
    const sponsorName = this.escapeHtml(sponsor.name || 'Sponsor');
    const sponsorEmail = this.escapeHtml(sponsor.contactEmail || 'N/A');
    const sponsorPhone = this.escapeHtml(sponsor.phone || 'N/A');
    const logoHtml = this.clubLogoUrl
      ? `<img src="${this.escapeHtml(this.clubLogoUrl)}" alt="Logo club" style="width:48px;height:48px;border-radius:10px;object-fit:cover;border:1px solid #e2e8f0;" />`
      : `<div style="width:48px;height:48px;border-radius:10px;background:${safePrimary};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">${this.escapeHtml(safeClubName.charAt(0).toUpperCase() || 'C')}</div>`;

    const rowsHtml = lines.map((line) => {
      return `
        <tr>
          <td>${this.escapeHtml(line.description)}</td>
          <td style="text-align:right;">${this.formatCurrency(line.unitPrice)}</td>
          <td style="text-align:center;">${line.quantity}</td>
          <td style="text-align:right;">${this.formatCurrency(line.total)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${safeTitle} - ${this.escapeHtml(this.invoiceNumber)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; background: #e2e8f0; margin: 0; padding: 40px; color: #0f172a; }
          .sheet { max-width: 850px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
          .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${safePrimary}20; padding-bottom: 24px; margin-bottom: 24px; }
          .brand { display: flex; align-items: center; gap: 16px; }
          .brand h1 { margin: 0; font-size: 28px; font-weight: 700; color: ${safeAccent}; letter-spacing: -0.5px; }
          .brand small { display: block; color: #64748b; font-size: 14px; margin-top: 4px; }
          .doc-title { text-align: right; }
          .doc-title h2 { margin: 0; font-size: 40px; font-weight: 700; color: ${safePrimary}; letter-spacing: -1px; text-transform: uppercase; }
          .doc-title div { font-size: 16px; color: #475569; margin-top: 8px; font-weight: 500; }
          .meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 32px; font-size: 14px; line-height: 1.6; }
          .box { width: 48%; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9; }
          .box h3 { margin: 0 0 12px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
          .box strong { color: ${safeAccent}; font-size: 16px; display: block; margin-bottom: 4px; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 24px; }
          th, td { padding: 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; text-align: left; }
          th:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
          th:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
          tbody tr:last-child td { border-bottom: none; }
          .totals { margin-top: 32px; margin-left: auto; width: 350px; background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #f1f5f9; }
          .line { display: flex; justify-content: space-between; margin: 12px 0; color: #475569; font-size: 14px; }
          .line strong { color: #0f172a; font-weight: 600; }
          .line.total { border-top: 2px solid #cbd5e1; padding-top: 16px; margin-top: 16px; font-size: 20px; color: ${safePrimary}; font-weight: 700; }
          .line.total strong { color: ${safePrimary}; }
          .note { margin-top: 40px; padding: 16px; background:#eff6ff; border-left: 4px solid ${safePrimary}; color: #1e3a8a; font-size: 13px; border-radius: 0 8px 8px 0; line-height: 1.5; }
          @media print { 
            body { background: #fff; padding: 0; margin: 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
            .sheet { border: none; border-radius: 0; padding: 0; box-shadow: none; max-width: 100%; } 
          }
        </style>
      </head>
      <body>
        <section class="sheet">
          <div class="top">
            <div class="brand">
              ${logoHtml}
              <div>
                <h1>${safeClubName}</h1>
                <small>Club Finance Office</small>
              </div>
            </div>
            <div class="doc-title">
              <h2>${safeTitle}</h2>
              <div>N° ${this.escapeHtml(this.invoiceNumber)}</div>
            </div>
          </div>

          <div class="meta">
            <div class="box">
              <h3>Émetteur</h3>
              <strong>${safeClubName}</strong>
              <div>Date d'émission: ${this.escapeHtml(issueDate)}</div>
              <div>Échéance: ${this.escapeHtml(dueDate)}</div>
            </div>
            <div class="box" style="text-align: right;">
              <h3>Destinataire (Sponsor)</h3>
              <strong>${sponsorName}</strong>
              <div>${sponsorEmail}</div>
              <div>${sponsorPhone}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align:right;">Prix U.</th>
                <th style="text-align:center;">Qté</th>
                <th style="text-align:right;">Total HT</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:32px;">Aucune ligne disponible.</td></tr>'}
            </tbody>
          </table>

          <div class="totals">
            <div class="line"><span>Sous-total HT</span><strong>${this.formatCurrency(subtotal)}</strong></div>
            <div class="line"><span>Remise (${this.invoiceDiscount}%)</span><strong style="color:#ef4444;">- ${this.formatCurrency(discountAmount)}</strong></div>
            <div class="line"><span>TVA (${this.invoiceVatRate}%)</span><strong>${this.formatCurrency(vatAmount)}</strong></div>
            <div class="line total"><span>TOTAL TTC</span><strong>${this.formatCurrency(totalTtc)}</strong></div>
          </div>

          <p class="note">Facture générée numériquement et basée sur les contrats de sponsoring / transactions de type INCOME en faveur de ${sponsorName} pour l'exercice ${this.selectedExerciseYear}.</p>
        </section>
      </body>
      </html>
    `;

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  exportFinancialReport(): void {
    this.showBrandingPanel = false;
    const generatedAt = new Date();
    const transactionsExcerpt = this.exerciseTransactions
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    const reportWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!reportWindow) {
      this.errorMessage = 'Unable to open export window. Please allow popups and try again.';
      return;
    }

    const rowsHtml = transactionsExcerpt.map((transaction) => {
      const sign = transaction.type === 'INCOME' ? '+' : '-';
      return `
        <tr>
          <td>${this.escapeHtml(transaction.date)}</td>
          <td>${this.escapeHtml(transaction.type)}</td>
          <td>${this.escapeHtml(transaction.description)}</td>
          <td style="text-align:right;">${sign}${this.formatCurrency(transaction.amount)}</td>
        </tr>
      `;
    }).join('');

    const netResultSign = this.netResult >= 0 ? '+' : '-';
    const projectedNetSign = this.projectedNetFlow >= 0 ? '+' : '-';
    const reconciliationLabel = this.reconciliationGap === null
      ? '--'
      : `${this.reconciliationGap >= 0 ? '+' : '-'}${this.formatCurrency(this.absValue(this.reconciliationGap))}`;
    const safeTitle = this.escapeHtml(this.reportTitle.trim() || 'Rapport Financier Personnalise');
    const safeClubName = this.escapeHtml(this.clubName.trim() || 'Cluverse Club');
    const safePrimary = this.sanitizeHexColor(this.brandPrimaryColor, '#1d4ed8');
    const safeAccent = this.sanitizeHexColor(this.brandAccentColor, '#0f172a');
    const logoHtml = this.clubLogoUrl
      ? `<img src="${this.escapeHtml(this.clubLogoUrl)}" alt="Logo club" style="width:54px;height:54px;border-radius:10px;object-fit:cover;border:1px solid #e2e8f0;" />`
      : `<div style="width:54px;height:54px;border-radius:10px;background:${safePrimary};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">${this.escapeHtml(safeClubName.charAt(0).toUpperCase() || 'C')}</div>`;

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Rapport Financier ${this.selectedExerciseYear}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; background: #f1f5f9; color: #0f172a; margin: 0; padding: 40px; }
          .container { max-width: 900px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
          h1 { margin: 0 0 8px; font-size: 28px; font-weight: 700; color: ${safePrimary}; letter-spacing: -0.5px; }
          h2 { margin: 32px 0 16px; font-size: 20px; font-weight: 600; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; color: ${safeAccent}; }
          .brand-head { display:flex; align-items:center; justify-content:space-between; gap:20px; border-radius:12px; padding:24px; background: linear-gradient(135deg, ${safePrimary}10, ${safeAccent}05); border: 1px solid ${safePrimary}20; border-left: 6px solid ${safePrimary}; margin-bottom: 32px; }
          .brand-title { display:flex; align-items:center; gap:16px; }
          .brand-club { color:#334155; font-weight:600; font-size:15px; margin-top:4px; }
          .meta { text-align: right; color: #475569; font-size: 13px; line-height: 1.6; }
          .meta strong { color: ${safeAccent}; font-weight: 600; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background: #f8fafc; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
          .line { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; font-size: 14px; color: #475569; }
          .line strong { font-weight: 700; font-size: 16px; color: #0f172a; }
          .income { color: #16a34a !important; }
          .expense { color: #dc2626 !important; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 16px; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
          th, td { padding: 14px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; text-align: left; }
          tbody tr:last-child td { border-bottom: none; }
          tbody tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 48px; color: #64748b; font-size: 13px; text-align: center; padding-top: 24px; border-top: 1px solid #e2e8f0; }
          @media print {
            body { margin: 10mm; background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .container { padding: 0; box-shadow: none; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand-head">
            <div class="brand-title">
              ${logoHtml}
              <div>
                <h1>${safeTitle}</h1>
                <div class="brand-club">${safeClubName}</div>
              </div>
            </div>
            <div class="meta">
              <strong>Period:</strong> ${this.selectedExerciseYear}<br/>
              <strong>Generated:</strong> ${generatedAt.toLocaleString('en-GB')}
            </div>
          </div>

          <h2>Balance Sheet Summary</h2>
          <div class="grid">
            <div class="card">
              <div class="line" style="margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;"><strong>Assets</strong></div>
              <div class="line"><span>Available cash</span><strong>${this.formatCurrency(this.closingCash)}</strong></div>
              <div class="line"><span>Receivables</span><strong>N/A</strong></div>
            </div>
            <div class="card">
              <div class="line" style="margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;"><strong>Liabilities</strong></div>
              <div class="line"><span>Debts</span><strong>N/A</strong></div>
              <div class="line"><span>Equity (estimated)</span><strong>${this.formatCurrency(this.equityTotal)}</strong></div>
            </div>
          </div>

          <h2>Simplified Income Statement</h2>
          <div class="card">
            <div class="line"><span>Total Revenue</span><strong class="income">${this.formatCurrency(this.incomeTotal)}</strong></div>
            <div class="line"><span>Total Expenses</span><strong class="expense">${this.formatCurrency(this.expenseTotal)}</strong></div>
            <div class="line" style="margin-top: 12px; padding-top: 12px; border-top: 2px dashed #cbd5e1;">
              <span style="font-weight: 600; color: #0f172a;">Net Result</span>
              <strong class="${this.netResult >= 0 ? 'income' : 'expense'}" style="font-size: 18px;">${netResultSign}${this.formatCurrency(this.absValue(this.netResult))}</strong>
            </div>
          </div>

          <h2>Treasury Report & Projections</h2>
          <div class="card">
            <div class="line"><span>Opening Balance</span><strong>${this.formatCurrency(this.openingCash)}</strong></div>
            <div class="line"><span>Inflows</span><strong class="income">${this.formatCurrency(this.incomeTotal)}</strong></div>
            <div class="line"><span>Outflows</span><strong class="expense">${this.formatCurrency(this.expenseTotal)}</strong></div>
            <div class="line" style="background:#f1f5f9; padding:8px 12px; border-radius:6px; margin-top:8px;"><span><strong>Calculated Closing Balance</strong></span><strong style="color:${safePrimary}">${this.formatCurrency(this.closingCash)}</strong></div>

            <div class="line" style="margin-top:24px;"><span>Bank reconciliation gap</span><strong>${reconciliationLabel}</strong></div>
            <div class="line"><span>Net Projection / Month</span><strong class="${this.projectedNetFlow >= 0 ? 'income' : 'expense'}">${projectedNetSign}${this.formatCurrency(this.absValue(this.projectedNetFlow))}</strong></div>
            <div class="line"><span>Projected Balance in ${this.forecastMonths} months</span><strong>${this.formatCurrency(this.projectedClosingCash)}</strong></div>
          </div>

          <h2>Recent Transactions</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No transactions available for this period.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">Report automatically generated by the Finance module – Cluverse</div>
        </div>
      </body>
      </html>
    `;

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  private loadFraudAlerts(): void {
    this.fraudAlertsLoading = true;
    this.fraudService.getAlerts({ dismissed: false, limit: 10 }).pipe(
      catchError(() => of({ alerts: [] as FraudAlert[] }))
    ).subscribe(({ alerts }) => {
      this.fraudAlerts = alerts;
      this.fraudAlertsLoading = false;
    });
  }

  private loadDashboardData(): void {
    const clubId = this.authHelperService.getClubId();

    if (!clubId) {
      this.errorMessage = 'Unable to detect club. Please login again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.loadClubBranding(clubId);

    forkJoin({
      budgets: this.financeService.getBudgets(clubId),
      transactions: this.financeService.getTransactions(clubId),
      sponsors: this.financeService.getSponsors().pipe(catchError(() => of([] as SponsorDto[]))),
      sponsorships: this.financeService.getSponsorships(clubId).pipe(catchError(() => of([] as SponsorshipDto[])))
    }).subscribe({
      next: ({ budgets, transactions, sponsors, sponsorships }) => {
        this.allBudgets = budgets;
        this.allTransactions = transactions;
        this.allSponsors = sponsors;
        this.allSponsorships = sponsorships;

        if (!this.selectedSponsorId && this.allSponsors.length > 0) {
          this.selectedSponsorId = this.allSponsors[0].id;
        }

        const years = this.availableExerciseYears;
        if (!years.includes(this.selectedExerciseYear) && years.length > 0) {
          this.selectedExerciseYear = years[0];
        }

        this.refreshDashboardView();
        this.isLoading = false;
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to load finance dashboard. ${this.formatHttpError(error)}`;
        this.isLoading = false;
      }
    });
  }

  private refreshDashboardView(): void {
    const exerciseTransactions = this.exerciseTransactions;

    this.recentTransactions = exerciseTransactions
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
      .map((transaction) => this.toTransactionItem(transaction));

    this.budgetItems = this.allBudgets
      .filter((budget) => this.normalizeYear(budget.year) === this.selectedExerciseYear)
      .map((budget) => this.toBudgetItem(budget, exerciseTransactions));

    this.loadAiForecast();

    if (!this.forecastProjections.some((projection) => projection.horizonMonths === this.selectedForecastHorizon)) {
      this.selectedForecastHorizon = 3;
    }

    this.dismissedBudgetAlertKeys.clear();
    this.showBudgetAlertPopup = this.budgetUtilizationAlerts.length > 0;
    this.trySendBudgetAlertEmail();
  }

  private trySendBudgetAlertEmail(forceSend = false): void {
    if (this.isSendingBudgetAlertEmail) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const alertsToSend = forceSend
      ? this.popupBudgetUtilizationAlerts
      : this.popupBudgetUtilizationAlerts.filter((alert) => !this.emailedBudgetAlertDeliveryKeys.has(this.getAlertDeliveryKey(alert, today)));

    if (alertsToSend.length === 0) {
      return;
    }

    const payload: BudgetAlertEmailPayload = {
      recipientEmail: this.authHelperService.getEmail() || undefined,
      recipientName: this.authHelperService.getFullName() || 'Finance Manager',
      clubName: this.clubName,
      exerciseYear: this.selectedExerciseYear,
      triggeredAt: new Date().toISOString(),
      alerts: alertsToSend.map((alert) => ({
        title: alert.title,
        department: alert.department,
        utilization: alert.utilization,
        reachedThreshold: alert.reachedThreshold,
        level: alert.level
      }))
    };

    this.isSendingBudgetAlertEmail = true;
    this.budgetAlertEmailStatus = 'Sending personalized budget alert email...';
    this.budgetAlertEmailStatusTone = 'info';

    this.financeService.sendBudgetAlertEmail(payload).subscribe({
      next: () => {
        alertsToSend.forEach((alert) => this.emailedBudgetAlertDeliveryKeys.add(this.getAlertDeliveryKey(alert, today)));
        this.persistEmailedBudgetAlertDeliveryKeys();
        this.budgetAlertEmailStatus = `${alertsToSend.length} budget alert email${alertsToSend.length > 1 ? 's were' : ' was'} sent successfully.`;
        this.budgetAlertEmailStatusTone = 'success';
        this.isSendingBudgetAlertEmail = false;
      },
      error: (error: unknown) => {
        this.budgetAlertEmailStatus = `Email notification failed. ${this.formatHttpError(error)}`;
        this.budgetAlertEmailStatusTone = 'error';
        this.isSendingBudgetAlertEmail = false;
      }
    });
  }

  private loadAiForecast(): void {
    this.aiForecast = null;

    this.financeService.getCashflowForecast({
      asOfDate: new Date().toISOString(),
      horizons: [1, 3, 6],
      transactions: this.allTransactions,
      budgets: this.allBudgets,
      currentCashBalance: this.closingCash
    }).subscribe({
      next: (forecast) => {
        this.aiForecast = forecast;

        if (!this.forecastProjections.some((projection) => projection.horizonMonths === this.selectedForecastHorizon)) {
          this.selectedForecastHorizon = 3;
        }
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to load AI forecast from external service. ${this.formatHttpError(error)}`;
      }
    });
  }

  private getAlertKey(alert: BudgetUtilizationAlert): string {
    return `${alert.title}|${alert.department}|${alert.reachedThreshold}`;
  }

  private getAlertDeliveryKey(alert: BudgetUtilizationAlert, dateStr = new Date().toISOString().slice(0, 10)): string {
    return `${dateStr}|${this.getAlertKey(alert)}`;
  }

  private initializeBudgetAlertEmailSettings(): void {
    // Always enable automatic email alerts — the manual toggle was removed from the UI.
    this.emailAlertsEnabled = true;
  }

  private persistBudgetAlertEmailSettings(): void {
    try {
      localStorage.setItem(this.alertEmailPreferenceStorageKey, JSON.stringify({
        enabled: this.emailAlertsEnabled
      }));
    } catch {
      // Ignore local storage issues and keep runtime settings.
    }
  }

  private loadEmailedBudgetAlertDeliveryKeys(): void {
    try {
      const raw = localStorage.getItem(this.emailedAlertDeliveryStorageKey);
      if (!raw) return;

      const keys = JSON.parse(raw) as string[];
      if (!Array.isArray(keys)) return;

      // Keep only today's keys so alerts re-trigger on new days.
      const today = new Date().toISOString().slice(0, 10);
      const todayKeys = keys.filter((k) => k.startsWith(`${today}|`));
      this.emailedBudgetAlertDeliveryKeys = new Set(todayKeys);
      if (todayKeys.length !== keys.length) {
        this.persistEmailedBudgetAlertDeliveryKeys();
      }
    } catch {
      this.emailedBudgetAlertDeliveryKeys.clear();
    }
  }

  private persistEmailedBudgetAlertDeliveryKeys(): void {
    try {
      localStorage.setItem(this.emailedAlertDeliveryStorageKey, JSON.stringify(Array.from(this.emailedBudgetAlertDeliveryKeys)));
    } catch {
      // Ignore local storage issues and keep runtime deduplication.
    }
  }

  private get exerciseTransactions(): TransactionDto[] {
    return this.allTransactions.filter((transaction) => {
      const d = new Date(transaction.date);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === this.selectedExerciseYear;
    });
  }

  private toBudgetItem(budget: BudgetDto, transactions: TransactionDto[]): BudgetItem {
    const year = this.normalizeYear(budget.year);
    const eventTitle = budget.event?.title?.trim() || '';
    const spent = this.calculateSpentForBudget(budget, transactions, year);
    const department = eventTitle || (budget.eventId ? `Event #${budget.eventId}` : 'Club-wide');
    const budgetLabel = eventTitle || budget.budgetType || 'Annual Budget';

    return {
      title: `${budgetLabel} ${year}`,
      department,
      spent,
      total: budget.totalAllocated
    };
  }

  private calculateSpentForBudget(budget: BudgetDto, transactions: TransactionDto[], year: number): number {
    return transactions
      .filter((t) => {
        if (t.type !== 'EXPENSE') return false;
        const d = new Date(t.date);
        if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) return false;

        if (t.budgetId != null) return t.budgetId === budget.id;
        if (t.eventId != null && budget.eventId != null) return t.eventId === budget.eventId;
        if (!budget.eventId) return !t.eventId && t.scope !== 'EVENT';
        return false;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }

  private toTransactionItem(transaction: TransactionDto): TransactionItem {
    return {
      type: transaction.type === 'INCOME' ? 'income' : 'expense',
      description: transaction.description,
      category: transaction.type === 'INCOME' ? 'Income' : 'Expense',
      date: transaction.date,
      addedBy: 'System',
      amount: transaction.amount
    };
  }

  private averageMonthlyAmount(type: 'INCOME' | 'EXPENSE', monthsBack: number): number {
    const monthTotals = new Map<string, number>();
    const now = new Date();
    const targetKeys: string[] = [];

    for (let i = 0; i < monthsBack; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      targetKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      monthTotals.set(targetKeys[i], 0);
    }

    this.allTransactions.forEach((transaction) => {
      if (transaction.type !== type) {
        return;
      }

      const d = new Date(transaction.date);
      if (Number.isNaN(d.getTime())) {
        return;
      }

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthTotals.has(key)) {
        return;
      }

      monthTotals.set(key, (monthTotals.get(key) ?? 0) + transaction.amount);
    });

    const total = Array.from(monthTotals.values()).reduce((sum, value) => sum + value, 0);
    return total / monthsBack;
  }

  private normalizeYear(year: number | string): number {
    const currentYear = new Date().getFullYear();

    const toValidYear = (value: number): number | null => {
      if (!Number.isFinite(value)) {
        return null;
      }

      const integerValue = Math.trunc(value);
      if (integerValue >= 1900 && integerValue <= 3000) {
        return integerValue;
      }

      const text = String(Math.abs(integerValue));
      if (text.length === 8) {
        const candidate = Number(text.slice(0, 4));
        if (candidate >= 1900 && candidate <= 3000) {
          return candidate;
        }
      }

      return null;
    };

    if (typeof year === 'number') {
      return toValidYear(year) ?? currentYear;
    }

    const trimmedYear = year.trim();

    if (/^\d{8}$/.test(trimmedYear)) {
      const compactYear = Number(trimmedYear.slice(0, 4));
      if (compactYear >= 1900 && compactYear <= 3000) {
        return compactYear;
      }
    }

    if (/^\d{4}$/.test(trimmedYear)) {
      const fourDigitYear = Number(trimmedYear);
      if (fourDigitYear >= 1900 && fourDigitYear <= 3000) {
        return fourDigitYear;
      }
    }

    const parsed = new Date(trimmedYear);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getUTCFullYear();
    }

    const numericYear = Number(trimmedYear);
    return toValidYear(numericYear) ?? currentYear;
  }

  private formatHttpError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unexpected client error.';
    }

    const backendMessage =
      typeof error.error === 'string'
        ? error.error
        : (error.error?.message as string | undefined) ?? error.message;

    return `Status ${error.status}: ${backendMessage}`;
  }

  private loadClubBranding(clubId: number): void {
    this.apiService.getClubById(clubId).subscribe({
      next: (club) => {
        this.clubName = club?.name?.trim() || this.clubName;
        this.clubLogoUrl = club?.logoUrl?.trim() || '';
      },
      error: () => {
        // Keep defaults if club branding cannot be loaded.
      }
    });
  }

  private buildInvoiceLines(sponsor: SponsorDto): InvoiceLine[] {
    const sponsorNameLower = (sponsor.name || '').trim().toLowerCase();

    const contractLines = this.allSponsorships
      .filter((item) => {
        if (!item.sponsor || item.sponsor.id !== sponsor.id) {
          return false;
        }

        const start = item.startDate ? new Date(item.startDate) : null;
        const end = item.endDate ? new Date(item.endDate) : null;

        if (start && !Number.isNaN(start.getTime()) && start.getFullYear() > this.selectedExerciseYear) {
          return false;
        }

        if (end && !Number.isNaN(end.getTime()) && end.getFullYear() < this.selectedExerciseYear) {
          return false;
        }

        return true;
      })
      .map((item) => ({
        description: `Contrat sponsoring (${item.status || 'ACTIVE'})`,
        unitPrice: item.amount || 0,
        quantity: 1,
        total: item.amount || 0
      }));

    const donationLines = this.exerciseTransactions
      .filter((transaction) => {
        if (transaction.type !== 'INCOME') {
          return false;
        }

        const description = (transaction.description || '').toLowerCase();
        return sponsorNameLower ? description.includes(sponsorNameLower) : false;
      })
      .map((transaction) => ({
        description: transaction.description || 'Donation sponsor',
        unitPrice: transaction.amount,
        quantity: 1,
        total: transaction.amount
      }));

    if (donationLines.length === 0) {
      const fallbackAmount = this.exerciseTransactions
        .filter((transaction) => transaction.type === 'INCOME')
        .reduce((sum, transaction) => sum + transaction.amount, 0);

      if (fallbackAmount > 0) {
        donationLines.push({
          description: 'Donation sponsor (revenus INCOME exercice)',
          unitPrice: fallbackAmount,
          quantity: 1,
          total: fallbackAmount
        });
      }
    }

    return [...contractLines, ...donationLines];
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private sanitizeHexColor(value: string, fallback: string): string {
    const color = (value || '').trim();
    return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color) ? color : fallback;
  }

  private generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    return `FAC-${year}-${rand}`;
  }

  private toDateInputValue(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }
}
