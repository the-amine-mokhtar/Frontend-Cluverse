import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplyRoutingModule } from './apply-routing.module';
import { PublicApplicationComponent } from './components/public-application/public-application.component';

@NgModule({
  declarations: [
    PublicApplicationComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ApplyRoutingModule
  ]
})
export class ApplyModule { }
