import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { LayoutModule } from '../../shared/layout/layout.module';
import { LogisticsRoutingModule } from './logistics-routing.module';
import { LogisticsHomeComponent } from './components/logistics-home/logistics-home.component';
import { LogisticsRequestsComponent } from './components/logistics-requests/logistics-requests.component';
import { LogisticsRequestCreateComponent } from './components/logistics-request-create/logistics-request-create.component';
import { LogisticsDeliveriesComponent } from './components/logistics-deliveries/logistics-deliveries.component';
import { LogisticsInventoryComponent } from './components/logistics-inventory/logistics-inventory.component';
import { LogisticsSuppliersComponent } from './components/logistics-suppliers/logistics-suppliers.component';
import { LogisticsLayoutComponent } from './layout/logistics-layout.component';

import { InventoryComponent } from './inventory/inventory.component';
import { VehicleListComponent } from './vehicles/vehicle-list.component';
import { VehicleFormComponent } from './vehicles/vehicle-form.component';
import { VehicleDetailComponent } from './vehicles/vehicle-detail.component';
import { VehicleMaintenanceComponent } from './vehicles/vehicle-maintenance.component';
import { TransportListComponent } from './transports/transport-list.component';
import { TransportFormComponent } from './transports/transport-form.component';
import { TransportDetailComponent } from './transports/transport-detail.component';
import { TransportMapComponent } from './transports/transport-map.component';
import { TransportPredictionComponent } from './transports/transport-prediction.component';
import { LogisticsDashboardComponent } from './dashboard/logistics-dashboard.component';
import { ResourceListComponent } from './resources/resource-list.component';
import { ResourceFormComponent } from './resources/resource-form.component';
import { ResourceDetailComponent } from './resources/resource-detail.component';
import { TransportPlannerComponent } from './components/transport-planner/transport-planner.component';
import { VoiceAssistantComponent } from './components/voice-assistant/voice-assistant.component';
import { BackButtonComponent } from './shared/back-button.component';

@NgModule({
  declarations: [
    LogisticsLayoutComponent,
    // MVP placeholders (replaced in steps 11-21)
    LogisticsDashboardComponent,
    ResourceListComponent,
    ResourceFormComponent,
    ResourceDetailComponent,
    InventoryComponent,
    VehicleListComponent,
    VehicleFormComponent,
    VehicleDetailComponent,
    VehicleMaintenanceComponent,
    TransportListComponent,
    TransportFormComponent,
    TransportDetailComponent,
    TransportPredictionComponent,
    TransportPlannerComponent,
    VoiceAssistantComponent,

    // Legacy logistics screens
    LogisticsHomeComponent,
    LogisticsRequestsComponent,
    LogisticsRequestCreateComponent,
    LogisticsDeliveriesComponent,
    LogisticsInventoryComponent,
    LogisticsSuppliersComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule,
    LayoutModule,
    LogisticsRoutingModule,
    TransportMapComponent,
    BackButtonComponent
  ]
})
export class LogisticsModule { }
