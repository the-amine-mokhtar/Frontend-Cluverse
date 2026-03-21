import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { SponsorshipRoutingModule } from './sponsorship-routing.module';
import { SponsorshipHomeComponent } from './components/sponsorship-home/sponsorship-home.component';

@NgModule({
  declarations: [SponsorshipHomeComponent],
  imports: [SharedModule, SponsorshipRoutingModule]
})
export class SponsorshipModule { }
