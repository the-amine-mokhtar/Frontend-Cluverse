import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { LandingRoutingModule } from './landing-routing.module';
import { LandingComponent } from './landing.component';

import { NavbarComponent } from './components/navbar/navbar.component';
import { HeroSequenceComponent } from './components/hero-sequence/hero-sequence.component';
import { ServicesSectionComponent } from './components/services-section/services-section.component';
import { ServiceDetailComponent } from './components/service-detail/service-detail.component';
import { TrustedByComponent } from './components/trusted-by/trusted-by.component';
import { PricingSectionComponent } from './components/pricing-section/pricing-section.component';
import { FaqSectionComponent } from './components/faq-section/faq-section.component';
import { DevelopingTeamComponent } from './components/developing-team/developing-team.component';
import { FooterComponent } from './components/footer/footer.component';

@NgModule({
  declarations: [
    LandingComponent,
    NavbarComponent,
    HeroSequenceComponent,
    ServicesSectionComponent,
    ServiceDetailComponent,
    TrustedByComponent,
    PricingSectionComponent,
    FaqSectionComponent,
    DevelopingTeamComponent,
    FooterComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    SharedModule,
    LandingRoutingModule
  ]
})
export class LandingModule { }
