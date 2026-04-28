import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { FinanceRoutingModule } from './finance-routing.module';
import { FinanceHomeComponent } from './components/finance-home/finance-home.component';
import { FinanceBudgetsComponent } from './components/finance-budgets/finance-budgets.component';
import { FinanceTransactionsComponent } from './components/finance-transactions/finance-transactions.component';
import { TreasurerChatWidgetComponent } from './components/treasurer-chat-widget/treasurer-chat-widget.component';
import { FinanceReportsComponent } from './components/finance-reports/finance-reports.component';
import { FinanceSponsorPaymentComponent } from './components/finance-sponsor-payment/finance-sponsor-payment.component';
import { MemberDuesComponent } from './components/member-dues/member-dues.component';
import { FinanceAlertsComponent } from './components/finance-alerts/finance-alerts.component';

@NgModule({
  declarations: [
    FinanceHomeComponent,
    FinanceBudgetsComponent,
    FinanceTransactionsComponent,
    TreasurerChatWidgetComponent,
    FinanceReportsComponent,
    FinanceSponsorPaymentComponent,
    MemberDuesComponent,
    FinanceAlertsComponent
  ],
  imports: [SharedModule, FinanceRoutingModule]
})
export class FinanceModule { }
