import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { SponsorPaymentRoutingModule } from './sponsor-payment-routing.module';
import { SponsorPaymentPageComponent } from './components/sponsor-payment-page/sponsor-payment-page.component';

@NgModule({
  declarations: [SponsorPaymentPageComponent],
  imports: [SharedModule, SponsorPaymentRoutingModule]
})
export class SponsorPaymentModule { }
