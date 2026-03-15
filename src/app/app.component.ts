import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <app-hero-sequence></app-hero-sequence>
    <app-pricing-section></app-pricing-section>
    <app-services-section></app-services-section>
    <app-footer></app-footer>
  `,
  styles: [`:host { display: block; }`]
})
export class AppComponent { }
