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

  exportTransactionsToExcel(): void {
    const transactions = this.filteredTransactions;

    if (transactions.length === 0) {
      this.errorMessage = 'No transactions to export with the current filter.';
      return;
    }

    const clubId = this.authHelperService.getClubId();
    const preparedBy = this.authHelperService.getFullName() || 'Club Member';
    const generatedAt = new Date();
    const reportDate = generatedAt.toLocaleDateString();
    const reportTime = generatedAt.toLocaleTimeString();

    const rows = transactions
      .map((transaction) => {
        const signedAmount = transaction.type === 'income' ? transaction.amount : -transaction.amount;

        return `
          <tr>
            <td>${this.escapeHtml(transaction.type.toUpperCase())}</td>
            <td>${this.escapeHtml(transaction.description)}</td>
            <td>${this.escapeHtml(transaction.date)}</td>
            <td style="mso-number-format:'0.00'">${signedAmount.toFixed(2)}</td>
          </tr>
        `;
      })
      .join('');

    const totalNet = transactions.reduce((sum, transaction) => {
      return sum + (transaction.type === 'income' ? transaction.amount : -transaction.amount);
    }, 0);

    const htmlWorkbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Segoe UI, Arial, sans-serif; color: #111827; }
            .meta { margin-bottom: 16px; }
            .meta h2 { margin: 0 0 6px; color: #0f172a; }
            .meta p { margin: 0; font-size: 12px; color: #4b5563; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; }
            th { background: #e2e8f0; text-align: left; }
            .total { margin-top: 12px; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="meta">
            <h2>Transactions Export - Club #${clubId}</h2>
            <p>Prepared by: ${this.escapeHtml(preparedBy)}</p>
            <p>Generated on: ${this.escapeHtml(reportDate)} ${this.escapeHtml(reportTime)}</p>
            <p>Filter: ${this.escapeHtml(this.activeFilter.toUpperCase())} | Search: ${this.escapeHtml(this.searchTerm || 'None')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Date</th>
                <th>Amount (USD)</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">Net Total (USD): ${totalNet.toFixed(2)}</div>
        </body>
      </html>
    `;

    const blob = new Blob([htmlWorkbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const downloadLink = document.createElement('a');
    const safeDate = generatedAt.toISOString().slice(0, 10);
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `club-${clubId}-transactions-${safeDate}.xls`;
    downloadLink.click();
    URL.revokeObjectURL(downloadLink.href);
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

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
