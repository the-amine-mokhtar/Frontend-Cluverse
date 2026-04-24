import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SponsorshipHomeComponent } from './components/sponsorship-home/sponsorship-home.component';

const routes: Routes = [
  { path: '', redirectTo: 'sponsors', pathMatch: 'full' },
  { path: 'sponsors', component: SponsorshipHomeComponent, data: { section: 'SPONSORS' } },
  { path: 'sponsorships', component: SponsorshipHomeComponent, data: { section: 'SPONSORSHIPS' } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SponsorshipRoutingModule { }
