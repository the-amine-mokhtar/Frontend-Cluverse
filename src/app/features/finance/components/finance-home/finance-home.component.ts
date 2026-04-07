import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { ApiService } from '../../../../core/services/api.service';
import {
  BudgetDto,
  FinanceService,
  SponsorDto,
  SponsorshipDto,
  TransactionDto
} from '../../../../core/services/finance.service';

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
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly financeService: FinanceService,
    private readonly authHelperService: AuthHelperService,
    private readonly apiService: ApiService
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

  onExerciseYearChange(year: number | string): void {
    const parsed = Number(year);
    if (!Number.isFinite(parsed)) {
      return;
    }

    this.selectedExerciseYear = parsed;
    this.refreshDashboardView();
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
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background:#f6f6f6; margin:0; padding:26px; color:#111827; }
          .sheet { max-width:900px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:28px; }
          .top { display:flex; justify-content:space-between; gap:12px; border-bottom:2px solid #111827; padding-bottom:12px; }
          .brand { display:flex; align-items:center; gap:10px; }
          .brand h1 { margin:0; font-size:26px; letter-spacing:2px; color:${safeAccent}; }
          .brand small { color:#6b7280; }
          .doc-title { text-align:right; }
          .doc-title h2 { margin:0; font-size:46px; letter-spacing:2px; color:${safeAccent}; }
          .meta { margin-top:10px; display:flex; justify-content:space-between; gap:16px; font-size:13px; }
          .box { width:48%; }
          .box h3 { margin:0 0 6px; color:${safeAccent}; font-size:14px; text-transform:uppercase; }
          table { width:100%; border-collapse:collapse; margin-top:16px; }
          th, td { border-bottom:1px solid #d1d5db; padding:9px 6px; font-size:13px; }
          th { text-align:left; color:${safeAccent}; }
          .totals { margin-top:16px; margin-left:auto; width:340px; }
          .line { display:flex; justify-content:space-between; margin:5px 0; }
          .line.total { border-top:2px solid #111827; padding-top:7px; font-size:18px; font-weight:700; }
          .note { margin-top:18px; color:#6b7280; font-size:12px; }
          @media print { body { background:#fff; padding:0; } .sheet { border:none; border-radius:0; } }
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
              <div><strong>Facture N°</strong> ${this.escapeHtml(this.invoiceNumber)}</div>
            </div>
          </div>

          <div class="meta">
            <div class="box">
              <h3>Emetteur</h3>
              <div>${safeClubName}</div>
              <div>Date: ${this.escapeHtml(issueDate)}</div>
              <div>Echeance: ${this.escapeHtml(dueDate)}</div>
            </div>
            <div class="box" style="text-align:right;">
              <h3>Destinataire</h3>
              <div>${sponsorName}</div>
              <div>${sponsorEmail}</div>
              <div>${sponsorPhone}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align:right;">Prix unitaire</th>
                <th style="text-align:center;">Quantite</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4">Aucune ligne disponible.</td></tr>'}
            </tbody>
          </table>

          <div class="totals">
            <div class="line"><span>TOTAL HT:</span><strong>${this.formatCurrency(subtotal)}</strong></div>
            <div class="line"><span>REMISE ${this.invoiceDiscount}%:</span><strong>- ${this.formatCurrency(discountAmount)}</strong></div>
            <div class="line"><span>TVA ${this.invoiceVatRate}%:</span><strong>${this.formatCurrency(vatAmount)}</strong></div>
            <div class="line total"><span>TOTAL TTC:</span><strong>${this.formatCurrency(totalTtc)}</strong></div>
          </div>

          <p class="note">Facture basee sur les contrats de sponsoring et les donations (transactions INCOME) associees a ${sponsorName} pour l'exercice ${this.selectedExerciseYear}.</p>
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
        <style>
          body { font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #0f172a; margin: 24px; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          h2 { margin: 20px 0 8px; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          .brand-head { display:flex; align-items:center; justify-content:space-between; gap:14px; border:1px solid #e2e8f0; border-left:6px solid ${safePrimary}; border-radius:12px; padding:12px; background: linear-gradient(90deg, ${safePrimary}15, ${safeAccent}08); }
          .brand-title { display:flex; align-items:center; gap:12px; }
          .brand-club { color:#334155; font-weight:600; font-size:14px; }
          .meta { color: #475569; font-size: 13px; margin-bottom: 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
          .line { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
          .line strong { font-weight: 700; }
          .income { color: #15803d; }
          .expense { color: #b91c1c; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 13px; }
          th { background: #f8fafc; text-align: left; }
          .footer { margin-top: 18px; color: #64748b; font-size: 12px; }
          @media print {
            body { margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="brand-head">
          <div class="brand-title">
            ${logoHtml}
            <div>
              <h1>${safeTitle}</h1>
              <div class="brand-club">${safeClubName}</div>
            </div>
          </div>
          <div class="meta">Exercice: ${this.selectedExerciseYear}<br/>Genere le: ${generatedAt.toLocaleString('fr-FR')}</div>
        </div>

        <h2>Bilan Financier</h2>
        <div class="grid">
          <div class="card">
            <div class="line"><span>Actif - Tresorerie</span><strong>${this.formatCurrency(this.closingCash)}</strong></div>
            <div class="line"><span>Actif - Creances</span><strong>N/A</strong></div>
          </div>
          <div class="card">
            <div class="line"><span>Passif - Dettes</span><strong>N/A</strong></div>
            <div class="line"><span>Passif - Fonds propres (estime)</span><strong>${this.formatCurrency(this.equityTotal)}</strong></div>
          </div>
        </div>

        <h2>Compte de Resultat</h2>
        <div class="card">
          <div class="line"><span>Recettes</span><strong class="income">${this.formatCurrency(this.incomeTotal)}</strong></div>
          <div class="line"><span>Depenses</span><strong class="expense">${this.formatCurrency(this.expenseTotal)}</strong></div>
          <div class="line"><span>Resultat net</span><strong class="${this.netResult >= 0 ? 'income' : 'expense'}">${netResultSign}${this.formatCurrency(this.absValue(this.netResult))}</strong></div>
        </div>

        <h2>Rapport de Tresorerie</h2>
        <div class="card">
          <div class="line"><span>Solde initial</span><strong>${this.formatCurrency(this.openingCash)}</strong></div>
          <div class="line"><span>Entrees</span><strong class="income">${this.formatCurrency(this.incomeTotal)}</strong></div>
          <div class="line"><span>Sorties</span><strong class="expense">${this.formatCurrency(this.expenseTotal)}</strong></div>
          <div class="line"><span>Solde final calcule</span><strong>${this.formatCurrency(this.closingCash)}</strong></div>
          <div class="line"><span>Ecart de rapprochement</span><strong>${reconciliationLabel}</strong></div>
          <div class="line"><span>Projection nette / mois</span><strong class="${this.projectedNetFlow >= 0 ? 'income' : 'expense'}">${projectedNetSign}${this.formatCurrency(this.absValue(this.projectedNetFlow))}</strong></div>
          <div class="line"><span>Solde projete a ${this.forecastMonths} mois</span><strong>${this.formatCurrency(this.projectedClosingCash)}</strong></div>
        </div>

        <h2>Extrait des Dernieres Transactions</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th style="text-align:right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="4">Aucune transaction disponible sur cet exercice.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">Rapport genere depuis le module Finance - Cluverse</div>
      </body>
      </html>
    `;

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
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
  }

  private get exerciseTransactions(): TransactionDto[] {
    return this.allTransactions.filter((transaction) => {
      const d = new Date(transaction.date);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === this.selectedExerciseYear;
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
