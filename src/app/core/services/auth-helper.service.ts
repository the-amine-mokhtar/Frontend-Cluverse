import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthHelperService {

  private getPayload(): any {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;

      const parts = token.split('.');
      if (parts.length !== 3) return null;

      // Base64url → Base64 → decode
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = atob(base64);
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  getDecodedToken(): any {
    return this.getPayload();
  }

  getFirstName(): string {
    return this.getPayload()?.firstName ?? '';
  }

  getLastName(): string {
    return this.getPayload()?.lastName ?? '';
  }

  getFullName(): string {
    const p = this.getPayload();
    if (!p) return '';
    return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  }

  getEmail(): string {
    return this.getPayload()?.email ?? '';
  }

  getClubId(): number {
    return this.getPayload()?.clubid ?? 0;
  }

  getRole(): string {
    return this.getPayload()?.role ?? '';
  }

  getUserId(): number {
    const p = this.getPayload();
    return p?.sub ?? p?.id ?? 0;
  }

  isPresident(): boolean {
    return this.getRole() === 'PRESIDENT';
  }

  isLoggedIn(): boolean {
    const payload = this.getPayload();
    if (!payload) return false;
    // Check exp claim (Unix timestamp in seconds)
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;
    return true;
  }
}
