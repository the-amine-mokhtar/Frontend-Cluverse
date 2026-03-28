import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LogisticsHomeComponent } from './components/logistics-home/logistics-home.component';
import { LogisticsRequestsComponent } from './components/logistics-requests/logistics-requests.component';
import { LogisticsRequestCreateComponent } from './components/logistics-request-create/logistics-request-create.component';
import { LogisticsDeliveriesComponent } from './components/logistics-deliveries/logistics-deliveries.component';
import { LogisticsInventoryComponent } from './components/logistics-inventory/logistics-inventory.component';
import { LogisticsSuppliersComponent } from './components/logistics-suppliers/logistics-suppliers.component';

const routes: Routes = [
  { path: '', component: LogisticsHomeComponent },
  { path: 'requests', component: LogisticsRequestsComponent },
  { path: 'requests/new', component: LogisticsRequestCreateComponent },
  { path: 'deliveries', component: LogisticsDeliveriesComponent },
  { path: 'inventory', component: LogisticsInventoryComponent },
  { path: 'vehicles', component: LogisticsSuppliersComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LogisticsRoutingModule { }
