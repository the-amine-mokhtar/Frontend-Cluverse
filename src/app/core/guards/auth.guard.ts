import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthHelperService } from '../services/auth-helper.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authHelper: AuthHelperService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.authHelper.isLoggedIn()) {
      return true;
    }
    this.router.navigate(['/auth/login']);
    return false;
  }
}
