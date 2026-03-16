import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServicesSectionComponent } from './services-section.component';
import { ServiceDetailModule } from '../service-detail/service-detail.module';

@NgModule({
  declarations: [
    ServicesSectionComponent
  ],
  imports: [
    CommonModule,
    ServiceDetailModule
  ],
  exports: [
    ServicesSectionComponent
  ]
})
export class ServicesSectionModule { }
