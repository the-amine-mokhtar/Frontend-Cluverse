import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { RecruitmentRoutingModule } from './recruitment-routing.module';
import { CampaignListComponent } from './components/campaign-list/campaign-list.component';
import { FormBuilderComponent } from './components/form-builder/form-builder.component';
import { ApplicationsKanbanComponent } from './components/applications-kanban/applications-kanban.component';
import { InterviewResultsComponent } from './components/interview-results/interview-results.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
  declarations: [
    CampaignListComponent,
    FormBuilderComponent,
    ApplicationsKanbanComponent,
    InterviewResultsComponent
  ],
  imports: [
    SharedModule,
    RecruitmentRoutingModule,
    DragDropModule
  ]
})
export class RecruitmentModule { }
