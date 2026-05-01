import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class ClubService {
  private baseUrl = environment.userApiUrl;

  constructor(private http: HttpClient) {}

  getById(id: string): Observable<any> {
    // We assume RESTful endpoint /api/clubs/:id or /clubs/:id. Adjust if necessary.
    return this.http.get<any>(`${this.baseUrl}/api/clubs/${id}`);
  }
}
