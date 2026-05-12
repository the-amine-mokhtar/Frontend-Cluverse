import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { EventApiService } from '../../../events/services/event-api.service';
import { forkJoin, of, interval, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LogisticsApiService } from '../../../logistics/services/logistics-api.service';
import { SponsorshipService } from '../../../../core/services/sponsorship.service';
import { FinanceService } from '../../../../core/services/finance.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  stats = { elections: 0, events: 0, members: 0, recruitments: 0, logistics: 0, finance: 0, sponsors: 0, competencies: 0 };
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
    { icon: '🤝', name: 'Sponsors' },
    { icon: '🧠', name: 'Competencies' },
  ];

  activityFeed = [
    { text: 'Election dashboard updated', time: '2 min ago', color: '#f7b91c' },
    { text: 'New member joined the club', time: '14 min ago', color: '#10b981' },
    { text: 'Transport request submitted', time: '38 min ago', color: '#f59e0b' },
    { text: 'New transaction recorded', time: '1 hr ago', color: '#14b8a6' },
    { text: 'Upcoming event scheduled', time: '2 hr ago', color: '#3b82f6' },
    { text: 'Campaign applications opened', time: '3 hr ago', color: '#8b5cf6' },
    { text: 'Sponsorship agreement added', time: '5 hr ago', color: '#ec4899' },
    { text: 'New competency skill tracked', time: 'Yesterday', color: '#6366f1' },
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
    return this.stats.elections + this.stats.events + this.stats.members + this.stats.recruitments
      + this.stats.logistics + this.stats.finance + this.stats.sponsors + this.stats.competencies;
  }

  get electionRatio(): number { return this.totalActivity ? Math.round((this.stats.elections / this.totalActivity) * 100) : 12; }
  get eventsRatio(): number { return this.totalActivity ? Math.round((this.stats.events / this.totalActivity) * 100) : 13; }
  get membersRatio(): number { return this.totalActivity ? Math.round((this.stats.members / this.totalActivity) * 100) : 12; }
  get recruitmentsRatio(): number { return this.totalActivity ? Math.round((this.stats.recruitments / this.totalActivity) * 100) : 13; }
  get logisticsRatio(): number { return this.totalActivity ? Math.round((this.stats.logistics / this.totalActivity) * 100) : 12; }
  get financeRatio(): number { return this.totalActivity ? Math.round((this.stats.finance / this.totalActivity) * 100) : 13; }
  get sponsorsRatio(): number { return this.totalActivity ? Math.round((this.stats.sponsors / this.totalActivity) * 100) : 12; }
  get competenciesRatio(): number { return this.totalActivity ? Math.round((this.stats.competencies / this.totalActivity) * 100) : 13; }

  get engagementScore(): number {
    return Math.min(100, Math.round((this.totalActivity / 50) * 100));
  }

  get donutStyle(): string {
    if (!this.totalActivity) return 'conic-gradient(var(--h-bg-inner) 0% 100%)';
    let pos = 0;
    const seg = (color: string, pct: number) => { const f = pos; pos += pct; return `${color} ${f}% ${pos}%`; };
    return `conic-gradient(${
      [seg('#f7b91c', this.electionRatio), seg('#3b82f6', this.eventsRatio),
       seg('#10b981', this.membersRatio), seg('#8b5cf6', this.recruitmentsRatio),
       seg('#f59e0b', this.logisticsRatio), seg('#14b8a6', this.financeRatio),
       seg('#ec4899', this.sponsorsRatio), seg('#6366f1', this.competenciesRatio)].join(', ')
    })`;
  }

  constructor(
    private api: ApiService,
    private authHelper: AuthHelperService,
    private eventApi: EventApiService,
    private logisticsApi: LogisticsApiService,
    private sponsorshipService: SponsorshipService,
    private financeService: FinanceService
  ) {}

  ngOnInit(): void {
    const clubId = this.authHelper.getClubId();
    forkJoin({
      members: this.api.getClubMembers(clubId).pipe(catchError(() => of([]))),
      campaigns: this.api.getClubCampaigns(clubId).pipe(catchError(() => of([]))),
      elections: this.api.getElections(clubId).pipe(catchError(() => of([]))),
      events: this.eventApi.getMyEvents().pipe(catchError(() => of([]))),
      logistics: this.logisticsApi.getTransports().pipe(catchError(() => of([]))),
      finance: this.financeService.getTransactions(clubId).pipe(catchError(() => of([]))),
      sponsors: this.sponsorshipService.getAll().pipe(catchError(() => of([]))),
      competencies: this.api.getCompetencies(clubId).pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.stats.members = res.members.length;
        this.stats.recruitments = res.campaigns.length;
        this.stats.elections = res.elections.length;
        this.stats.events = res.events.length;
        this.stats.logistics = res.logistics.length;
        this.stats.finance = res.finance.length;
        this.stats.sponsors = res.sponsors.length;
        this.stats.competencies = res.competencies.length;
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
