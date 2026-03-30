import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class VoteService {
  private apiUrl = `${environment.apiUrl}/api/votes`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }

  getVotes(electionId?: number): Observable<any[]> {
    let url = this.apiUrl;
    if (electionId) url += `?electionId=${electionId}`;
    return this.http.get<any[]>(url, { headers: this.getAuthHeaders() });
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  castVote(request: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, request, { headers: this.getAuthHeaders() });
  }
}
