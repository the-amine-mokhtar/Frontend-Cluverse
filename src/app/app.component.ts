import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <app-navbar></app-navbar>
    <app-hero-sequence></app-hero-sequence>
    <app-pricing-section></app-pricing-section>
    <app-services-section></app-services-section>
    <app-faq-section></app-faq-section>
    <app-developing-team></app-developing-team>
    <app-footer></app-footer>
  `,
  styles: [`:host { display: block; }`]
})
export class AppComponent { }
