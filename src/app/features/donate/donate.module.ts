import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { DonateRoutingModule } from './donate-routing.module';
import { DonatePageComponent } from './components/donate-page/donate-page.component';

@NgModule({
  declarations: [DonatePageComponent],
  imports: [SharedModule, DonateRoutingModule]
})
export class DonateModule {}
