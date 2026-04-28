import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { BudgetDto, EventDto, FinanceService, MemberPaymentDto, TransactionDto } from '../../../../core/services/finance.service';

interface BudgetItem {
  id: number;
  year: number;
  eventId: number | null;
  eventTitle: string | null;
  title: string;
  department: string;
  budgetType: string;
  spent: number;
  total: number;
}

@Component({
  selector: 'app-finance-budgets',
  templateUrl: './finance-budgets.component.html',
  styleUrl: './finance-budgets.component.scss'
})
export class FinanceBudgetsComponent implements OnInit {
  budgetItems: BudgetItem[] = [];
  clubEvents: EventDto[] = [];

  clubTotalIncome = 0;
  clubTotalAllocated = 0;

  get clubFreeBalance(): number {
    return this.clubTotalIncome - this.clubTotalAllocated;
  }

  budgetPage = 0;
  readonly budgetPageSize = 6;

  showCreateBudgetForm = false;
  editingBudgetId: number | null = null;
  isLoading = false;
  isSubmitting = false;
  errorMessage = '';

  createBudgetModel: {
    year: number;
    totalAllocated: number | null;
    eventId: number | null;
  } = {
    year: new Date().getFullYear(),
    totalAllocated: null,
    eventId: null
  };

  constructor(
    private readonly financeService: FinanceService,
    private readonly authHelperService: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  openCreateBudgetForm(): void {
    this.showCreateBudgetForm = true;
    this.editingBudgetId = null;
    this.createBudgetModel = {
      year: new Date().getFullYear(),
      totalAllocated: null,
      eventId: null
    };
    this.errorMessage = '';
  }

  cancelCreateBudget(): void {
    this.showCreateBudgetForm = false;
    this.editingBudgetId = null;
    this.errorMessage = '';
  }

  submitCreateBudget(): void {
    const clubId = this.authHelperService.getClubId();

    if (!clubId) {
      this.errorMessage = 'Unable to detect club. Please login again.';
      return;
    }

    if (!this.createBudgetModel.totalAllocated || this.createBudgetModel.totalAllocated <= 0) {
      this.errorMessage = 'Total allocated must be greater than 0.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = {
      year: this.createBudgetModel.year,
      totalAllocated: this.createBudgetModel.totalAllocated,
      eventId: this.createBudgetModel.eventId
    };

    if (this.editingBudgetId !== null) {
      const budgetId = this.editingBudgetId;
      this.financeService.updateBudget(clubId, budgetId, payload).subscribe({
        next: (updatedBudget) => {
          this.budgetItems = this.budgetItems.map((item) =>
            item.id === budgetId ? this.toBudgetItem(updatedBudget) : item
          );
          this.showCreateBudgetForm = false;
          this.editingBudgetId = null;
          this.isSubmitting = false;
        },
        error: (error: unknown) => {
          this.errorMessage = `Failed to update budget. ${this.formatHttpError(error)}`;
          this.isSubmitting = false;
        }
      });
      return;
    }

    this.financeService.createBudget(clubId, payload).subscribe({
      next: (createdBudget) => {
        this.budgetItems = [this.toBudgetItem(createdBudget), ...this.budgetItems];
        this.showCreateBudgetForm = false;
        this.createBudgetModel = {
          year: new Date().getFullYear(),
          totalAllocated: null,
          eventId: null
        };
        this.isSubmitting = false;
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to create budget. ${this.formatHttpError(error)}`;
        this.isSubmitting = false;
      }
    });
  }

  editBudget(item: BudgetItem): void {
    this.editingBudgetId = item.id;
    this.showCreateBudgetForm = true;
    this.errorMessage = '';
    this.createBudgetModel = {
      year: item.year,
      totalAllocated: item.total,
      eventId: item.eventId
    };
  }

  deleteBudget(item: BudgetItem): void {
    const clubId = this.authHelperService.getClubId();

    if (!clubId) {
      this.errorMessage = 'Unable to detect club. Please login again.';
      return;
    }

    this.errorMessage = '';

    this.financeService.deleteBudget(clubId, item.id).subscribe({
      next: () => {
        this.budgetItems = this.budgetItems.filter((budget) => budget.id !== item.id);
        if (this.editingBudgetId === item.id) {
          this.cancelCreateBudget();
        }
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to delete budget. ${this.formatHttpError(error)}`;
      }
    });
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
      transactions: this.financeService.getTransactions(clubId),
      events: this.financeService.getEvents(clubId),
      memberPayments: this.financeService.getMemberPayments(clubId)
    }).subscribe({
      next: ({ budgets, transactions, events, memberPayments }) => {
        this.clubEvents = [...events].sort((a, b) => a.title.localeCompare(b.title));
        this.budgetItems = budgets.map((budget) => this.toBudgetItem(budget));
        this.computeClubTotals(budgets, transactions, memberPayments);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to load data. ${this.formatHttpError(error)}`;
        this.isLoading = false;
      }
    });
  }

  private computeClubTotals(budgets: BudgetDto[], transactions: TransactionDto[], memberPayments: MemberPaymentDto[]): void {
    const transactionIncome = transactions
      .filter((t) => {
        const isClubScope = !t.scope || t.scope === 'CLUB';
        const isIncome = t.type === 'INCOME';
        const isClubLevel = !t.eventId && !t.budgetId;
        return isIncome && (isClubScope || isClubLevel);
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const paidDues = memberPayments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    this.clubTotalIncome = transactionIncome + paidDues;

    this.clubTotalAllocated = budgets
      .filter((b) => b.eventId != null)
      .reduce((sum, b) => sum + b.totalAllocated, 0);
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

  private toBudgetItem(budget: BudgetDto): BudgetItem {
    const budgetData = budget as BudgetDto & {
      total_allocated?: number;
      event_id?: number | null;
      event?: { id?: number; title?: string } | null;
      budgetType?: string;
    };
    const eventId = budgetData.event?.id ?? budgetData.eventId ?? budgetData.event_id ?? null;
    const totalAllocated = budgetData.totalAllocated ?? budgetData.total_allocated ?? 0;
    const year = this.normalizeYear(budgetData.year);
    const eventTitle = budgetData.event?.title ??
      (eventId ? (this.clubEvents.find(e => e.id === eventId)?.title ?? null) : null);
    const budgetType = eventTitle ?? (budgetData.budgetType === 'GENERAL' || !eventId ? 'GENERAL' : budgetData.budgetType ?? 'GENERAL');
    return {
      id: budgetData.id,
      year,
      eventId,
      eventTitle,
      title: `Annual Budget ${year}`,
      department: eventTitle ?? (eventId ? `Event #${eventId}` : 'Club-wide'),
      budgetType,
      spent: 0,
      total: totalAllocated
    };
  }

  private normalizeYear(year: number | string): number {
    if (typeof year === 'number') {
      return year;
    }

    const parsed = new Date(year);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getUTCFullYear();
    }

    const numericYear = Number(year);
    return Number.isFinite(numericYear) ? numericYear : new Date().getFullYear();
  }

  get pagedBudgetItems(): BudgetItem[] {
    const start = this.budgetPage * this.budgetPageSize;
    return this.budgetItems.slice(start, start + this.budgetPageSize);
  }

  get budgetTotalPages(): number {
    return Math.max(1, Math.ceil(this.budgetItems.length / this.budgetPageSize));
  }

  budgetPrev(): void { if (this.budgetPage > 0) this.budgetPage--; }
  budgetNext(): void { if (this.budgetPage < this.budgetTotalPages - 1) this.budgetPage++; }

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
      maximumFractionDigits: 0
    }).format(value);
  }
}
