import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { ElectionsRoutingModule } from './elections-routing.module';
import { ElectionsHomeComponent } from './components/elections-home/elections-home.component';
import { VacantPositionsComponent } from './components/vacant-positions/vacant-positions.component';
import { CreatePositionComponent } from './components/create-position/create-position.component';
import { InterviewSimulatorComponent } from './components/interview-simulator/interview-simulator.component';
import { InterviewReportComponent } from './components/interview-report/interview-report.component';

@NgModule({
  declarations: [
    ElectionsHomeComponent,
    VacantPositionsComponent,
    CreatePositionComponent,
    InterviewSimulatorComponent,
    InterviewReportComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    FormsModule,
    ElectionsRoutingModule
  ]
})
export class ElectionsModule { }
