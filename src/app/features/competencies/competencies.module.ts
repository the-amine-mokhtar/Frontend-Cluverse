import { NgModule } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { SharedModule } from '../../shared/shared.module';
import { CompetenciesRoutingModule } from './competencies-routing.module';
import { CompetenciesEntryComponent } from './components/competencies-entry/competencies-entry.component';
import { CompetenciesHomeComponent } from './components/competencies-home/competencies-home.component';
import { CompetenciesInsightsComponent } from './components/competencies-insights/competencies-insights.component';
import { MemberCompetenciesComponent } from './components/member-competencies/member-competencies.component';
import { SessionsDashboardComponent } from './components/sessions-dashboard/sessions-dashboard.component';

@NgModule({
  declarations: [CompetenciesEntryComponent, CompetenciesHomeComponent, CompetenciesInsightsComponent, MemberCompetenciesComponent, SessionsDashboardComponent],
  imports: [SharedModule, CompetenciesRoutingModule, DragDropModule]
})
export class CompetenciesModule { }
