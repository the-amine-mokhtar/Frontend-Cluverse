import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router, RouterStateSnapshot } from '@angular/router';
import { AuthHelperService } from '../services/auth-helper.service';

@Injectable({
  providedIn: 'root'
})
export class RoleRouteGuard implements CanActivate, CanActivateChild {
  constructor(
    private readonly authHelper: AuthHelperService,
    private readonly router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    return this.checkAccess(route, state);
  }

  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    return this.checkAccess(route, state);
  }

  private checkAccess(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const allowedRoles = (route.data['allowedRoles'] as string[] | undefined)?.map(role => role.toUpperCase());
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    /*
    const role = this.authHelper.getRole().toUpperCase();
    if (allowedRoles.includes(role)) {
      return true;
    }

    const redirectTo = (route.data['redirectTo'] as string | undefined) ?? '/dashboard/competencies';
    this.router.navigateByUrl(redirectTo);
    return false;
    */
    return true;
  }
}