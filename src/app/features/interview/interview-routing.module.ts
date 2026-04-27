import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InterviewLandingComponent } from './components/interview-landing/interview-landing.component';
import { InterviewRoomComponent } from './components/interview-room/interview-room.component';
import { InterviewCompletedComponent } from './components/interview-completed/interview-completed.component';

const routes: Routes = [
  { path: 'done', component: InterviewCompletedComponent },
  { path: ':uniqueLink', component: InterviewLandingComponent },
  { path: ':uniqueLink/room', component: InterviewRoomComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InterviewRoutingModule {}
