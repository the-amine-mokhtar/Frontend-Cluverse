import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';

export interface HttpOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  //la fct pour recuperer les clubs
  getClubsNames(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/api/clubs/names`);
  }

  //la fct pour ajouter un nouveau club
  applyForClubCreation(club: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/clubs`, club);
  }

  /**
   * Generic POST method
   */
  post<T>(endpoint: string, body: any, options?: HttpOptions): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic PUT method
   */
  put<T>(endpoint: string, body: any, options?: HttpOptions): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic DELETE method
   */
  delete<T>(endpoint: string, options?: HttpOptions): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Custom Error Handler
   */
  private handleError(error: any) {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Client-side errors
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side errors
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  login(connectionIdentifier: string, password: string, clubName: string): Observable<any> {
  return this.http.post(`${this.baseUrl}/api/auth/login-member`, {
    connectionIdentifier,
    password,
    clubName
  });
}
uploadClubLogo(clubId: number, formData: FormData): Observable<string> {
  return this.http.post(`${this.baseUrl}/api/clubs/${clubId}/logo`, formData, { responseType: 'text' });
}

getClubById(id: number): Observable<any> {
  return this.http.get(`${this.baseUrl}/api/clubs/${id}`);
}

checkEmailExists(email: string): Observable<boolean> {
  return this.http.get<boolean>(`${this.baseUrl}/api/clubs/check-email?email=${email}`);
}

// ─── Profile endpoints ─────────────────────────────────────────────────────

private authHeaders(): HttpHeaders {
  const token = localStorage.getItem('token') ?? '';
  return new HttpHeaders({ Authorization: `Bearer ${token}` });
}

getMyProfile(): Observable<any> {
  return this.http.get(`${this.baseUrl}/api/users/me`, {
    headers: this.authHeaders()
  }).pipe(catchError(this.handleError));
}

updateMyProfile(data: any): Observable<any> {
  return this.http.put(`${this.baseUrl}/api/users/me`, data, {
    headers: this.authHeaders()
  }).pipe(catchError(this.handleError));
}

updateMyPhoto(formData: FormData): Observable<string> {
  return this.http.post(`${this.baseUrl}/api/users/me/photo`, formData, {
    headers: this.authHeaders(),
    responseType: 'text'
  }).pipe(catchError(this.handleError));
}

refreshToken(): Observable<string> {
  return this.http.post<{ token: string; email: string }>(
    `${this.baseUrl}/api/auth/refresh-token`,
    {},
    { headers: this.authHeaders() }
  ).pipe(
    map((res: { token: string; email: string }) => res.token),
    catchError(this.handleError)
  );
}
}


