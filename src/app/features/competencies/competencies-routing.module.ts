import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CompetenciesEntryComponent } from './components/competencies-entry/competencies-entry.component';
import { CompetenciesHomeComponent } from './components/competencies-home/competencies-home.component';
import { MemberCompetenciesComponent } from './components/member-competencies/member-competencies.component';
import { CompetenciesInsightsComponent } from './components/competencies-insights/competencies-insights.component';
import { RoleRouteGuard } from '../../core/guards/role-route.guard';

const routes: Routes = [
  { path: '', component: CompetenciesEntryComponent },
  {
    path: 'home',
    canActivate: [RoleRouteGuard],
    data: { allowedRoles: ['PRESIDENT', 'TREASURER', 'HR_MANAGER', 'EVENT_MANAGER'], redirectTo: '/dashboard/competencies/member-competencies' },
    component: CompetenciesHomeComponent
  },
  {
    path: 'member-competencies',
    canActivate: [RoleRouteGuard],
    data: { allowedRoles: ['MEMBER'], redirectTo: '/dashboard/competencies/home' },
    component: MemberCompetenciesComponent
  },
  {
    path: 'insights',
    canActivate: [RoleRouteGuard],
    data: { allowedRoles: ['PRESIDENT', 'TREASURER', 'HR_MANAGER', 'EVENT_MANAGER'], redirectTo: '/dashboard/competencies/member-competencies' },
    component: CompetenciesInsightsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CompetenciesRoutingModule { }
