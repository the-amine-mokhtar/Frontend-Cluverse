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

// ─── Members ─────────────────────────────────────────────────────────────────

getClubMembers(clubId: number): Observable<any[]> {
  return this.http.get<any[]>(`${this.baseUrl}/api/clubs/${clubId}/members`, {
    headers: this.authHeaders()
  }).pipe(catchError(this.handleError));
}

inviteMember(clubId: number, email: string, role: string): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  });
  return this.http.post(`${this.baseUrl}/api/clubs/${clubId}/members/send-invite`, 
    { email, role }, 
    { headers, responseType: 'text' }
  );
}

removeMember(clubId: number, userId: number): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.delete(`${this.baseUrl}/api/clubs/${clubId}/members/${userId}`,
    { headers, responseType: 'text' }
  );
}

deactivateMember(clubId: number, userId: number): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.put(
    `${this.baseUrl}/api/clubs/${clubId}/members/${userId}/deactivate`,
    {},
    { headers, responseType: 'text' }
  );
}

activateMember(clubId: number, userId: number): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.put(
    `${this.baseUrl}/api/clubs/${clubId}/members/${userId}/activate`,
    {},
    { headers, responseType: 'text' }
  );
}

updateMemberRole(clubId: number, userId: number, role: string): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.put(
    `${this.baseUrl}/api/clubs/${clubId}/members/${userId}/role?role=${encodeURIComponent(role)}`,
    {},
    { headers, responseType: 'text' }
  );
}

// ─── Recruitment API Methods ─────────────────────────────────────────────── //

getClubCampaigns(clubId: number): Observable<any[]> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.get<any[]>(`${this.baseUrl}/api/recruitment/campaigns/club/${clubId}`, { headers });
}

createCampaign(clubId: number, campaign: any): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.post<any>(`${this.baseUrl}/api/recruitment/campaigns?clubId=${clubId}`, campaign, { headers });
}

updateCampaign(id: number, campaign: any): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.put<any>(`${this.baseUrl}/api/recruitment/campaigns/${id}`, campaign, { headers });
}

getCampaign(id: number): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.get<any>(`${this.baseUrl}/api/recruitment/campaigns/${id}`, { headers });
}

deleteCampaign(id: number): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.delete(`${this.baseUrl}/api/recruitment/campaigns/${id}`, { headers, responseType: 'text' });
}

// ─── Questions ───

addQuestion(campaignId: number, question: any): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.post<any>(`${this.baseUrl}/api/recruitment/campaigns/${campaignId}/questions`, question, { headers });
}

updateQuestion(id: number, question: any): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.put<any>(`${this.baseUrl}/api/recruitment/questions/${id}`, question, { headers });
}

deleteQuestion(id: number): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });
  return this.http.delete(`${this.baseUrl}/api/recruitment/questions/${id}`, 
    { headers, responseType: 'text' }
  );
}

// ─── Applications ───

getCampaignApplications(campaignId: number): Observable<any[]> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.get<any[]>(`${this.baseUrl}/api/recruitment/campaigns/${campaignId}/applications`, { headers });
}

updateApplicationStatus(id: number, status: string): Observable<any> {
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  return this.http.put(`${this.baseUrl}/api/recruitment/applications/${id}/status?status=${encodeURIComponent(status)}`, {}, { headers, responseType: 'text' });
}

// ─── Public Unauthenticated API Methods ───

getCampaignByPublicLink(publicLink: string): Observable<any> {
  // Graceful handling of possible missing endpoint or 404
  return this.http.get<any>(`${this.baseUrl}/api/recruitment/campaigns/public/${encodeURIComponent(publicLink)}`);
}

applyToCampaign(campaignId: number, submission: any): Observable<any> {
  return this.http.post(`${this.baseUrl}/api/recruitment/campaigns/${campaignId}/apply`, submission, { responseType: 'text' });
}
}


