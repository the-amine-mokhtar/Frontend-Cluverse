import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CompetenciesHomeComponent } from './components/competencies-home/competencies-home.component';
import { MemberCompetenciesComponent } from './components/member-competencies/member-competencies.component';
import { CompetenciesInsightsComponent } from './components/competencies-insights/competencies-insights.component';

const routes: Routes = [
  { path: '', component: CompetenciesHomeComponent },
  { path: 'member-competencies', component: MemberCompetenciesComponent },
  { path: 'insights', component: CompetenciesInsightsComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CompetenciesRoutingModule { }
