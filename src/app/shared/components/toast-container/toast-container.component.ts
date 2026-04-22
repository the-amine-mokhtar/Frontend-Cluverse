import { Component, OnInit } from '@angular/core';
import { ToastService, Toast } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <div 
        *ngFor="let toast of toasts"
        [class]="'p-4 rounded-lg text-white font-medium shadow-lg animate-in slide-in-from-right-full duration-300 ' + 
                 (toast.type === 'success' ? 'bg-green-500' : 'bg-red-500')"
      >
        {{ toast.message }}
      </div>
    </div>
  `,
  styles: [`
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `]
})
export class ToastContainerComponent implements OnInit {
  toasts: Toast[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
    });
  }
}
