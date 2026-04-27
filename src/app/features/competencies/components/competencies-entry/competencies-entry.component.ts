import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-competencies-entry',
  template: ''
})
export class CompetenciesEntryComponent implements OnInit {
  private readonly adminRoles = ['PRESIDENT', 'TREASURER', 'HR_MANAGER', 'EVENT_MANAGER'];

  constructor(
    private readonly authHelper: AuthHelperService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const role = this.authHelper.getRole();
    const target = this.adminRoles.includes(role) ? 'home' : 'member-competencies';

    this.router.navigate([target], {
      relativeTo: this.route,
      replaceUrl: true
    });
  }
}