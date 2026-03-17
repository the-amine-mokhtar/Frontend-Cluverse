import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrustedByComponent } from './trusted-by.component';

@NgModule({
  declarations: [
    TrustedByComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    TrustedByComponent
  ]
})
export class TrustedByModule { }
