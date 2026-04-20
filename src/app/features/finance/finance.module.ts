import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { FinanceRoutingModule } from './finance-routing.module';
import { FinanceHomeComponent } from './components/finance-home/finance-home.component';
import { FinanceBudgetsComponent } from './components/finance-budgets/finance-budgets.component';
import { FinanceTransactionsComponent } from './components/finance-transactions/finance-transactions.component';
import { FinanceSponsorPaymentComponent } from './components/finance-sponsor-payment/finance-sponsor-payment.component';

@NgModule({
  declarations: [
    FinanceHomeComponent,
    FinanceBudgetsComponent,
    FinanceTransactionsComponent,
    FinanceSponsorPaymentComponent
  ],
  imports: [SharedModule, FinanceRoutingModule]
})
export class FinanceModule { }
