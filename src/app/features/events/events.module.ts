import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { EventsRoutingModule } from './events-routing.module';

@NgModule({
  declarations: [],
  imports: [
    SharedModule,
    EventsRoutingModule
  ]
})
export class EventsModule { }
