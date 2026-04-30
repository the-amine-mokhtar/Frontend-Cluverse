import { Component, OnInit, ViewChild } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-member-login',
  templateUrl: './member-login.component.html',
  styleUrl: './member-login.component.scss'
})
export class MemberLoginComponent implements OnInit {

  @ViewChild('bForm') bForm: any;

  clubs: string[] = [];

  loginForm: any = {
    connectionIdentifier: '',
    password: '',
    clubName: ''
  };

  loginErrors: any = {
    club: '',
    identifier: '',
    password: '',
    backend: ''
  };

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.apiService.getClubsNames().subscribe({
      next: (response) => { this.clubs = response; },
      error: (error) => { console.error('Error fetching clubs:', error); }
    });
  }

  onClubSelect(event: any): void {
    this.loginForm.clubName = event.target.value;
    this.loginErrors.backend = '';
  }

  goToForgotPassword(): void {
    this.router.navigate(['/auth/forgot-password']);
  }

  submitLogin(event: Event): void {
    event.preventDefault();
    this.loginErrors.backend = '';

    // Mark every field as touched so errors show
    Object.values(this.bForm.controls).forEach((c: any) => c.markAsTouched());

    if (this.bForm.invalid) return;

    this.apiService.login(
      this.loginForm.connectionIdentifier,
      this.loginForm.password,
      this.loginForm.clubName
    ).subscribe({
      next: (response) => {
        localStorage.setItem('token', response.token);
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        if (error.status === 401) {
          this.loginErrors.backend = 'Invalid identifier or password.';
        } else if (error.error?.message?.toLowerCase().includes('not yet verified') ||
                   error.error?.message?.toLowerCase().includes('not verified')) {
          this.loginErrors.backend = 'Your club is not yet verified. Please check your email.';
        } else {
          this.loginErrors.backend = 'An error occurred. Please try again.';
        }
      }
    });
  }
}