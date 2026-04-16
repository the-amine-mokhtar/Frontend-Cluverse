import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { CompetenciesRoutingModule } from './competencies-routing.module';
import { CompetenciesHomeComponent } from './components/competencies-home/competencies-home.component';
import { CompetenciesInsightsComponent } from './components/competencies-insights/competencies-insights.component';
import { MemberCompetenciesComponent } from './components/member-competencies/member-competencies.component';

@NgModule({
  declarations: [CompetenciesHomeComponent, CompetenciesInsightsComponent, MemberCompetenciesComponent],
  imports: [SharedModule, CompetenciesRoutingModule]
})
export class CompetenciesModule { }
