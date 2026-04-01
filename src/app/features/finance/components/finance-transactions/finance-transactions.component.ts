import { Component } from '@angular/core';

type TransactionType = 'income' | 'expense';
type TransactionFilter = 'all' | TransactionType;

interface TransactionItem {
  type: TransactionType;
  description: string;
  category: string;
  date: string;
  addedBy: string;
  amount: number;
}

@Component({
  selector: 'app-finance-transactions',
  templateUrl: './finance-transactions.component.html',
  styleUrl: './finance-transactions.component.scss'
})
export class FinanceTransactionsComponent {
  searchTerm = '';
  activeFilter: TransactionFilter = 'all';

  readonly transactions: TransactionItem[] = [
    { type: 'expense', description: 'Annual gala venue deposit', category: 'Events', date: '2026-03-01', addedBy: 'Sarah Chen', amount: 1500 },
    { type: 'income', description: 'Membership dues collection', category: 'Membership', date: '2026-02-28', addedBy: 'James Wu', amount: 4200 },
    { type: 'expense', description: 'DJ equipment rental', category: 'Events', date: '2026-02-25', addedBy: 'Sarah Chen', amount: 350 },
    { type: 'income', description: 'Sponsorship - TechCorp', category: 'Sponsorship', date: '2026-02-20', addedBy: 'James Wu', amount: 2000 },
    { type: 'expense', description: 'Flyer printing', category: 'Marketing', date: '2026-02-18', addedBy: 'Maria Lopez', amount: 120 },
    { type: 'expense', description: 'Bus rental for field trip', category: 'Travel', date: '2026-02-15', addedBy: 'Sarah Chen', amount: 800 },
    { type: 'income', description: 'Bake sale revenue', category: 'Fundraising', date: '2026-02-12', addedBy: 'Maria Lopez', amount: 650 },
    { type: 'expense', description: 'Office supplies', category: 'Operations', date: '2026-02-10', addedBy: 'James Wu', amount: 85 },
    { type: 'expense', description: 'Workshop materials', category: 'Events', date: '2026-02-08', addedBy: 'Sarah Chen', amount: 200 },
    { type: 'income', description: 'Donation from alumni', category: 'Donations', date: '2026-02-05', addedBy: 'James Wu', amount: 1000 }
  ];

  setFilter(filter: TransactionFilter): void {
    this.activeFilter = filter;
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
        transaction.category,
        transaction.date,
        transaction.addedBy
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
}
