import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceDetailComponent } from './service-detail.component';

@NgModule({
  declarations: [
    ServiceDetailComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ServiceDetailComponent
  ]
})
export class ServiceDetailModule { }
