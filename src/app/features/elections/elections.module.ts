import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { ElectionsRoutingModule } from './elections-routing.module';
import { ElectionsHomeComponent } from './components/elections-home/elections-home.component';

@NgModule({
  declarations: [
    ElectionsHomeComponent
  ],
  imports: [
    SharedModule,
    ElectionsRoutingModule
  ]
})
export class ElectionsModule { }
