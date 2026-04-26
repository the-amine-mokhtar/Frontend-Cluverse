import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { LogisticsRoutingModule } from './logistics-routing.module';
import { LogisticsHomeComponent } from './components/logistics-home/logistics-home.component';

@NgModule({
  declarations: [LogisticsHomeComponent],
  imports: [SharedModule, LogisticsRoutingModule]
})
export class LogisticsModule { }
