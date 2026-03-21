import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-member-login',
  templateUrl: './member-login.component.html',
  styleUrl: './member-login.component.scss'
})
export class MemberLoginComponent implements OnInit {

  clubs: string[] = [];
  selectedClub: string = '';

  loginForm: any = {
    connectionIdentifier: '',
    password: '',
    clubName: ''
  };

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.apiService.getClubsNames().subscribe({
      next: (response) => { this.clubs = response; },
      error: (error) => { console.error('Error fetching clubs:', error); }
    });
  }

  onClubSelect(event: any): void {
    this.selectedClub = event.target.value;
    this.loginForm.clubName = event.target.value;
  }

  submitLogin(event: Event): void {
    event.preventDefault();
    console.log('loginForm:', this.loginForm);
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
        console.error('Login failed:', error);
      }
    });
  }
}