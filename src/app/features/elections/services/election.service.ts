import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class ElectionService {
  private apiUrl = `${environment.electionsApiUrl}/api/elections`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }

  getElections(clubId?: number): Observable<any[]> {
    let url = this.apiUrl;
    if (clubId) url += `?clubId=${clubId}`;
    return this.http.get<any[]>(url, { headers: this.getAuthHeaders() });
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  create(request: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, request, { headers: this.getAuthHeaders() });
  }

  update(id: number, request: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request, { headers: this.getAuthHeaders() });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  closeElection(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/close`, {}, { headers: this.getAuthHeaders() });
  }

  getFacebookOAuthUrl(): Observable<any> {
    return this.http.get<any>(`${environment.electionsApiUrl}/api/social/facebook/oauth/url`, { headers: this.getAuthHeaders() });
  }

  publishElectionResultToFacebook(payload: { message: string; imageBase64: string; privatePost: boolean }): Observable<any> {
    return this.http.post<any>(`${environment.electionsApiUrl}/api/social/facebook/publish`, payload, { headers: this.getAuthHeaders() });
  }
}
