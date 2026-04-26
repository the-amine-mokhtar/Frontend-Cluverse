import { NgModule, Component } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LogisticsHomeComponent } from './components/logistics-home/logistics-home.component';
import { LogisticsRequestsComponent } from './components/logistics-requests/logistics-requests.component';
import { LogisticsRequestCreateComponent } from './components/logistics-request-create/logistics-request-create.component';
import { LogisticsDeliveriesComponent } from './components/logistics-deliveries/logistics-deliveries.component';
import { LogisticsInventoryComponent } from './components/logistics-inventory/logistics-inventory.component';
import { LogisticsSuppliersComponent } from './components/logistics-suppliers/logistics-suppliers.component';
import { LogisticsDashboardComponent } from './dashboard/logistics-dashboard.component';
import { LogisticsLayoutComponent } from './layout/logistics-layout.component';
import { ResourceListComponent } from './resources/resource-list.component';
import { ResourceFormComponent } from './resources/resource-form.component';
import { ResourceDetailComponent } from './resources/resource-detail.component';
import { BarcodeSearchComponent } from './components/barcode-search/barcode-search.component';
import { InventoryComponent } from './inventory/inventory.component';
import { VehicleListComponent } from './vehicles/vehicle-list.component';
import { VehicleFormComponent } from './vehicles/vehicle-form.component';
import { VehicleDetailComponent } from './vehicles/vehicle-detail.component';
import { VehicleMaintenanceComponent } from './vehicles/vehicle-maintenance.component';
import { TransportListComponent } from './transports/transport-list.component';
import { TransportFormComponent } from './transports/transport-form.component';
import { TransportDetailComponent } from './transports/transport-detail.component';
import { TransportPlannerComponent } from './components/transport-planner/transport-planner.component';

// -----------------------------------------------------------------------------
// MVP placeholders (replaced in steps 11-21 with real component files).
// Kept here temporarily to avoid circular dependencies between routing/module.
// -----------------------------------------------------------------------------

const routes: Routes = [
  {
    path: '',
    component: LogisticsLayoutComponent,
    children: [
      // MVP logistics module
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: LogisticsDashboardComponent },

      { path: 'resources', component: ResourceListComponent },
      { path: 'resources/new', component: ResourceFormComponent },
      { path: 'resources/:id', component: ResourceDetailComponent },
      { path: 'resources/:id/edit', component: ResourceFormComponent },

      { path: 'barcode-search', component: BarcodeSearchComponent },

      { path: 'inventory/:resourceId', component: InventoryComponent },

      { path: 'vehicles', component: VehicleListComponent },
      { path: 'vehicles/new', component: VehicleFormComponent },
      { path: 'vehicles/:id', component: VehicleDetailComponent },
      { path: 'vehicles/:id/edit', component: VehicleFormComponent },
      { path: 'vehicles/:id/maintenance', component: VehicleMaintenanceComponent },

      { path: 'transports', component: TransportListComponent },
      { path: 'transports/new', component: TransportFormComponent },
      { path: 'transports/:id', component: TransportDetailComponent },
      { path: 'transports/:id/edit', component: TransportFormComponent },

      { path: 'planner', component: TransportPlannerComponent },

      // Legacy screens (kept to avoid breaking existing navigation)
      { path: 'legacy', component: LogisticsHomeComponent },
      { path: 'legacy/requests', component: LogisticsRequestsComponent },
      { path: 'legacy/requests/new', component: LogisticsRequestCreateComponent },
      { path: 'legacy/deliveries', component: LogisticsDeliveriesComponent },
      { path: 'legacy/inventory', component: LogisticsInventoryComponent },
      { path: 'legacy/vehicles', component: LogisticsSuppliersComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LogisticsRoutingModule { }
