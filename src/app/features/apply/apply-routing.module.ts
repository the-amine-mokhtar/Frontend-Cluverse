import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PublicApplicationComponent } from './components/public-application/public-application.component';

const routes: Routes = [
  { path: ':publicLink', component: PublicApplicationComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ApplyRoutingModule { }
