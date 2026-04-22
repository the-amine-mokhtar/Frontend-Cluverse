import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { FinanceRoutingModule } from './finance-routing.module';
import { FinanceHomeComponent } from './components/finance-home/finance-home.component';

@NgModule({
  declarations: [FinanceHomeComponent],
  imports: [SharedModule, FinanceRoutingModule]
})
export class FinanceModule { }
