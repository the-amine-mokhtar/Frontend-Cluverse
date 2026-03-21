import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { EventsRoutingModule } from './events-routing.module';
import { EventsHomeComponent } from './components/events-home/events-home.component';

@NgModule({
  declarations: [
    EventsHomeComponent
  ],
  imports: [
    SharedModule,
    EventsRoutingModule
  ]
})
export class EventsModule { }
