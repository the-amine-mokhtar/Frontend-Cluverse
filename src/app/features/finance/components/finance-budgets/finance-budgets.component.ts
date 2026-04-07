import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { BudgetDto, FinanceService } from '../../../../core/services/finance.service';

interface BudgetItem {
  id: number;
  year: number;
  eventId: number | null;
  title: string;
  department: string;
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
    this.loadBudgets();
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

  private loadBudgets(): void {
    const clubId = this.authHelperService.getClubId();

    if (!clubId) {
      this.errorMessage = 'Unable to detect club. Please login again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.financeService.getBudgets(clubId).subscribe({
      next: (budgets) => {
        this.budgetItems = budgets.map((budget) => this.toBudgetItem(budget));
        this.isLoading = false;
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to load budgets from backend. ${this.formatHttpError(error)}`;
        this.isLoading = false;
      }
    });
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
    };
    const eventId = budgetData.eventId ?? budgetData.event_id ?? null;
    const totalAllocated = budgetData.totalAllocated ?? budgetData.total_allocated ?? 0;
    const year = this.normalizeYear(budgetData.year);
    return {
      id: budgetData.id,
      year,
      eventId,
      title: `Annual Budget ${year}`,
      department: eventId ? `Event #${eventId}` : 'Club-wide',
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
