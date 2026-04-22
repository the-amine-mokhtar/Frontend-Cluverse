import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { SponsorResponseRoutingModule } from './sponsor-response-routing.module';
import { SponsorResponseComponent } from './components/sponsor-response/sponsor-response.component';

@NgModule({
  declarations: [SponsorResponseComponent],
  imports: [SharedModule, SponsorResponseRoutingModule]
})
export class SponsorResponseModule { }
