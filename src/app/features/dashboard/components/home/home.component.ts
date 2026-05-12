import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { EventApiService } from '../../../events/services/event-api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  stats = {
    elections: 0,
    events: 0,
    members: 0,
    recruitments: 0
  };
  isLoading = true;

  constructor(
    private api: ApiService,
    private authHelper: AuthHelperService,
    private eventApi: EventApiService
  ) {}

  ngOnInit(): void {
    const clubId = this.authHelper.getClubId();
    
    forkJoin({
      members: this.api.getClubMembers(clubId).pipe(catchError(() => of([]))),
      campaigns: this.api.getClubCampaigns(clubId).pipe(catchError(() => of([]))),
      elections: this.api.getElections(clubId).pipe(catchError(() => of([]))),
      events: this.eventApi.getMyEvents().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.stats.members = res.members.length;
        this.stats.recruitments = res.campaigns.length;
        this.stats.elections = res.elections.length;
        this.stats.events = res.events.length;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching dashboard stats', err);
        this.isLoading = false;
      }
    });
  }
}
