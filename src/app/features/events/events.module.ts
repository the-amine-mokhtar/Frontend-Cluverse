import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { EventsRoutingModule } from './events-routing.module';
import { EventHomeComponent } from './components/event-home/event-home.component';
import { EventFormComponent } from './components/event-form/event-form.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { EventParticipantComponent } from './components/event-participant/event-participant.component';
import { EventMap3DComponent } from './components/event-map-3d/event-map-3d.component';
import { CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { EventCalendarComponent } from './components/event-calendar/event-calendar.component';
import { EventResourceReservationComponent } from './components/event-resource-reservation/event-resource-reservation.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CampaignHomeComponent, ConfirmDeleteCampaignDialog } from './components/campaign-home/campaign-home.component';
import { ReminderStatusComponent } from './components/reminder-status/reminder-status.component';
import { MatSpinnerStubComponent } from './components/mat-spinner-stub/mat-spinner-stub.component';

@NgModule({
  declarations: [
    EventHomeComponent,
    EventFormComponent,
    EventParticipantComponent,
    EventMap3DComponent,
    EventCalendarComponent,
    EventResourceReservationComponent,
    CampaignHomeComponent,
    ReminderStatusComponent,
    MatSpinnerStubComponent,
    ConfirmDeleteCampaignDialog
  ],
  imports: [
    CommonModule,
    SharedModule,
    EventsRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatListModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,       // ← ADDED
    MatSlideToggleModule,   // ← ADDED
    MatDialogModule
  ]
})
export class EventsModule { }