import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { HeroSequenceModule } from './components/hero-sequence/hero-sequence.module';
import { PricingSectionModule } from './components/pricing-section/pricing-section.module';
import { ServicesSectionModule } from './components/services-section/services-section.module';
import { FooterModule } from './components/footer/footer.module';
import { NavbarModule } from './components/navbar/navbar.module';
import { FaqSectionModule } from './components/faq-section/faq-section.module';
import { DevelopingTeamModule } from './components/developing-team/developing-team.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HeroSequenceModule,
    PricingSectionModule,
    ServicesSectionModule,
    FooterModule,
    NavbarModule,
    FaqSectionModule,
    DevelopingTeamModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
