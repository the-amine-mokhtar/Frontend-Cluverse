import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SponsorPaymentPageComponent } from './components/sponsor-payment-page/sponsor-payment-page.component';

const routes: Routes = [
  { path: '', component: SponsorPaymentPageComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SponsorPaymentRoutingModule { }
