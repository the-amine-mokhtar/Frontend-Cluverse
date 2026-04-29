import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  loading = false;
  success = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.error = 'Invalid or missing reset token. Please request a new link.';
    }
  }

  get passwordMismatch(): boolean {
    return !!this.confirmPassword && this.newPassword !== this.confirmPassword;
  }

  get isValid(): boolean {
    return !!this.token && this.newPassword.length >= 8 && !this.passwordMismatch;
  }

  submit() {
    if (!this.isValid) return;
    this.loading = true;
    this.error = '';
    this.api.resetPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        setTimeout(() => this.router.navigate(['/auth/login']), 2500);
      },
      error: (err: Error) => {
        this.error = err.message || 'Reset failed. The link may have expired.';
        this.loading = false;
      }
    });
  }
}
