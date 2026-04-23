import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CampaignListComponent } from './components/campaign-list/campaign-list.component';
import { FormBuilderComponent } from './components/form-builder/form-builder.component';
import { ApplicationsKanbanComponent } from './components/applications-kanban/applications-kanban.component';

const routes: Routes = [
  { path: '', component: CampaignListComponent },
  { path: ':id/builder', component: FormBuilderComponent },
  { path: ':id/applications', component: ApplicationsKanbanComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RecruitmentRoutingModule { }
