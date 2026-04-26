import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { FinanceRoutingModule } from './finance-routing.module';
import { FinanceHomeComponent } from './components/finance-home/finance-home.component';
import { FinanceBudgetsComponent } from './components/finance-budgets/finance-budgets.component';
import { FinanceTransactionsComponent } from './components/finance-transactions/finance-transactions.component';
import { TreasurerChatWidgetComponent } from './components/treasurer-chat-widget/treasurer-chat-widget.component';
import { FinanceReportsComponent } from './components/finance-reports/finance-reports.component';

@NgModule({
  declarations: [
    FinanceHomeComponent,
    FinanceBudgetsComponent,
    FinanceTransactionsComponent,
    TreasurerChatWidgetComponent,
    FinanceReportsComponent
  ],
  imports: [SharedModule, FinanceRoutingModule]
})
export class FinanceModule { }
