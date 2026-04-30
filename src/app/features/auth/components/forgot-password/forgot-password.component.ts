import { Component } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  readonly siteKey = '6LeiBtEsAAAAAMCnOmAd5Zm3UMCV7W9S4JZ9pR-Y'; 
  email = '';
  captchaToken: string | null = null;
  loading = false;
  submitted = false;
  error = '';

  constructor(private api: ApiService) {}

  onCaptchaResolved(token: string | null) {
    this.captchaToken = token;
  }

  submit() {
    if (!this.email || !this.captchaToken) return;
    this.loading = true;
    this.error = '';
    this.api.forgotPassword(this.email).subscribe({
      next: () => {
        this.submitted = true;
        this.loading = false;
      },
      error: (err: Error) => {
        this.error = err.message || 'An error occurred. Please try again.';
        this.loading = false;
        this.captchaToken = null;
      }
    });
  }
}
