import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NotFoundComponent } from './shared/components/not-found/not-found.component';
import { AuthGuard } from './core/guards/auth.guard';

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
    path: 'logistics',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./features/logistics/logistics.module').then(m => m.LogisticsModule)
  },
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./features/dashboard/dashboard.module').then(m => m.DashboardModule)
  },
  {
    path: 'apply',
    loadChildren: () =>
      import('./features/apply/apply.module').then(m => m.ApplyModule)
  },
  {
    path: 'verify',
    loadChildren: () =>
      import('./features/verify/verify.module').then(m => m.VerifyModule),
  },
  {
    path: 'sponsor-response',
    loadChildren: () =>
      import('./features/sponsor-response/sponsor-response.module').then(m => m.SponsorResponseModule)
  },
  {
    path: 'interview',
    loadChildren: () =>
      import('./features/interview/interview.module').then(m => m.InterviewModule)
  },
  {
    path: 'not-found',
    component: NotFoundComponent
  },
  {
    path: '**',
    component: NotFoundComponent
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
