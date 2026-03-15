import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroSequenceComponent } from './hero-sequence.component';

@NgModule({
  declarations: [
    HeroSequenceComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    HeroSequenceComponent
  ]
})
export class HeroSequenceModule { }
