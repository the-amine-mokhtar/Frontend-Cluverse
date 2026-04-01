import { Component } from '@angular/core';

interface BudgetItem {
  title: string;
  department: string;
  spent: number;
  total: number;
}

type TransactionType = 'income' | 'expense';

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
export class FinanceHomeComponent {
  readonly budgetItems: BudgetItem[] = [
    { title: 'Events & Activities', department: 'Events', spent: 3200, total: 5000 },
    { title: 'Equipment & Supplies', department: 'Operations', spent: 1450, total: 2000 },
    { title: 'Marketing & Outreach', department: 'Marketing', spent: 800, total: 1500 }
  ];

  readonly recentTransactions: TransactionItem[] = [
    { type: 'expense', description: 'Annual gala venue deposit', category: 'Events', date: '2026-03-01', addedBy: 'Sarah Chen', amount: 1500 },
    { type: 'income', description: 'Membership dues collection', category: 'Membership', date: '2026-02-28', addedBy: 'James Wu', amount: 4200 },
    { type: 'expense', description: 'DJ equipment rental', category: 'Events', date: '2026-02-25', addedBy: 'Sarah Chen', amount: 350 },
    { type: 'income', description: 'Sponsorship - TechCorp', category: 'Sponsorship', date: '2026-02-20', addedBy: 'James Wu', amount: 2000 },
    { type: 'expense', description: 'Flyer printing', category: 'Marketing', date: '2026-02-18', addedBy: 'Maria Lopez', amount: 120 }
  ];

  get totalBudget(): number {
    return this.budgetItems.reduce((sum, item) => sum + item.total, 0);
  }

  get totalSpent(): number {
    return this.budgetItems.reduce((sum, item) => sum + item.spent, 0);
  }

  get netFlow(): number {
    return this.recentTransactions.reduce((sum, transaction) => {
      return transaction.type === 'income'
        ? sum + transaction.amount
        : sum - transaction.amount;
    }, 0);
  }

  get absoluteNetFlow(): number {
    return Math.abs(this.netFlow);
  }

  utilization(item: BudgetItem): number {
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
