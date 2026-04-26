import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FinanceHomeComponent } from './components/finance-home/finance-home.component';
import { FinanceBudgetsComponent } from './components/finance-budgets/finance-budgets.component';
import { FinanceTransactionsComponent } from './components/finance-transactions/finance-transactions.component';
import { FinanceReportsComponent } from './components/finance-reports/finance-reports.component';
import { FinanceSponsorPaymentComponent } from './components/finance-sponsor-payment/finance-sponsor-payment.component';
import { MemberDuesComponent } from './components/member-dues/member-dues.component';
const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    component: FinanceHomeComponent
  },
  {
    path: 'budgets',
    component: FinanceBudgetsComponent
  },
  {
    path: 'transactions',
    component: FinanceTransactionsComponent
  },
  {
    path: 'reports',
    component: FinanceReportsComponent
  },
  {
    path: 'sponsor-payment',
    component: FinanceSponsorPaymentComponent
  },
  {
    path: 'dues',
    component: MemberDuesComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FinanceRoutingModule { }
