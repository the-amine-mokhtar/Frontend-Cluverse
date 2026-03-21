import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardLayoutComponent } from './components/layout/dashboard-layout/dashboard-layout.component';
import { HomeComponent } from './components/home/home.component';
import { ProfileComponent } from './components/profile/profile.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        component: HomeComponent
      },
      {
        path: 'profile',
        component: ProfileComponent
      },
      {
        path: 'elections',
        loadChildren: () =>
          import('../elections/elections.module').then(m => m.ElectionsModule)
      },
      {
        path: 'events',
        loadChildren: () =>
          import('../events/events.module').then(m => m.EventsModule)
      },
      {
        path: 'recruitment',
        loadChildren: () =>
          import('../recruitment/recruitment.module').then(m => m.RecruitmentModule)
      },
      {
        path: 'skills',
        loadChildren: () =>
          import('../skills/skills.module').then(m => m.SkillsModule)
      },
      {
        path: 'logistics',
        loadChildren: () =>
          import('../logistics/logistics.module').then(m => m.LogisticsModule)
      },
      {
        path: 'finance',
        loadChildren: () =>
          import('../finance/finance.module').then(m => m.FinanceModule)
      },
      {
        path: 'sponsorship',
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
