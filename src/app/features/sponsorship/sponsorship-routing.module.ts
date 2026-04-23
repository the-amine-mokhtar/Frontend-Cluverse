import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SponsorshipHomeComponent } from './components/sponsorship-home/sponsorship-home.component';

const routes: Routes = [{ path: '', component: SponsorshipHomeComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SponsorshipRoutingModule { }
