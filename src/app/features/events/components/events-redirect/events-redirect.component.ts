import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-events-redirect',
  template: '',
})
export class EventsRedirectComponent implements OnInit {

  constructor(private router: Router,
              private authHelper: AuthHelperService) {}

  ngOnInit(): void {
    const role = this.authHelper.getRole();

    if (role === 'PRESIDENT') {
      this.router.navigate(['/dashboard/events/campaigns']);
    } else if (role.includes('MEMBER')) {
      this.router.navigate(['/dashboard/events/member']);
    } else {
      this.router.navigate(['/dashboard/events/manage']);
    }
  }
}