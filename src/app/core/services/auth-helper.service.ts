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

  getClubId(): number {
    const payload = this.getPayload();
    const fromToken = Number(payload?.clubid ?? payload?.clubId ?? 0);
    if (Number.isFinite(fromToken) && fromToken > 0) {
      return fromToken;
    }

    const fromStorage = Number(localStorage.getItem('clubId') ?? 0);
    return Number.isFinite(fromStorage) ? fromStorage : 0;
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
