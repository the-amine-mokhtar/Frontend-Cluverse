import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { EventApiService } from '../../../events/services/event-api.service';
import { forkJoin, of, interval, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  stats = { elections: 0, events: 0, members: 0, recruitments: 0 };
  isLoading = true;
  currentDate = new Date();

  private clockSub?: Subscription;

  moduleHealth = [
    { icon: '🗳️', name: 'Elections' },
    { icon: '📅', name: 'Events' },
    { icon: '👥', name: 'Members' },
    { icon: '🎯', name: 'Recruitment' },
    { icon: '🚌', name: 'Logistics' },
    { icon: '💰', name: 'Finance' },
  ];

  activityFeed = [
    { text: 'Election dashboard updated', time: '2 min ago', color: '#f7b91c' },
    { text: 'New member joined the club', time: '14 min ago', color: '#10b981' },
    { text: 'Upcoming event scheduled', time: '1 hr ago', color: '#3b82f6' },
    { text: 'Campaign applications opened', time: '3 hr ago', color: '#8b5cf6' },
    { text: 'Election results published', time: 'Yesterday', color: '#f7b91c' },
    { text: 'Member role updated', time: 'Yesterday', color: '#10b981' },
  ];

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  get totalActivity(): number {
    return this.stats.elections + this.stats.events + this.stats.members + this.stats.recruitments;
  }

  get electionRatio(): number {
    return this.totalActivity ? Math.round((this.stats.elections / this.totalActivity) * 100) : 25;
  }

  get eventsRatio(): number {
    return this.totalActivity ? Math.round((this.stats.events / this.totalActivity) * 100) : 25;
  }

  get membersRatio(): number {
    return this.totalActivity ? Math.round((this.stats.members / this.totalActivity) * 100) : 25;
  }

  get recruitmentsRatio(): number {
    return this.totalActivity ? Math.round((this.stats.recruitments / this.totalActivity) * 100) : 25;
  }

  get engagementScore(): number {
    return Math.min(100, Math.round((this.totalActivity / 50) * 100));
  }

  get donutStyle(): string {
    const e = this.electionRatio;
    const ev = this.eventsRatio;
    const m = this.membersRatio;
    return `conic-gradient(#f7b91c 0% ${e}%, #3b82f6 ${e}% ${e + ev}%, #10b981 ${e + ev}% ${e + ev + m}%, #8b5cf6 ${e + ev + m}% 100%)`;
  }

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
      error: () => { this.isLoading = false; }
    });

    this.clockSub = interval(60000).subscribe(() => {
      this.currentDate = new Date();
    });
  }

  ngOnDestroy(): void {
    this.clockSub?.unsubscribe();
  }
}
