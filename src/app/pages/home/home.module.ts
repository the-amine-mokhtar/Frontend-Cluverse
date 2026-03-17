import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home.component';
import { HeroSequenceModule } from '../../components/hero-sequence/hero-sequence.module';
import { TrustedByModule } from '../../components/trusted-by/trusted-by.module';
import { ServicesSectionModule } from '../../components/services-section/services-section.module';
import { FaqSectionModule } from '../../components/faq-section/faq-section.module';
import { PricingSectionModule } from '../../components/pricing-section/pricing-section.module';
import { DevelopingTeamModule } from '../../components/developing-team/developing-team.module';

@NgModule({
  declarations: [
    HomeComponent
  ],
  imports: [
    CommonModule,
    HeroSequenceModule,
    TrustedByModule,
    ServicesSectionModule,
    FaqSectionModule,
    PricingSectionModule,
    DevelopingTeamModule
  ],
  exports: [
    HomeComponent
  ]
})
export class HomeModule { }
