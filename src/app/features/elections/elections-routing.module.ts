import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ElectionsHomeComponent } from './components/elections-home/elections-home.component';
import { VacantPositionsComponent } from './components/vacant-positions/vacant-positions.component';
import { InterviewSimulatorComponent } from './components/interview-simulator/interview-simulator.component';
import { InterviewReportComponent } from './components/interview-report/interview-report.component';

import { ElectionListComponent } from './components/election-list/election-list.component';
import { ElectionDashboardComponent } from './components/election-dashboard/election-dashboard.component';
import { CandidateListComponent } from './components/candidate-list/candidate-list.component';
import { VoteListComponent } from './components/vote-list/vote-list.component';
import { PositionListComponent } from './components/position-list/position-list.component';

import { ElectionFormComponent } from './components/election-form/election-form.component';
import { CandidateFormComponent } from './components/candidate-form/candidate-form.component';
import { PositionFormComponent } from './components/position-form/position-form.component';
import { VoteFormComponent } from './components/vote-form/vote-form.component';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: ElectionsHomeComponent },
  { path: 'dashboard', component: ElectionDashboardComponent },
  { path: 'list', component: ElectionListComponent },
  { path: 'elections/form', component: ElectionFormComponent },
  { path: 'elections/form/:id', component: ElectionFormComponent },
  { path: 'candidates', component: CandidateListComponent },
  { path: 'candidates/form', component: CandidateFormComponent },
  { path: 'candidates/form/:id', component: CandidateFormComponent },
  { path: 'votes', component: VoteListComponent },
  { path: 'votes/form', component: VoteFormComponent },
  { path: 'votes/form/:id', component: VoteFormComponent },
  { path: 'positions-list', component: PositionListComponent },
  { path: 'positions/form', component: PositionFormComponent },
  { path: 'positions/form/:id', component: PositionFormComponent },
  { path: 'vacant-positions', component: VacantPositionsComponent },
  { path: 'interview/:positionId', component: InterviewSimulatorComponent },
  { path: 'report/:sessionId', component: InterviewReportComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ElectionsRoutingModule { }
