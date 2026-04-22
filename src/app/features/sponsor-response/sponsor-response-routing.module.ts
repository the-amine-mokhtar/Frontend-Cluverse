import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SponsorResponseComponent } from './components/sponsor-response/sponsor-response.component';

const routes: Routes = [
  { path: '', component: SponsorResponseComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SponsorResponseRoutingModule { }
