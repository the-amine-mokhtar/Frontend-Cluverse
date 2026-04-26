import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  login(credentials: { email: string; password: string }): Observable<any[]> {
    return this.http.post<any[]>(`${this.baseUrl}/api/auth/login`, credentials);
  }

  loginClub(credentials: { email: string; password: string }, clubId: string): Observable<{ token: string; email: string }> {
    const payload = {
      ...credentials,
      clubId
    };
    return this.http.post<{ token: string; email: string }>(`${this.baseUrl}/api/auth/login-club`, payload);
  }

  /**
   * OAuth2 login - redirects to backend OAuth2 provider
   * @param provider 'google' or 'github'
   */
  loginWithOAuth2(provider: 'google' | 'github'): void {
    const authUrl = `${this.baseUrl}/oauth2/authorization/${provider}`;
    window.location.href = authUrl;
  }

  /**
   * Check if user is logged in (has valid token)
   */
  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  /**
   * Get current JWT token
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Get stored user info from OAuth2 callback
   */
  getOAuth2UserInfo(): {
    email?: string;
    firstName?: string;
    lastName?: string;
    userId?: string;
  } {
    return {
      email: localStorage.getItem('userEmail') || undefined,
      firstName: localStorage.getItem('userFirstName') || undefined,
      lastName: localStorage.getItem('userLastName') || undefined,
      userId: localStorage.getItem('userId') || undefined
    };
  }

  /**
   * Logout - clear all stored data
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userLastName');
    localStorage.removeItem('userId');
  }
}
