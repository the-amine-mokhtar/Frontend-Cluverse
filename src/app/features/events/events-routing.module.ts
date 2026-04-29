import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventHomeComponent } from './components/event-home/event-home.component';
import { EventFormComponent } from './components/event-form/event-form.component';
import { EventParticipantComponent } from './components/event-participant/event-participant.component';
import { EventsRedirectComponent } from './components/events-redirect/events-redirect.component';
import { EventCalendarComponent } from './components/event-calendar/event-calendar.component';
import { EventResourceReservationComponent } from './components/event-resource-reservation/event-resource-reservation.component';
import { CampaignHomeComponent } from './components/campaign-home/campaign-home.component';
const routes: Routes = [

  // 🔥 REDIRECTION INTELLIGENTE
  { path: '', component: EventsRedirectComponent },
{ path: 'campaigns', component: CampaignHomeComponent },
  // 👤 MEMBER
  { path: 'member', component: EventParticipantComponent },

  // 👨‍💼 MANAGER
  { path: 'manage', component: EventHomeComponent },

  { path: 'create', component: EventFormComponent },
  { path: 'edit/:id', component: EventFormComponent },

  // 📅 CALENDAR
  { path: 'calendar', component: EventCalendarComponent },

  // 🔧 RESOURCE RESERVATION
  { path: 'reserve-resources/:eventId', component: EventResourceReservationComponent },

  

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EventsRoutingModule {}