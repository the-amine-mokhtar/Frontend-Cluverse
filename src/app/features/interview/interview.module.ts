import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { InterviewRoutingModule } from './interview-routing.module';
import { InterviewLandingComponent } from './components/interview-landing/interview-landing.component';
import { InterviewRoomComponent } from './components/interview-room/interview-room.component';
import { InterviewCompletedComponent } from './components/interview-completed/interview-completed.component';

@NgModule({
  declarations: [
    InterviewLandingComponent,
    InterviewRoomComponent,
    InterviewCompletedComponent
  ],
  imports: [SharedModule, InterviewRoutingModule]
})
export class InterviewModule {}
