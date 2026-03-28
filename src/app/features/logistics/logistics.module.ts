import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { LogisticsRoutingModule } from './logistics-routing.module';
import { LogisticsHomeComponent } from './components/logistics-home/logistics-home.component';
import { LogisticsRequestsComponent } from './components/logistics-requests/logistics-requests.component';
import { LogisticsRequestCreateComponent } from './components/logistics-request-create/logistics-request-create.component';
import { LogisticsDeliveriesComponent } from './components/logistics-deliveries/logistics-deliveries.component';
import { LogisticsInventoryComponent } from './components/logistics-inventory/logistics-inventory.component';
import { LogisticsSuppliersComponent } from './components/logistics-suppliers/logistics-suppliers.component';

@NgModule({
  declarations: [
    LogisticsHomeComponent,
    LogisticsRequestsComponent,
    LogisticsRequestCreateComponent,
    LogisticsDeliveriesComponent,
    LogisticsInventoryComponent,
    LogisticsSuppliersComponent
  ],
  imports: [SharedModule, LogisticsRoutingModule]
})
export class LogisticsModule { }
