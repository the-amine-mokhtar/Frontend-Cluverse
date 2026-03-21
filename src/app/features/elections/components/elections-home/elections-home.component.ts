import { Component } from '@angular/core';

@Component({
  selector: 'app-elections-home',
  template: `
    <div class="feature-placeholder">
      <h2>Elections</h2>
      <p>Elections management coming soon.</p>
    </div>
  `,
  styles: [`
    .feature-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      color: #676767;
      gap: 0.5rem;
      h2 { color: #fff; font-size: 1.5rem; }
    }
  `]
})
export class ElectionsHomeComponent {}
