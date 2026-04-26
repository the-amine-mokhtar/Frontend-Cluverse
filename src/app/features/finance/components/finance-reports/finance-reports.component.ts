import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { BudgetDto, FinanceService, TransactionDto } from '../../../../core/services/finance.service';
import { environment } from '../../../../../environments/environment.development';

interface BacResource {
  name: string;
  costPerMonth: number;
}

interface BacActivity {
  name: string;
  predecessors: string;
  durationMonths: number;
  resourceNames: string;
}

@Component({
  selector: 'app-finance-reports',
  templateUrl: './finance-reports.component.html',
  styleUrl: './finance-reports.component.scss'
})
export class FinanceReportsComponent implements OnInit {
  private allTransactions: TransactionDto[] = [];
  private allBudgets: BudgetDto[] = [];

  selectedExerciseYear = new Date().getFullYear();
  declaredBankBalance: number | null = null;
  readonly forecastMonths = 3;

  isLoading = false;
  errorMessage = '';

  bacResources: BacResource[] = [
    { name: 'R1', costPerMonth: 0 },
    { name: 'R2', costPerMonth: 0 }
  ];

  bacActivities: BacActivity[] = [
    { name: 'A', predecessors: '-', durationMonths: 1, resourceNames: 'R1, R2' }
  ];

  bacResult: number | null = null;
  bacBreakdown: { activityName: string; cost: number }[] = [];

  aiSuggestion = '';
  isLoadingAi = false;

  private readonly forecastApiUrl = environment.forecastApiUrl;

  constructor(
    private readonly financeService: FinanceService,
    private readonly authHelperService: AuthHelperService,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    const clubId = this.authHelperService.getClubId();
    if (!clubId) {
      this.errorMessage = 'Unable to detect club. Please login again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      budgets: this.financeService.getBudgets(clubId),
      transactions: this.financeService.getTransactions(clubId)
    }).subscribe({
      next: ({ budgets, transactions }) => {
        this.allBudgets = budgets;
        this.allTransactions = transactions;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load financial data.';
        this.isLoading = false;
      }
    });
  }

  private get exerciseTransactions(): TransactionDto[] {
    return this.allTransactions.filter((t) => {
      const d = new Date(t.date);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === this.selectedExerciseYear;
    });
  }

  get availableExerciseYears(): number[] {
    const years = new Set<number>();
    this.allBudgets.forEach((b) => years.add(this.normalizeYear(b.year)));
    this.allTransactions.forEach((t) => {
      const d = new Date(t.date);
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear());
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }

  get incomeTotal(): number {
    return this.exerciseTransactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  get expenseTotal(): number {
    return this.exerciseTransactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  get netResult(): number {
    return this.incomeTotal - this.expenseTotal;
  }

  get openingCash(): number {
    const start = new Date(Date.UTC(this.selectedExerciseYear, 0, 1));
    return this.allTransactions.reduce((sum, t) => {
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime()) || d >= start) return sum;
      return t.type === 'INCOME' ? sum + t.amount : sum - t.amount;
    }, 0);
  }

  get closingCash(): number {
    return this.openingCash + this.netResult;
  }

  get equityTotal(): number {
    return this.allTransactions.reduce((sum, t) =>
      t.type === 'INCOME' ? sum + t.amount : sum - t.amount, 0);
  }

  get reconciliationGap(): number | null {
    const declared = Number(this.declaredBankBalance);
    if (!Number.isFinite(declared)) return null;
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

  onExerciseYearChange(year: number | string): void {
    const parsed = Number(year);
    if (Number.isFinite(parsed)) this.selectedExerciseYear = parsed;
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

  addResource(): void {
    this.bacResources.push({ name: `R${this.bacResources.length + 1}`, costPerMonth: 0 });
    this.bacResult = null;
    this.bacBreakdown = [];
  }

  removeResource(index: number): void {
    this.bacResources.splice(index, 1);
    this.bacResult = null;
    this.bacBreakdown = [];
  }

  addActivity(): void {
    const names = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const label = names[this.bacActivities.length] ?? `Act${this.bacActivities.length + 1}`;
    this.bacActivities.push({ name: label, predecessors: '-', durationMonths: 1, resourceNames: '' });
    this.bacResult = null;
    this.bacBreakdown = [];
  }

  removeActivity(index: number): void {
    this.bacActivities.splice(index, 1);
    this.bacResult = null;
    this.bacBreakdown = [];
  }

  calculateBac(): void {
    const resourceMap = new Map<string, number>(
      this.bacResources.map((r) => [r.name.trim().toUpperCase(), r.costPerMonth])
    );

    this.bacBreakdown = this.bacActivities.map((activity) => {
      const usedNames = activity.resourceNames
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const resourceCostPerMonth = usedNames.reduce((sum, name) => {
        return sum + (resourceMap.get(name) ?? 0);
      }, 0);

      return {
        activityName: activity.name,
        cost: activity.durationMonths * resourceCostPerMonth
      };
    });

    this.bacResult = this.bacBreakdown.reduce((sum, b) => sum + b.cost, 0);
  }

  getAiSuggestions(): void {
    if (this.bacResult === null) this.calculateBac();

    this.isLoadingAi = true;
    this.aiSuggestion = '';

    this.http.post<{ suggestion: string }>(`${this.forecastApiUrl}/v1/bac-suggest`, {
      resources: this.bacResources,
      activities: this.bacActivities,
      bacTotal: this.bacResult,
      incomeTotal: this.incomeTotal,
      expenseTotal: this.expenseTotal,
      closingCash: this.closingCash
    }).subscribe({
      next: (response) => {
        this.aiSuggestion = response.suggestion;
        this.isLoadingAi = false;
      },
      error: (err) => {
        const serverMsg: string = err?.error?.message ?? '';
        if (serverMsg.toLowerCase().includes('credit')) {
          this.aiSuggestion = 'AI unavailable: Anthropic account has insufficient credits. Please top up at console.anthropic.com.';
        } else if (serverMsg) {
          this.aiSuggestion = `AI unavailable: ${serverMsg}`;
        } else {
          this.aiSuggestion = 'AI suggestions unavailable. Make sure the cashflow service is running on port 8090.';
        }
        this.isLoadingAi = false;
      }
    });
  }

  private averageMonthlyAmount(type: 'INCOME' | 'EXPENSE', monthsBack: number): number {
    const monthTotals = new Map<string, number>();
    const now = new Date();
    const targetKeys: string[] = [];

    for (let i = 0; i < monthsBack; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      targetKeys.push(key);
      monthTotals.set(key, 0);
    }

    this.allTransactions.forEach((t) => {
      if (t.type !== type) return;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthTotals.has(key)) {
        monthTotals.set(key, (monthTotals.get(key) ?? 0) + t.amount);
      }
    });

    const total = Array.from(monthTotals.values()).reduce((sum, v) => sum + v, 0);
    return total / monthsBack;
  }

  private normalizeYear(year: number | string): number {
    const val = Number(year);
    if (Number.isFinite(val) && val >= 1900 && val <= 3000) return Math.trunc(val);
    return new Date().getFullYear();
  }
}
