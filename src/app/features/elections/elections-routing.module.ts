import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ElectionsHomeComponent } from './components/elections-home/elections-home.component';
import { VacantPositionsComponent } from './components/vacant-positions/vacant-positions.component';
import { CreatePositionComponent } from './components/create-position/create-position.component';
import { InterviewSimulatorComponent } from './components/interview-simulator/interview-simulator.component';
import { InterviewReportComponent } from './components/interview-report/interview-report.component';

const routes: Routes = [
  { path: '', redirectTo: 'vacant-positions', pathMatch: 'full' },
  { path: 'home', component: ElectionsHomeComponent },
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
