import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ElectionsHomeComponent } from './components/elections-home/elections-home.component';
import { VacantPositionsComponent } from './components/vacant-positions/vacant-positions.component';
import { CreatePositionComponent } from './components/create-position/create-position.component';
import { InterviewSimulatorComponent } from './components/interview-simulator/interview-simulator.component';
import { InterviewReportComponent } from './components/interview-report/interview-report.component';

import { ElectionListComponent } from './components/election-list/election-list.component';
import { CandidateListComponent } from './components/candidate-list/candidate-list.component';
import { VoteListComponent } from './components/vote-list/vote-list.component';
import { PositionListComponent } from './components/position-list/position-list.component';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: ElectionsHomeComponent },
  { path: 'list', component: ElectionListComponent },
  { path: 'candidates', component: CandidateListComponent },
  { path: 'votes', component: VoteListComponent },
  { path: 'positions-list', component: PositionListComponent },
  { path: 'vacant-positions', component: VacantPositionsComponent },
  { path: 'create-position', component: CreatePositionComponent },
  { path: 'interview/:positionId', component: InterviewSimulatorComponent },
  { path: 'report/:sessionId', component: InterviewReportComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ElectionsRoutingModule { }
