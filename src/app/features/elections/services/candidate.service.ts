import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class CandidateService {
  private apiUrl = `${environment.electionsApiUrl}/api/candidates`;
  private bioGeneratorApiUrl = 'http://localhost:8091';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }

  getCandidates(electionId?: number): Observable<any[]> {
    let url = this.apiUrl;
    if (electionId) url += `?electionId=${electionId}`;
    return this.http.get<any[]>(url, { headers: this.getAuthHeaders() });
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  submitCandidacy(request: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, request, { headers: this.getAuthHeaders() });
  }

  update(id: number, request: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request, { headers: this.getAuthHeaders() });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  generateBio(payload: { extractedText: string; position?: string }): Observable<{ bio: string; prompt: string }> {
    return this.http.post<{ bio: string; prompt: string }>(`${this.bioGeneratorApiUrl}/generate-bio`, payload);
  }

  compareCandidates(payload: {
    candidates: { name: string; bio: string; program: string; status: string; voteCount: number; percentage: number }[];
    electionTitle?: string;
    positionName?: string;
  }): Observable<{ report: string; prompt: string }> {
    return this.http.post<{ report: string; prompt: string }>(`${this.bioGeneratorApiUrl}/compare-candidates`, payload);
  }

}
