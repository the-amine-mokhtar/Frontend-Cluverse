import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { HeroSequenceModule } from './components/hero-sequence/hero-sequence.module';
import { PricingSectionModule } from './components/pricing-section/pricing-section.module';
import { ServicesSectionModule } from './components/services-section/services-section.module';
import { FooterModule } from './components/footer/footer.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HeroSequenceModule,
    PricingSectionModule,
    ServicesSectionModule,
    FooterModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
