import { Component, Input } from '@angular/core';

@Component({
  selector: 'mat-spinner',
  template: `
    <div class="local-mat-spinner" [style.width.px]="size" [style.height.px]="size" role="status" aria-live="polite">
      <svg viewBox="0 0 50 50" [attr.width]="size" [attr.height]="size">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#1976d2" [attr.stroke-width]="stroke || 4" stroke-linecap="round"/>
      </svg>
    </div>
  `,
  styles: [
    `.local-mat-spinner { display:inline-block; vertical-align:middle; }
     .local-mat-spinner svg { animation: spin 1s linear infinite; }
     @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
    `
  ]
})
export class MatSpinnerStubComponent {
  @Input() diameter: number | string = 24;
  @Input() strokeWidth?: number | string;

  get size(): number {
    const n = Number(this.diameter);
    return Number.isFinite(n) && n > 0 ? n : 24;
  }

  get stroke(): number {
    const s = Number(this.strokeWidth);
    return Number.isFinite(s) && s > 0 ? s : 4;
  }
}
