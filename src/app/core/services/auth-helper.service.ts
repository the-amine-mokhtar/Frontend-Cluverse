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
    const rawClubId = this.getPayload()?.clubid;
    const clubId = Number(rawClubId);
    return Number.isFinite(clubId) ? clubId : 0;
  }

  getRole(): string {
    const rawRole = this.getPayload()?.role;
    if (typeof rawRole !== 'string') {
      return '';
    }

    const normalized = rawRole.trim().toUpperCase();
    return normalized.startsWith('ROLE_') ? normalized.substring(5) : normalized;
  }

  getUserId(): number {
    const p = this.getPayload();
    const rawUserId = p?.sub ?? p?.id;
    const userId = Number(rawUserId);
    return Number.isFinite(userId) ? userId : 0;
  }

  isPresident(): boolean {
    return this.getRole() === 'PRESIDENT';
  }

  isSuperAdmin(): boolean {
    return !!this.getPayload()?.isSuperAdmin;
  }

  isLoggedIn(): boolean {
    const payload = this.getPayload();
    if (!payload) return false;
    // Check exp claim (Unix timestamp in seconds)
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;
    return true;
  }
}
