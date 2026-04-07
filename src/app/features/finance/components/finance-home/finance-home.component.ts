import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { BudgetDto, FinanceService, TransactionDto } from '../../../../core/services/finance.service';

interface BudgetItem {
  title: string;
  department: string;
  spent: number;
  total: number;
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

@Component({
  selector: 'app-finance-home',
  templateUrl: './finance-home.component.html',
  styleUrl: './finance-home.component.scss'
})
export class FinanceHomeComponent implements OnInit {
  budgetItems: BudgetItem[] = [];
  recentTransactions: TransactionItem[] = [];
  budgetSearchTerm = '';
  budgetFilter: BudgetFilter = 'all';
  transactionSearchTerm = '';
  transactionFilter: TransactionFilter = 'all';
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly financeService: FinanceService,
    private readonly authHelperService: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  get totalBudget(): number {
    return this.budgetItems.reduce((sum, item) => sum + item.total, 0);
  }

  get totalSpent(): number {
    return this.budgetItems.reduce((sum, item) => sum + item.spent, 0);
  }

  get netFlow(): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return this.recentTransactions.reduce((sum, transaction) => {
      const transactionDate = new Date(transaction.date);
      if (transactionDate.getMonth() !== currentMonth || transactionDate.getFullYear() !== currentYear) {
        return sum;
      }

      return transaction.type === 'income'
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

  private loadDashboardData(): void {
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
        this.recentTransactions = transactions
          .slice()
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 6)
          .map((transaction) => this.toTransactionItem(transaction));

        this.budgetItems = budgets.map((budget) => this.toBudgetItem(budget, transactions));
        this.isLoading = false;
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to load finance dashboard. ${this.formatHttpError(error)}`;
        this.isLoading = false;
      }
    });
  }

  private toBudgetItem(budget: BudgetDto, transactions: TransactionDto[]): BudgetItem {
    const year = this.normalizeYear(budget.year);
    const spent = transactions
      .filter((transaction) => {
        if (transaction.type !== 'EXPENSE') {
          return false;
        }

        const transactionDate = new Date(transaction.date);
        return !Number.isNaN(transactionDate.getTime()) && transactionDate.getFullYear() === year;
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      title: `Annual Budget ${year}`,
      department: 'Club-wide',
      spent,
      total: budget.totalAllocated
    };
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
}
