import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardLayoutComponent } from './components/layout/dashboard-layout/dashboard-layout.component';
import { HomeComponent } from './components/home/home.component';
import { ProfileComponent } from './components/profile/profile.component';
import { MembersComponent } from './components/members/members.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleRouteGuard } from '../../core/guards/role-route.guard';

const routes: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'competencies',
        pathMatch: 'full'
      },
      {
        path: 'home',
        canActivate: [RoleRouteGuard],
        data: { allowedRoles: ['PRESIDENT', 'TREASURER', 'HR_MANAGER', 'EVENT_MANAGER'], redirectTo: '/dashboard/competencies' },
        component: HomeComponent
      },
      {
        path: 'profile',
        component: ProfileComponent
      },
      {
        path: 'members',
        canActivate: [RoleRouteGuard],
        data: { allowedRoles: ['PRESIDENT', 'HR_MANAGER'], redirectTo: '/dashboard/competencies' },
        component: MembersComponent
      },
      {
        path: 'elections',
        canActivate: [RoleRouteGuard],
        data: { allowedRoles: ['PRESIDENT', 'TREASURER', 'HR_MANAGER', 'EVENT_MANAGER'], redirectTo: '/dashboard/competencies' },
        loadChildren: () =>
          import('../elections/elections.module').then(m => m.ElectionsModule)
      },
      {
        path: 'events',
        canActivate: [RoleRouteGuard],
        data: { allowedRoles: ['PRESIDENT', 'EVENT_MANAGER'], redirectTo: '/dashboard/competencies' },
        loadChildren: () =>
          import('../events/events.module').then(m => m.EventsModule)
      },
      {
        path: 'recruitment',
        canActivate: [RoleRouteGuard],
        data: { allowedRoles: ['PRESIDENT', 'HR_MANAGER'], redirectTo: '/dashboard/competencies' },
        loadChildren: () =>
          import('../recruitment/recruitment.module').then(m => m.RecruitmentModule)
      },
      {
        path: 'competencies',
        loadChildren: () =>
          import('../competencies/competencies.module').then(m => m.CompetenciesModule)
      },
      {
        path: 'logistics',
        canActivate: [RoleRouteGuard],
        data: { allowedRoles: ['PRESIDENT', 'EVENT_MANAGER'], redirectTo: '/dashboard/competencies' },
        loadChildren: () =>
          import('../logistics/logistics.module').then(m => m.LogisticsModule)
      },
      {
        path: 'finance',
        canActivate: [RoleRouteGuard],
        data: { allowedRoles: ['PRESIDENT', 'TREASURER'], redirectTo: '/dashboard/competencies' },
        loadChildren: () =>
          import('../finance/finance.module').then(m => m.FinanceModule)
      },
      {
        path: 'sponsorship',
        canActivate: [RoleRouteGuard],
        data: { allowedRoles: ['PRESIDENT', 'TREASURER', 'EVENT_MANAGER'], redirectTo: '/dashboard/competencies' },
        loadChildren: () =>
          import('../sponsorship/sponsorship.module').then(m => m.SponsorshipModule)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }
