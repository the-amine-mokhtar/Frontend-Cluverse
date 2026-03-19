import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { VerifyRoutingModule } from './verify-routing.module';
import { VerifyComponent } from './components/verify/verify.component';
import { HttpClientModule } from '@angular/common/http';


@NgModule({
  declarations: [VerifyComponent],
  imports: [
    CommonModule,
    VerifyRoutingModule,
    HttpClientModule
  ]
})
export class VerifyModule { }
