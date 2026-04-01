import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { BudgetCategory, BudgetDto, FinanceService } from '../../../../core/services/finance.service';

interface BudgetItem {
  id: number;
  year: number;
  category: BudgetCategory;
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
  readonly budgetCategories: BudgetCategory[] = [
    'EVENTS',
    'EQUIPMENT',
    'MARKETING',
    'TRAVEL',
    'OPERATIONS',
    'OTHER'
  ];

  showCreateBudgetForm = false;
  isLoading = false;
  isSubmitting = false;
  errorMessage = '';

  createBudgetModel: {
    year: number;
    totalAllocated: number | null;
    category: BudgetCategory;
  } = {
    year: new Date().getFullYear(),
    totalAllocated: null,
    category: 'EVENTS'
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
    this.errorMessage = '';
  }

  cancelCreateBudget(): void {
    this.showCreateBudgetForm = false;
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

    this.financeService.createBudget(clubId, {
      year: this.createBudgetModel.year,
      totalAllocated: this.createBudgetModel.totalAllocated,
      category: this.createBudgetModel.category
    }).subscribe({
      next: (createdBudget) => {
        this.budgetItems = [this.toBudgetItem(createdBudget), ...this.budgetItems];
        this.showCreateBudgetForm = false;
        this.createBudgetModel = {
          year: new Date().getFullYear(),
          totalAllocated: null,
          category: 'EVENTS'
        };
        this.isSubmitting = false;
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to create budget. ${this.formatHttpError(error)}`;
        this.isSubmitting = false;
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
    const formattedCategory = budget.category.charAt(0) + budget.category.slice(1).toLowerCase();
    return {
      id: budget.id,
      year: budget.year,
      category: budget.category,
      title: `${formattedCategory} Budget`,
      department: formattedCategory,
      spent: 0,
      total: budget.totalAllocated
    };
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
