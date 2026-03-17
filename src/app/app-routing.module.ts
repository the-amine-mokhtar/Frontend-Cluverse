import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from './shared/shared.module';
import { NotFoundComponent } from './shared/components/not-found/not-found.component';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/landing/landing.module').then(m => m.LandingModule),
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.module').then(m => m.DashboardModule)
  },
  {
    path: 'elections',
    loadChildren: () =>
      import('./features/elections/elections.module').then(m => m.ElectionsModule)
  },
  {
    path: 'recruitment',
    loadChildren: () =>
      import('./features/recruitment/recruitment.module').then(m => m.RecruitmentModule)
  },
  {
    path: 'logistics',
    loadChildren: () =>
      import('./features/logistics/logistics.module').then(m => m.LogisticsModule)
  },
  {
    path: 'sponsorship',
    loadChildren: () =>
      import('./features/sponsorship/sponsorship.module').then(m => m.SponsorshipModule)
  },
  {
    path: 'skills',
    loadChildren: () =>
      import('./features/skills/skills.module').then(m => m.SkillsModule)
  },
  {
    path: 'finance',
    loadChildren: () =>
      import('./features/finance/finance.module').then(m => m.FinanceModule)
  },
  {
    path: 'events',
    loadChildren: () =>
      import('./features/events/events.module').then(m => m.EventsModule)
  },
  {
    path: 'not-found',
    component: NotFoundComponent
  },
  {
    path: '**',
    redirectTo: 'not-found'
  }
];

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
