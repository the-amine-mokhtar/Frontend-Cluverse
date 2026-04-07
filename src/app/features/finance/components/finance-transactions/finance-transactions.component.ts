import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CreateTransactionPayload,
  FinanceService,
  TransactionDto,
  TransactionType as ApiTransactionType,
  UpdateTransactionPayload
} from '../../../../core/services/finance.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

type TransactionType = 'income' | 'expense';
type TransactionFilter = 'all' | TransactionType;

interface TransactionItem {
  id: number;
  type: TransactionType;
  description: string;
  date: string;
  amount: number;
}

@Component({
  selector: 'app-finance-transactions',
  templateUrl: './finance-transactions.component.html',
  styleUrl: './finance-transactions.component.scss'
})
export class FinanceTransactionsComponent implements OnInit {
  searchTerm = '';
  activeFilter: TransactionFilter = 'all';
  showCreateTransactionForm = false;
  isLoading = false;
  isSubmitting = false;
  formErrorMessage = '';
  errorMessage = '';
  editingTransactionId: number | null = null;

  newTransaction: {
    type: TransactionType;
    description: string;
    date: string;
    amount: number | null;
  } = this.getInitialTransactionForm();

  transactions: TransactionItem[] = [];

  constructor(
    private readonly financeService: FinanceService,
    private readonly authHelperService: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  setFilter(filter: TransactionFilter): void {
    this.activeFilter = filter;
  }

  openCreateTransactionForm(): void {
    this.showCreateTransactionForm = true;
    this.editingTransactionId = null;
    this.newTransaction = this.getInitialTransactionForm();
    this.formErrorMessage = '';
    this.errorMessage = '';
  }

  closeCreateTransactionForm(): void {
    this.showCreateTransactionForm = false;
    this.editingTransactionId = null;
    this.formErrorMessage = '';
    this.newTransaction = this.getInitialTransactionForm();
  }

  createTransaction(): void {
    const description = this.newTransaction.description.trim();
    const amount = this.newTransaction.amount;
    const clubId = this.authHelperService.getClubId();

    if (!clubId) {
      this.formErrorMessage = 'Unable to detect club. Please login again.';
      return;
    }

    if (!description || !this.newTransaction.date || amount === null || amount <= 0) {
      this.formErrorMessage = 'Please complete all fields and enter an amount greater than 0.';
      return;
    }

    const payload: CreateTransactionPayload = {
      type: this.toApiType(this.newTransaction.type),
      description,
      date: this.newTransaction.date,
      amount
    };

    this.isSubmitting = true;
    this.formErrorMessage = '';
    this.errorMessage = '';

    if (this.editingTransactionId !== null) {
      const transactionId = this.editingTransactionId;
      const updatePayload: UpdateTransactionPayload = payload;

      this.financeService.updateTransaction(clubId, transactionId, updatePayload).subscribe({
        next: (updatedTransaction) => {
          this.transactions = this.transactions.map(transaction => {
            if (transaction.id !== transactionId) {
              return transaction;
            }

            return this.toTransactionItem(updatedTransaction);
          });

          this.isSubmitting = false;
          this.closeCreateTransactionForm();
        },
        error: (error: unknown) => {
          this.formErrorMessage = `Failed to update transaction. ${this.formatHttpError(error)}`;
          this.isSubmitting = false;
        }
      });
    } else {
      this.financeService.createTransaction(clubId, payload).subscribe({
        next: (createdTransaction) => {
          this.transactions = [this.toTransactionItem(createdTransaction), ...this.transactions];
          this.isSubmitting = false;
          this.closeCreateTransactionForm();
        },
        error: (error: unknown) => {
          this.formErrorMessage = `Failed to create transaction. ${this.formatHttpError(error)}`;
          this.isSubmitting = false;
        }
      });
    }
  }

  editTransaction(transaction: TransactionItem): void {
    this.editingTransactionId = transaction.id;
    this.formErrorMessage = '';
    this.showCreateTransactionForm = true;
    this.newTransaction = {
      type: transaction.type,
      description: transaction.description,
      date: transaction.date,
      amount: transaction.amount
    };
  }

  deleteTransaction(transactionId: number): void {
    const clubId = this.authHelperService.getClubId();

    if (!clubId) {
      this.errorMessage = 'Unable to detect club. Please login again.';
      return;
    }

    this.errorMessage = '';

    this.financeService.deleteTransaction(clubId, transactionId).subscribe({
      next: () => {
        this.transactions = this.transactions.filter(transaction => transaction.id !== transactionId);

        if (this.editingTransactionId === transactionId) {
          this.closeCreateTransactionForm();
        }
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to delete transaction. ${this.formatHttpError(error)}`;
      }
    });
  }

  private loadTransactions(): void {
    const clubId = this.authHelperService.getClubId();

    if (!clubId) {
      this.errorMessage = 'Unable to detect club. Please login again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.financeService.getTransactions(clubId).subscribe({
      next: (transactions) => {
        this.transactions = transactions.map(transaction => this.toTransactionItem(transaction));
        this.isLoading = false;
      },
      error: (error: unknown) => {
        this.errorMessage = `Failed to load transactions from backend. ${this.formatHttpError(error)}`;
        this.isLoading = false;
      }
    });
  }

  get filteredTransactions(): TransactionItem[] {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();

    return this.transactions.filter(transaction => {
      const filterMatch = this.activeFilter === 'all' || transaction.type === this.activeFilter;

      if (!normalizedSearch) {
        return filterMatch;
      }

      const searchMatch = [
        transaction.description,
        transaction.date,
        String(transaction.amount),
        transaction.type
      ].join(' ').toLowerCase().includes(normalizedSearch);

      return filterMatch && searchMatch;
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }

  private toTransactionItem(transaction: TransactionDto): TransactionItem {
    return {
      id: transaction.id,
      type: this.fromApiType(transaction.type),
      description: transaction.description,
      date: transaction.date,
      amount: transaction.amount
    };
  }

  private toApiType(type: TransactionType): ApiTransactionType {
    return type === 'income' ? 'INCOME' : 'EXPENSE';
  }

  private fromApiType(type: ApiTransactionType): TransactionType {
    return type === 'INCOME' ? 'income' : 'expense';
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

  private getInitialTransactionForm(): {
    type: TransactionType;
    description: string;
    date: string;
    amount: number | null;
  } {
    return {
      type: 'expense',
      description: '',
      date: this.getTodayDate(),
      amount: null
    };
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
