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
}
