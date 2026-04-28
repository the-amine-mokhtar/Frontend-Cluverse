import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  EventAiDashboardResponse,
  EventAiInsightResponse,
  EventAiRankedEventResponse,
  EventAiSchedulingResponse,
  EventAiSchedulingSlotResponse,
  EventAiSchedulingTrendPointResponse,
  EventApiService,
  EventItem,
  normalizeEvent
} from '../../services/event-api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { CampaignApiService, Campaign } from '../../services/campaign-api.service';
import { EventStatusChangeService } from '../../services/event-status-change.service';

export const KNOWN_CATEGORIES = [
  'CONFERENCE', 'WORKSHOP', 'MEETING', 'TRAINING', 'HACKATHON', 'SOCIAL'
] as const;

const AVATAR_COLORS = ['indigo', 'teal', 'amber', 'violet', 'rose'] as const;

type PlanningInsightBar = {
  label: string;
  shortLabel: string;
  value: number;
  participants: number;
  fillRate: number;
  count: number;
};

type PlanningTrendPoint = {
  label: string;
  shortLabel: string;
  participants: number;
  fillRate: number;
  score: number;
  projected?: boolean;
  changeRate?: number;
};

type PlanningEvent = EventItem & {
  aiInsight?: EventAiInsightResponse;
};

@Component({
  selector: 'app-event-home',
  templateUrl: './event-home.component.html',
  styleUrls: ['./event-home.component.scss']
})
export class EventHomeComponent implements OnInit, OnDestroy {
  private readonly organizerScoreWeights = {
    popularity: 0.35,
    trend: 0.25,
    urgency: 0.20,
    conversion: 0.20,
  };

  // ─── Data ─────────────────────────────────────────────────────────────────
  allEvents: EventItem[]       = [];
  displayedEvents: EventItem[] = [];
  filteredEvents: EventItem[]  = [];
  paginatedEvents: EventItem[] = [];
  smartRankedEvents: EventAiRankedEventResponse[] = [];
  private backendSchedulingOptimizer: EventAiSchedulingResponse | null = null;
  private backendRankedEvents: EventAiRankedEventResponse[] = [];
  private backendSmartStatisticsCards: Array<{ label: string; value: number | string; hint: string }> = [];
  private backendDashboardSummary: Pick<EventAiDashboardResponse, 'avgScore' | 'trending' | 'popular' | 'almostFull'> | null = null;
  readonly eventScoringWeights: Array<{ label: string; weight: number }> = [
    { label: 'Popularity', weight: 35 },
    { label: 'Trend', weight: 25 },
    { label: 'Urgency', weight: 20 },
    { label: 'Conversion', weight: 20 },
  ];
  readonly aiRefreshIntervalMinutes = 5;
  aiLastRefreshAt: Date | null = null;

  // ─── Campaigns (owned — PRESIDENT only) ───────────────────────────────────
  campaigns: Campaign[]     = [];
  isLoadingCampaigns        = false;
  showCampaignsPanel        = false;

  // ─── Top 5 Campaigns (PUBLIC + SHARED + PRIVATE) ───────────────────────────
  top5Campaigns: Campaign[]        = [];
  isLoadingTop5                    = false;
  showTop5CampaignsPanel           = false;

  // ─── Accessible Campaigns (via CampaignAccess — tous rôles) ───────────────
  accessibleCampaigns: Campaign[]         = [];
  filteredAccessibleCampaigns: Campaign[] = [];
  isLoadingAccessible                     = false;
  showAccessibleCampaignsPanel            = false;
  accessibleCampaignSearch                = '';

  // ─── View state ───────────────────────────────────────────────────────────
  isViewingHistory      = false;
  showCalendarModal     = false;
  showDeleteModal       = false;
  showParticipantsModal = false;
  showAiPanel           = false;
  isLoading             = true;

  // ─── Selections ───────────────────────────────────────────────────────────
  selectedEvent: EventItem | null                    = null;
  selectedEventToDelete: EventItem | null            = null;
  selectedEventForParticipants: EventItem | undefined;
  selectedDate = '';

  // ─── Category filter ──────────────────────────────────────────────────────
  readonly knownCategories = KNOWN_CATEGORIES;
  selectedCategory    = '';
  customCategoryInput = '';
  isCustomCategory    = false;

  // ─── Search ───────────────────────────────────────────────────────────────
  searchTerm = '';

  // ─── Pagination ───────────────────────────────────────────────────────────
  currentPage = 1;
  pageSize    = 6;
  totalPages  = 1;
  pageNumbers: number[] = [];

  // ─── Participants ─────────────────────────────────────────────────────────
  eventParticipants: any[]    = [];
  filteredParticipants: any[] = [];
  participantSearchTerm       = '';
  isLoadingParticipants       = false;

  // ─── User Role ────────────────────────────────────────────────────────────
  userRole    = '';
  isPresident = false;

  private destroy$ = new Subject<void>();
  private aiRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private eventService: EventApiService,
    private router: Router,
    private authHelper: AuthHelperService,
    private campaignService: CampaignApiService,
    private eventStatusChangeService: EventStatusChangeService
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════
  ngOnInit(): void {
    this.userRole    = this.authHelper.getRole();
    this.isPresident = this.userRole === 'PRESIDENT';
    this.loadAllEvents();
    this.startAiRefreshLoop();
    this.loadAccessibleCampaigns();
    this.loadTop5Campaigns(); // ✅ NEW — Dashboard Top 5
    if (this.isPresident) {
      this.loadCampaigns();
    }

    this.eventStatusChangeService.onEventStatusChange()
      .pipe(takeUntil(this.destroy$))
      .subscribe(change => {
        const event = this.allEvents.find(e => e.id === change.eventId);
        if (event) event.status = change.newStatus as any;
        this.refreshDisplayedEvents();
        this.loadAiDashboard();
        this.loadAiSchedulingOptimizer();
      });
  }

  ngOnDestroy(): void {
    if (this.aiRefreshTimer) {
      clearInterval(this.aiRefreshTimer);
      this.aiRefreshTimer = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════
  loadAllEvents(): void {
    this.isLoading = true;
    this.eventService.getMyEvents().subscribe({
      next: (events) => {
        this.allEvents = events.map(e => normalizeEvent(e));
        this.refreshDisplayedEvents();
        this.loadAiDashboard();
        this.loadAiSchedulingOptimizer();
        this.isLoading = false;
      },
      error: () => {
        this.allEvents       = [];
        this.displayedEvents = [];
        this.filteredEvents  = [];
        this.paginatedEvents = [];
        this.backendRankedEvents = [];
        this.smartRankedEvents = [];
        this.backendSchedulingOptimizer = null;
        this.isLoading       = false;
      }
    });
  }

  private loadAiDashboard(): void {
    this.eventService.getMyClubAiDashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dashboard) => {
          this.backendRankedEvents = this.mapBackendRankedEvents(dashboard);
          this.backendDashboardSummary = {
            avgScore: dashboard.avgScore ?? 0,
            trending: dashboard.trending ?? 0,
            popular: dashboard.popular ?? 0,
            almostFull: dashboard.almostFull ?? 0,
          };
          this.backendSmartStatisticsCards = (dashboard.statistics || []).map(stat => ({
            label: stat.label,
            value: stat.value,
            hint: stat.hint,
          }));
          this.aiLastRefreshAt = new Date();
          this.applyFilters();
        },
        error: () => {
          this.backendRankedEvents = [];
          this.backendDashboardSummary = null;
          this.backendSmartStatisticsCards = [];
          this.applyFilters();
        }
      });
  }

  private loadAiSchedulingOptimizer(): void {
    this.eventService.getMyClubAiScheduling()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (scheduling) => {
          this.backendSchedulingOptimizer = scheduling;
        },
        error: () => {
          this.backendSchedulingOptimizer = null;
        }
      });
  }

  private startAiRefreshLoop(): void {
    if (this.aiRefreshTimer) {
      clearInterval(this.aiRefreshTimer);
    }

    this.aiRefreshTimer = setInterval(() => {
      this.loadAiDashboard();
      this.loadAiSchedulingOptimizer();
    }, this.aiRefreshIntervalMinutes * 60 * 1000);
  }

  // ─── Campagnes owned (PRESIDENT) ──────────────────────────────────────────
  loadCampaigns(): void {
    this.isLoadingCampaigns = true;
    this.campaignService.getAllCampaigns().subscribe({
      next: (campaigns) => {
        this.campaigns          = campaigns;
        this.isLoadingCampaigns = false;
      },
      error: () => {
        this.campaigns          = [];
        this.isLoadingCampaigns = false;
      }
    });
  }

  // ─── Campagnes accessibles via CampaignAccess (tous rôles) ────────────────
  loadAccessibleCampaigns(): void {
    this.isLoadingAccessible = true;
    this.campaignService.getAccessibleCampaigns()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.accessibleCampaigns         = data;
          this.filteredAccessibleCampaigns = data;
          this.isLoadingAccessible         = false;
        },
        error: () => {
          this.accessibleCampaigns         = [];
          this.filteredAccessibleCampaigns = [];
          this.isLoadingAccessible         = false;
        }
      });
  }

  // ─── TOP 5 Campaigns (PUBLIC + SHARED + PRIVATE) ──────────────────────────
  loadTop5Campaigns(): void {
    this.isLoadingTop5 = true;
    this.campaignService.getTop5Campaigns()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.top5Campaigns = data;
          this.isLoadingTop5  = false;
        },
        error: () => {
          this.top5Campaigns = [];
          this.isLoadingTop5  = false;
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSIBLE CAMPAIGNS PANEL
  // ═══════════════════════════════════════════════════════════════════════════
  toggleAccessibleCampaignsPanel(): void {
    this.showAccessibleCampaignsPanel = !this.showAccessibleCampaignsPanel;
    // Fermer l'autre panel si ouvert
    if (this.showAccessibleCampaignsPanel) {
      this.showCampaignsPanel = false;
      this.showTop5CampaignsPanel = false;
      this.loadAccessibleCampaigns();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP 5 CAMPAIGNS PANEL
  // ═══════════════════════════════════════════════════════════════════════════
  toggleTop5CampaignsPanel(): void {
    this.showTop5CampaignsPanel = !this.showTop5CampaignsPanel;
    // Fermer les autres panels si ouverts
    if (this.showTop5CampaignsPanel) {
      this.showCampaignsPanel = false;
      this.showAccessibleCampaignsPanel = false;
      this.loadTop5Campaigns();
    }
  }

  filterAccessibleCampaigns(): void {
    const term = this.accessibleCampaignSearch.trim().toLowerCase();
    this.filteredAccessibleCampaigns = !term
      ? this.accessibleCampaigns
      : this.accessibleCampaigns.filter(c =>
          c.title.toLowerCase().includes(term) ||
          (c.description   || '').toLowerCase().includes(term) ||
          (c.ownerClubName || '').toLowerCase().includes(term)
        );
  }

  clearAccessibleSearch(): void {
    this.accessibleCampaignSearch    = '';
    this.filteredAccessibleCampaigns = this.accessibleCampaigns;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPLAY / HISTORY
  // ═══════════════════════════════════════════════════════════════════════════
  private refreshDisplayedEvents(): void {
    if (this.isViewingHistory) {
      this.displayedEvents = this.allEvents.filter(
        e => e.status === 'COMPLETED' || e.status === 'CANCELLED'
      );
    } else {
      this.displayedEvents = this.allEvents.filter(
        e => e.status !== 'COMPLETED' && e.status !== 'CANCELLED'
      );
    }
    this.applyFilters();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════════════
  countByStatus(status: string): number {
    return this.allEvents.filter(e => e.status === status).length;
  }

  get activeEventsCount(): number {
    return this.allEvents.filter(
      e => e.status !== 'COMPLETED' && e.status !== 'CANCELLED'
    ).length;
  }

  get historyEventsCount(): number {
    return this.allEvents.filter(
      e => e.status === 'COMPLETED' || e.status === 'CANCELLED'
    ).length;
  }

  get smartEventHighlights(): EventAiRankedEventResponse[] {
    return this.smartRankedEvents.filter(event => !this.isArchivedEvent(event)).slice(0, 3);
  }

  get trendingEventHighlights(): EventAiRankedEventResponse[] {
    return this.smartRankedEvents
      .filter(event => !this.isArchivedEvent(event) && event.aiInsight.momentum === 'hot')
      .slice(0, 3);
  }

  get almostFullHighlights(): EventAiRankedEventResponse[] {
    return this.smartRankedEvents
      .filter(event => !this.isArchivedEvent(event) && this.getCapacityTone(event) === 'warning')
      .slice(0, 3);
  }

  get smartDashboardStats(): { trending: number; popular: number; almostFull: number; avgScore: number } {
    if (this.backendDashboardSummary && !this.hasActiveFilters()) {
      return this.backendDashboardSummary;
    }

    const active = this.smartRankedEvents.filter(event => !this.isArchivedEvent(event));
    const avgScore = active.length
      ? Math.round(active.reduce((sum, event) => sum + event.aiInsight.score, 0) / active.length)
      : 0;

    return {
      trending: active.filter(event => event.aiInsight.momentum === 'hot').length,
      popular: active.filter(event => event.aiInsight.popularityScore >= 70).length,
      almostFull: active.filter(event => this.getCapacityTone(event) === 'warning').length,
      avgScore,
    };
  }

  get aiRefreshLabel(): string {
    if (!this.aiLastRefreshAt) {
      return 'Sync in progress';
    }

    const formatted = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(this.aiLastRefreshAt);
    return `Last update ${formatted}`;
  }

  get smartStatisticsCards(): Array<{ label: string; value: number | string; hint: string }> {
    if (
      this.backendSmartStatisticsCards.length &&
      !this.hasActiveFilters() &&
      this.backendSmartStatisticsCards.every(stat => this.isUsableStatisticValue(stat.value))
    ) {
      return this.backendSmartStatisticsCards;
    }

    const active = this.smartRankedEvents.filter(event => !this.isArchivedEvent(event));
    const totalViews = active.reduce((sum, event) => sum + (event.views ?? 0), 0);
    const totalRegistrations = active.reduce(
      (sum, event) => sum + (event.participantsCount ?? event.registrationCount ?? 0),
      0
    );
    const avgParticipationRate = active.length
      ? Math.round(active.reduce((sum, event) => sum + this.getCapacityPercent(event), 0) / active.length)
      : 0;
    const openSeats = active.reduce((sum, event) => {
      if (!event.capacity || event.capacity <= 0) {
        return sum;
      }

      return sum + Math.max(0, event.capacity - (event.participantsCount ?? 0));
    }, 0);

    return [
      { label: 'Total Views', value: totalViews, hint: 'Audience reach captured across active events' },
      { label: 'Registrations', value: totalRegistrations, hint: 'Confirmed participants used by the AI score' },
      { label: 'Avg Participation', value: `${avgParticipationRate}%`, hint: 'Average fill rate for visible events' },
      { label: 'Seats Available', value: openSeats, hint: 'Remaining capacity still open for registrations' },
    ];
  }

  get planningHistoryEvents(): PlanningEvent[] {
    const rankedInsightById = new Map(
      this.backendRankedEvents.map(event => [event.id, event.aiInsight] as const)
    );

    const mergedHistory: PlanningEvent[] = this.allEvents.map(event => ({
      ...event,
      aiInsight: rankedInsightById.get(event.id),
    }));

    const filteredHistory = mergedHistory.filter(event => {
      if (!this.matchesPlanningFilters(event)) {
        return false;
      }

      return this.isHistoricalPlanningEvent(event);
    });

    if (filteredHistory.length) {
      return filteredHistory;
    }

    const historicalEvents = mergedHistory.filter(event => this.isHistoricalPlanningEvent(event));
    if (historicalEvents.length) {
      return historicalEvents;
    }

    const filteredReferenceEvents = mergedHistory.filter(event => {
      if (!this.matchesPlanningFilters(event)) {
        return false;
      }

      return event.status !== 'CANCELLED';
    });
    if (filteredReferenceEvents.length) {
      return filteredReferenceEvents;
    }

    const referenceEvents = mergedHistory.filter(event => event.status !== 'CANCELLED');
    if (referenceEvents.length) {
      return referenceEvents;
    }

    return this.backendRankedEvents.filter(event => this.isHistoricalPlanningEvent(event));
  }

  get planningSourceEventsCount(): number {
    const localCount = this.planningHistoryEvents.length;
    if (this.backendSchedulingOptimizer) {
      const analyzedPastEvents = this.backendSchedulingOptimizer.analyzedPastEvents ?? 0;
      return analyzedPastEvents > 0 ? analyzedPastEvents : localCount;
    }
    return localCount;
  }

  get planningBestDay(): PlanningInsightBar | null {
    if (this.backendSchedulingOptimizer?.bestDay) {
      return this.mapBackendSchedulingSlot(this.backendSchedulingOptimizer.bestDay);
    }
    return this.buildPlanningBars('day')[0] ?? null;
  }

  get planningBestHour(): PlanningInsightBar | null {
    if (this.backendSchedulingOptimizer?.bestHour) {
      return this.mapBackendSchedulingSlot(this.backendSchedulingOptimizer.bestHour);
    }
    return this.buildPlanningBars('hour')[0] ?? null;
  }

  get planningBestMonth(): PlanningInsightBar | null {
    if (this.backendSchedulingOptimizer?.bestMonth) {
      return this.mapBackendSchedulingSlot(this.backendSchedulingOptimizer.bestMonth);
    }
    return this.buildPlanningBars('month')[0] ?? null;
  }

  get planningDayPerformance(): PlanningInsightBar[] {
    if (this.backendSchedulingOptimizer?.topDays?.length) {
      return this.backendSchedulingOptimizer.topDays.map(slot => this.mapBackendSchedulingSlot(slot));
    }
    return this.buildPlanningBars('day').slice(0, 4);
  }

  get planningHourPerformance(): PlanningInsightBar[] {
    if (this.backendSchedulingOptimizer?.topHours?.length) {
      return this.backendSchedulingOptimizer.topHours.map(slot => this.mapBackendSchedulingSlot(slot));
    }
    return this.buildPlanningBars('hour').slice(0, 4);
  }

  get planningMonthlyTrend(): PlanningTrendPoint[] {
    if (this.backendSchedulingOptimizer?.monthlyTrend?.length) {
      return this.backendSchedulingOptimizer.monthlyTrend.map(point => this.mapBackendTrendPoint(point));
    }

    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const groups = new Map<string, PlanningEvent[]>();

    this.planningHistoryEvents.forEach(event => {
      if (!event.startDate) return;
      const date = new Date(event.startDate);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(event);
      groups.set(key, bucket);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, events]) => {
        const [, monthIndexRaw] = key.split('-');
        const monthIndex = Number(monthIndexRaw);
        const participants = this.averageParticipants(events);
        const fillRate = this.averageFillRate(events);
        const score = this.computePlanningPerformanceScore(events);

        return {
          label: `${monthOrder[monthIndex]} ${key.split('-')[0]}`,
          shortLabel: monthOrder[monthIndex],
          participants,
          fillRate,
          score,
        };
      });
  }

  get planningHistoricalTrend(): PlanningTrendPoint[] {
    if (this.backendSchedulingOptimizer?.historicalTrend?.length) {
      return this.backendSchedulingOptimizer.historicalTrend.map(point => this.mapBackendTrendPoint(point));
    }

    return this.planningHistoryEvents
      .filter(event => !!event.startDate)
      .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
      .slice(-8)
      .map((event, index, source) => {
        const participants = event.participantsCount ?? 0;
        const previous = index > 0 ? (source[index - 1].participantsCount ?? 0) : participants;
        return {
          label: this.formatDate(event.startDate),
          shortLabel: this.shortDateLabel(event.startDate),
          participants,
          fillRate: this.averageFillRate([event]),
          score: event.aiInsight?.score ?? this.computePlanningPerformanceScore([event]),
          projected: false,
          changeRate: previous > 0 ? Math.round(((participants - previous) / previous) * 100) : 0,
        };
      });
  }

  get planningForecastTrend(): PlanningTrendPoint[] {
    if (this.backendSchedulingOptimizer?.forecastTrend?.length) {
      return this.backendSchedulingOptimizer.forecastTrend.map(point => this.mapBackendTrendPoint(point));
    }

    const historical = this.planningHistoricalTrend;
    if (!historical.length) {
      return [];
    }

    const participants = historical.map(point => point.participants);
    const fillRates = historical.map(point => point.fillRate);
    const scores = historical.map(point => point.score);
    const slope = this.computeAverageDelta(participants);
    const baseParticipants = this.averageLastValues(participants, 3);
    const baseFillRate = this.averageLastValues(fillRates, 3);
    const baseScore = this.averageLastValues(scores, 3);
    const anchor = this.resolvePlanningAnchorDate();
    const forecast: PlanningTrendPoint[] = [];
    let previousParticipants = historical[historical.length - 1].participants;

    for (let i = 1; i <= 3; i++) {
      const projectedDate = new Date(anchor);
      projectedDate.setMonth(projectedDate.getMonth() + i);
      const predictedParticipants = Math.max(0, Math.round(baseParticipants + (slope * i)));
      const changeRate = previousParticipants > 0
        ? Math.round(((predictedParticipants - previousParticipants) / previousParticipants) * 100)
        : 0;

      forecast.push({
        label: this.longMonthYearLabel(projectedDate),
        shortLabel: this.shortMonthLabel(projectedDate),
        participants: predictedParticipants,
        fillRate: this.clamp(Math.round(baseFillRate + (slope * 0.45 * i)), 25, 100),
        score: this.clamp(Math.round(baseScore + (slope * 0.3 * i)), 20, 100),
        projected: true,
        changeRate,
      });

      previousParticipants = predictedParticipants;
    }

    return forecast;
  }

  get planningCombinedTrend(): PlanningTrendPoint[] {
    return [...this.planningHistoricalTrend, ...this.planningForecastTrend];
  }

  get planningTrendMaxParticipants(): number {
    const max = Math.max(...this.planningCombinedTrend.map(item => item.participants), 0);
    return max || 100;
  }

  get planningTrendDirection(): 'up' | 'down' | 'stable' {
    const backendDirection = this.backendSchedulingOptimizer?.trendDirection;
    if (backendDirection === 'up' || backendDirection === 'down' || backendDirection === 'stable') {
      return backendDirection;
    }

    const historical = this.planningHistoricalTrend;
    const forecast = this.planningForecastTrend;
    if (!historical.length || !forecast.length) {
      return 'stable';
    }

    const lastHistorical = historical[historical.length - 1].participants;
    const lastForecast = forecast[forecast.length - 1].participants;
    if (lastHistorical <= 0) {
      return lastForecast > 0 ? 'up' : 'stable';
    }

    const delta = Math.round(((lastForecast - lastHistorical) / lastHistorical) * 100);
    if (delta >= 8) return 'up';
    if (delta <= -8) return 'down';
    return 'stable';
  }

  get planningTrendDeltaPercent(): number {
    if (typeof this.backendSchedulingOptimizer?.trendDeltaPercent === 'number') {
      return this.backendSchedulingOptimizer.trendDeltaPercent;
    }

    const historical = this.planningHistoricalTrend;
    const forecast = this.planningForecastTrend;
    if (!historical.length || !forecast.length) {
      return 0;
    }

    const lastHistorical = historical[historical.length - 1].participants;
    if (lastHistorical <= 0) {
      return 0;
    }

    return Math.round(((forecast[forecast.length - 1].participants - lastHistorical) / lastHistorical) * 100);
  }

  get planningSuccessProbability(): number {
    if (typeof this.backendSchedulingOptimizer?.successProbability === 'number') {
      return this.backendSchedulingOptimizer.successProbability;
    }

    const slotScore = Math.round((((this.planningBestDay?.value ?? 50) + (this.planningBestHour?.value ?? 50)) / 2));
    const trendBonus = this.planningTrendDirection === 'up' ? 8 : this.planningTrendDirection === 'down' ? -8 : 0;
    return this.clamp(Math.round((this.planningConfidence * 0.45) + (slotScore * 0.35) + (Math.min(25, this.planningExpectedLift) * 0.8) + trendBonus), 35, 99);
  }

  get planningForecastNarrative(): string {
    if (this.backendSchedulingOptimizer?.forecastNarrative) {
      return this.backendSchedulingOptimizer.forecastNarrative;
    }

    const slotText = this.planningBestDay && this.planningBestHour
      ? `${this.planningBestDay.label.toLowerCase()} autour de ${this.planningBestHour.label.toLowerCase()}`
      : 'sur les creneaux les plus performants';

    if (this.planningTrendDirection === 'up') {
      return `La prediction indique une hausse d'environ ${this.planningTrendDeltaPercent}% de participation, surtout ${slotText}.`;
    }

    if (this.planningTrendDirection === 'down') {
      return `La prediction anticipe un leger recul. Priorisez ${slotText} pour contenir la baisse.`;
    }

    return `La tendance reste stable. Les meilleurs resultats devraient rester concentres ${slotText}.`;
  }

  get planningForecastHighlights(): string[] {
    if (this.backendSchedulingOptimizer?.forecastHighlights?.length) {
      return this.backendSchedulingOptimizer.forecastHighlights;
    }

    const highlights: string[] = [];

    if (this.planningTrendDirection === 'up') {
      highlights.push(`Croissance projetee de ${this.planningTrendDeltaPercent}%`);
    } else if (this.planningTrendDirection === 'down') {
      highlights.push('Ralentissement attendu sur les prochains evenements');
    } else {
      highlights.push('Tendance stable sur l historique recent');
    }

    if (this.planningBestDay) {
      highlights.push(`${this.planningBestDay.label} reste le meilleur jour`);
    }

    if (this.planningBestHour) {
      highlights.push(`${this.planningBestHour.label} concentre le meilleur remplissage`);
    }

    if (this.planningBestMonth) {
      highlights.push(`${this.planningBestMonth.label} est la meilleure periode`);
    }

    return highlights.slice(0, 4);
  }

  get planningTrendMaxScore(): number {
    const max = Math.max(...this.planningMonthlyTrend.map(item => item.score), 0);
    return max || 100;
  }

  get planningPredictionParticipants(): number {
    if (this.backendSchedulingOptimizer) {
      return this.backendSchedulingOptimizer.predictionParticipants ?? 0;
    }
    const bestDay = this.planningBestDay;
    const bestHour = this.planningBestHour;
    const history = this.planningHistoryEvents;

    if (!history.length) {
      return 0;
    }

    const baseParticipants = history.length
      ? Math.round(history.reduce((sum, event) => sum + (event.participantsCount ?? 0), 0) / history.length)
      : 0;

    const bestDayBoost = bestDay ? Math.round(bestDay.participants * 0.18) : 0;
    const bestHourBoost = bestHour ? Math.round(bestHour.participants * 0.12) : 0;
    const scoreBoost = this.smartDashboardStats.avgScore >= 70 ? 6 : 0;

    return Math.max(baseParticipants, baseParticipants + bestDayBoost + bestHourBoost + scoreBoost);
  }

  get planningExpectedLift(): number {
    if (this.backendSchedulingOptimizer) {
      return this.backendSchedulingOptimizer.expectedLift ?? 0;
    }
    const history = this.planningHistoryEvents;
    if (!history.length) {
      return 0;
    }

    const baseline = history.reduce((sum, event) => sum + (event.participantsCount ?? 0), 0) / history.length;
    if (!baseline) {
      return 0;
    }

    return Math.max(0, Math.round(((this.planningPredictionParticipants - baseline) / baseline) * 100));
  }

  get planningConfidence(): number {
    if (this.backendSchedulingOptimizer) {
      return this.backendSchedulingOptimizer.confidence ?? 0;
    }
    const sample = this.planningSourceEventsCount;
    if (sample >= 12) return 92;
    if (sample >= 8) return 84;
    if (sample >= 5) return 74;
    if (sample >= 3) return 63;
    return 48;
  }

  get planningRecommendationTitle(): string {
    if (this.backendSchedulingOptimizer?.recommendationTitle) {
      return this.backendSchedulingOptimizer.recommendationTitle;
    }
    if (!this.planningBestDay || !this.planningBestHour) {
      return 'Créneau recommandé à construire';
    }

    return `${this.planningBestDay.label} • ${this.planningBestHour.label}`;
  }

  get planningRecommendationNarrative(): string {
    if (this.backendSchedulingOptimizer?.recommendationNarrative) {
      return this.backendSchedulingOptimizer.recommendationNarrative;
    }
    if (!this.planningBestDay || !this.planningBestHour) {
      return 'Pas assez d’historique pour isoler un créneau optimal. Continuez à publier des événements pour enrichir le modèle.';
    }

    return `Les événements organisés ${this.planningBestDay.label.toLowerCase()} autour de ${this.planningBestHour.label.toLowerCase()} performent le mieux dans votre historique.`;
  }

  get planningRecommendationBullets(): string[] {
    const bullets: string[] = [];

    if (this.planningBestDay) {
      bullets.push(`${this.planningBestDay.label}: ${this.planningBestDay.participants} participants en moyenne`);
    }

    if (this.planningBestHour) {
      bullets.push(`${this.planningBestHour.label}: ${this.planningBestHour.fillRate}% de remplissage moyen`);
    }

    if (this.planningBestMonth) {
      bullets.push(`${this.planningBestMonth.label}: période historiquement la plus porteuse`);
    }

    if (this.planningExpectedLift > 0) {
      bullets.push(`Jusqu’à ${this.planningExpectedLift}% de participation attendue en plus`);
    }

    return bullets.slice(0, 4);
  }

  get planningInsightCards(): Array<{ label: string; value: string; hint: string; tone: 'blue' | 'green' | 'amber' | 'teal' }> {
    return [
      {
        label: 'Meilleur jour',
        value: this.planningBestDay?.label ?? 'En calcul',
        hint: this.planningBestDay
          ? `${this.planningBestDay.participants} participants moyens`
          : 'Historique insuffisant',
        tone: 'blue',
      },
      {
        label: 'Meilleure plage',
        value: this.planningBestHour?.label ?? 'En calcul',
        hint: this.planningBestHour
          ? `${this.planningBestHour.fillRate}% de remplissage moyen`
          : 'Historique insuffisant',
        tone: 'teal',
      },
      {
        label: 'Prévision IA',
        value: this.planningPredictionParticipants ? `${this.planningPredictionParticipants} pax` : 'N/A',
        hint: 'Projection basée sur l’historique et le score IA',
        tone: 'green',
      },
      {
        label: 'Confiance',
        value: `${this.planningConfidence}%`,
        hint: `${this.planningSourceEventsCount} événements passés analysés`,
        tone: 'amber',
      },
    ];
  }

  private isUsableStatisticValue(value: number | string): boolean {
    if (typeof value === 'number') {
      return Number.isFinite(value) && Math.abs(value) <= 1_000_000;
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
      return false;
    }

    const normalized = trimmed.replace(/[,%\s]/g, '');
    const parsed = Number(normalized);
    return Number.isNaN(parsed) || Math.abs(parsed) <= 1_000_000;
  }

  private matchesPlanningFilters(event: EventItem): boolean {
    if (this.selectedCategory && (event.category || '').toUpperCase() !== this.selectedCategory) {
      return false;
    }

    if (this.isCustomCategory && this.customCategoryInput.trim()) {
      const needle = this.customCategoryInput.trim().toLowerCase();
      if (!(event.category || '').toLowerCase().includes(needle)) {
        return false;
      }
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      const haystacks = [
        event.title,
        event.description || '',
        event.locationName || '',
      ].map(value => value.toLowerCase());

      if (!haystacks.some(value => value.includes(term))) {
        return false;
      }
    }

    return true;
  }

  private isHistoricalPlanningEvent(event: EventItem): boolean {
    if (!event.startDate) {
      return false;
    }

    const startTime = new Date(event.startDate).getTime();
    return Number.isFinite(startTime) && startTime < Date.now();
  }

  private buildPlanningBars(mode: 'day' | 'hour' | 'month'): PlanningInsightBar[] {
    const groups = new Map<string, PlanningEvent[]>();

    this.planningHistoryEvents.forEach(event => {
      if (!event.startDate) return;

      const date = new Date(event.startDate);
      const key = this.getPlanningGroupKey(date, mode);
      const bucket = groups.get(key) ?? [];
      bucket.push(event);
      groups.set(key, bucket);
    });

    return Array.from(groups.entries())
      .map(([key, events]) => {
        const participants = this.averageParticipants(events);
        const fillRate = this.averageFillRate(events);
        const score = this.computePlanningPerformanceScore(events);

        return {
          label: this.getPlanningGroupLabel(key, mode),
          shortLabel: this.getPlanningShortLabel(key, mode),
          value: score,
          participants,
          fillRate,
          count: events.length,
        };
      })
      .sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        if (b.fillRate !== a.fillRate) return b.fillRate - a.fillRate;
        return b.participants - a.participants;
      });
  }

  private computePlanningPerformanceScore(events: PlanningEvent[]): number {
    if (!events.length) {
      return 0;
    }

    const avgParticipants = this.averageParticipants(events);
    const avgFillRate = this.averageFillRate(events);
    const avgAiScore = Math.round(events.reduce((sum, event) => sum + (event.aiInsight?.score ?? 0), 0) / events.length);
    const consistencyBoost = Math.min(12, events.length * 3);

    return Math.min(
      100,
      Math.round((avgParticipants * 0.45) + (avgFillRate * 0.35) + (avgAiScore * 0.20) + consistencyBoost)
    );
  }

  private averageParticipants(events: EventItem[]): number {
    if (!events.length) return 0;
    return Math.round(events.reduce((sum, event) => sum + (event.participantsCount ?? 0), 0) / events.length);
  }

  private averageFillRate(events: EventItem[]): number {
    if (!events.length) return 0;
    return Math.round(events.reduce((sum, event) => sum + this.getCapacityPercent(event), 0) / events.length);
  }

  private getPlanningGroupKey(date: Date, mode: 'day' | 'hour' | 'month'): string {
    if (mode === 'day') {
      return String(date.getDay());
    }

    if (mode === 'hour') {
      return String(date.getHours());
    }

    return String(date.getMonth());
  }

  private getPlanningGroupLabel(key: string, mode: 'day' | 'hour' | 'month'): string {
    const dayLabels = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const monthLabels = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

    if (mode === 'day') {
      return dayLabels[Number(key)] ?? key;
    }

    if (mode === 'hour') {
      const start = Number(key);
      const end = (start + 3) % 24;
      return `${String(start).padStart(2, '0')}h-${String(end).padStart(2, '0')}h`;
    }

    return monthLabels[Number(key)] ?? key;
  }

  private getPlanningShortLabel(key: string, mode: 'day' | 'hour' | 'month'): string {
    const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (mode === 'day') {
      return dayLabels[Number(key)] ?? key;
    }

    if (mode === 'hour') {
      return `${String(Number(key)).padStart(2, '0')}h`;
    }

    return monthLabels[Number(key)] ?? key;
  }

  private mapBackendSchedulingSlot(slot: EventAiSchedulingSlotResponse): PlanningInsightBar {
    return {
      label: slot.label,
      shortLabel: slot.shortLabel,
      value: slot.score,
      participants: slot.participants,
      fillRate: slot.fillRate,
      count: slot.sampleSize,
    };
  }

  private mapBackendTrendPoint(point: EventAiSchedulingTrendPointResponse): PlanningTrendPoint {
    return {
      label: point.label,
      shortLabel: point.shortLabel,
      participants: point.participants,
      fillRate: point.fillRate,
      score: point.score,
      projected: point.projected ?? false,
      changeRate: point.changeRate ?? 0,
    };
  }

  get planningChartPolyline(): string {
    return this.buildPlanningPolyline(this.planningCombinedTrend, 220, 148);
  }

  get planningChartAreaPath(): string {
    return this.buildPlanningAreaPath(this.planningCombinedTrend, 220, 148);
  }

  get planningChartPoints(): Array<PlanningTrendPoint & { x: number; y: number }> {
    return this.buildPlanningChartPoints(this.planningCombinedTrend, 220, 148);
  }

  private buildPlanningChartPoints(points: PlanningTrendPoint[], width: number, height: number): Array<PlanningTrendPoint & { x: number; y: number }> {
    if (!points.length) {
      return [];
    }

    const paddingX = 10;
    const paddingY = 10;
    const usableWidth = width - (paddingX * 2);
    const usableHeight = height - (paddingY * 2);
    const maxParticipants = this.planningTrendMaxParticipants;

    return points.map((point, index) => {
      const x = points.length === 1
        ? width / 2
        : paddingX + ((usableWidth / (points.length - 1)) * index);
      const y = paddingY + (usableHeight - ((point.participants / maxParticipants) * usableHeight));
      return { ...point, x, y };
    });
  }

  private buildPlanningPolyline(points: PlanningTrendPoint[], width: number, height: number): string {
    return this.buildPlanningChartPoints(points, width, height)
      .map(point => `${point.x},${point.y}`)
      .join(' ');
  }

  private buildPlanningAreaPath(points: PlanningTrendPoint[], width: number, height: number): string {
    const chartPoints = this.buildPlanningChartPoints(points, width, height);
    if (!chartPoints.length) {
      return '';
    }

    const baseline = height - 10;
    const line = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
  }

  private computeAverageDelta(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    let total = 0;
    for (let i = 1; i < values.length; i++) {
      total += values[i] - values[i - 1];
    }
    return total / (values.length - 1);
  }

  private averageLastValues(values: number[], size: number): number {
    if (!values.length) {
      return 0;
    }

    const slice = values.slice(Math.max(0, values.length - size));
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  }

  private resolvePlanningAnchorDate(): Date {
    const latest = this.planningHistoryEvents
      .filter(event => !!event.startDate)
      .map(event => new Date(event.startDate!))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return latest ?? new Date();
  }

  private shortDateLabel(date?: string | Date): string {
    if (!date) {
      return '--';
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return '--';
    }

    return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }

  private shortMonthLabel(date: Date): string {
    const labels = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
    return labels[date.getMonth()] ?? '--';
  }

  private longMonthYearLabel(date: Date): string {
    return `${this.shortMonthLabel(date)} ${date.getFullYear()}`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPAIGNS (owned — PRESIDENT)
  // ═══════════════════════════════════════════════════════════════════════════
  toggleCampaignsPanel(): void {
    this.showCampaignsPanel = !this.showCampaignsPanel;
    // Fermer l'autre panel si ouvert
    if (this.showCampaignsPanel) {
      this.showAccessibleCampaignsPanel = false;
    }
  }

  canAddEventToCampaign(campaign: Campaign): boolean {
    // Check both canAddEvent flag and campaign status
    if (!campaign.canAddEvent) return false;
    
    // Only PLANNED and ACTIVE statuses allow adding events
    const allowedStatuses = ['PLANNED', 'ACTIVE'];
    return allowedStatuses.includes(campaign.status || '');
  }

  // Get message for blocked campaign status
  getCampaignStatusMessage(campaign: Campaign): string {
    if (this.canAddEventToCampaign(campaign)) return '';
    
    const statusLabels: { [key: string]: string } = {
      'LOCKED': 'Verrouillée',
      'DISABLED': 'Désactivée',
      'ARCHIVED': 'Archivée',
      'FINISHED': 'Terminée',
      'CANCELLED': 'Annulée'
    };
    
    const status = campaign.status || '';
    return `L'ajout d'événements est interdit car la campagne est dans un état "${statusLabels[status] || status}". Seuls les événements peuvent être créés dans les campagnes "Planifiée" ou "Active".`;
  }

  addEventToCampaign(campaign: Campaign): void {
    // Check if campaign status allows adding events
    if (!this.canAddEventToCampaign(campaign)) {
      alert(this.getCampaignStatusMessage(campaign));
      return;
    }
    
    this.router.navigate(['/dashboard/events/create'], {
      queryParams: { campaignId: campaign.id }
    });
  }

  getCampaignProgress(campaign: Campaign): number {
    if (!campaign.maxParticipants || campaign.maxParticipants <= 0) return 0;
    return Math.min(100, ((campaign.currentParticipants || 0) / campaign.maxParticipants) * 100);
  }

  getVisibilityLabel(visibility: string): string {
    const map: Record<string, string> = {
      PUBLIC:  'Public',
      SHARED:  'Shared',
      PRIVATE: 'Private',
    };
    return map[visibility] ?? visibility;
  }

  getCampaignStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PLANNED:   'Planned',
      ACTIVE:    'Active',
      LOCKED:    'Locked',
      DISABLED:  'Disabled',
      ARCHIVED:  'Archived',
      FINISHED:  'Finished',
      CANCELLED: 'Cancelled',
    };
    return map[status] ?? status;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR
  // ═══════════════════════════════════════════════════════════════════════════
  get calendarEvents(): EventItem[] {
    return this.allEvents.filter(e => e.status !== 'CANCELLED');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS LABEL
  // ═══════════════════════════════════════════════════════════════════════════
  getStatusLabel(status?: string): string {
    const map: Record<string, string> = {
      PLANNED:   'Upcoming',
      ONGOING:   'Live',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    };
    return map[status ?? ''] ?? status ?? '—';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORY TOGGLE
  // ═══════════════════════════════════════════════════════════════════════════
  toggleHistoryView(): void {
    this.isViewingHistory = !this.isViewingHistory;
    this.currentPage      = 1;
    // Fermer les panels lors du changement de vue
    this.showCampaignsPanel           = false;
    this.showAccessibleCampaignsPanel = false;
    this.refreshDisplayedEvents();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY FILTER
  // ═══════════════════════════════════════════════════════════════════════════
  setCategoryFilter(cat: string): void {
    this.selectedCategory    = cat;
    this.customCategoryInput = '';
    this.isCustomCategory    = false;
    this.currentPage         = 1;
    this.applyFilters();
  }

  onCustomCategoryInput(): void {
    const val = this.customCategoryInput.trim().toUpperCase();
    if ((KNOWN_CATEGORIES as readonly string[]).includes(val)) {
      this.selectedCategory    = val;
      this.customCategoryInput = '';
      this.isCustomCategory    = false;
    } else {
      this.selectedCategory = '';
      this.isCustomCategory = val.length > 0;
    }
    this.currentPage = 1;
    this.applyFilters();
  }

  applyCustomCategory(): void {
    if (this.customCategoryInput.trim()) {
      this.isCustomCategory = true;
      this.applyFilters();
    }
  }

  clearCustomCategory(): void {
    this.customCategoryInput = '';
    this.isCustomCategory    = false;
    this.selectedCategory    = '';
    this.currentPage         = 1;
    this.applyFilters();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  clearDateFilter(): void {
    this.selectedDate = '';
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return !!(this.selectedCategory || this.isCustomCategory || this.selectedDate || this.searchTerm.trim());
  }

  clearAllFilters(): void {
    this.selectedCategory    = '';
    this.customCategoryInput = '';
    this.isCustomCategory    = false;
    this.selectedDate        = '';
    this.searchTerm          = '';
    this.currentPage         = 1;
    this.applyFilters();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MASTER FILTER
  // ═══════════════════════════════════════════════════════════════════════════
  applyFilters(): void {
    let result = [...this.displayedEvents];

    if (this.selectedCategory) {
      result = result.filter(e =>
        (e.category || '').toUpperCase() === this.selectedCategory
      );
    }

    if (this.isCustomCategory && this.customCategoryInput.trim()) {
      const needle = this.customCategoryInput.trim().toLowerCase();
      result = result.filter(e =>
        (e.category || '').toLowerCase().includes(needle)
      );
    }

    if (this.selectedDate) {
      result = result.filter(e => {
        const d = new Date(e.startDate!);
        return d.toISOString().substring(0, 10) === this.selectedDate;
      });
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(term) ||
        (e.description  || '').toLowerCase().includes(term) ||
        (e.locationName || '').toLowerCase().includes(term)
      );
    }

    this.filteredEvents = result;
    const visibleIds = new Set(result.map(event => event.id));
    this.smartRankedEvents = this.backendRankedEvents.filter(event => visibleIds.has(event.id));
    this.totalPages     = Math.max(1, Math.ceil(result.length / this.pageSize));
    this.currentPage    = Math.min(this.currentPage, this.totalPages);
    this.buildPageNumbers();
    this.paginate();
  }

  private mapBackendRankedEvents(dashboard: EventAiDashboardResponse): EventAiRankedEventResponse[] {
    const ranked = dashboard.rankedEvents || [];
    const fallback = ranked.length
      ? ranked
      : (dashboard.highlights?.length ? dashboard.highlights : dashboard.trendingEvents || []);

    return fallback.map((event: EventAiRankedEventResponse) => ({
      ...event,
      aiInsight: {
        ...event.aiInsight,
        reasons: event.aiInsight?.reasons || [],
        urgencyScore: event.aiInsight?.urgencyScore ?? this.computeOrganizerUrgencyScore(event),
        predictedTrend: event.aiInsight?.predictedTrend ?? this.computeOrganizerPredictedTrend(event),
        scoreBreakdown: event.aiInsight?.scoreBreakdown?.length
          ? event.aiInsight.scoreBreakdown
          : this.buildOrganizerScoreBreakdown(event),
        dominantFactors: event.aiInsight?.dominantFactors?.length
          ? event.aiInsight.dominantFactors
          : this.buildOrganizerScoreBreakdown(event)
          .sort((a, b) => b.contribution - a.contribution)
          .slice(0, 3)
          .map(item => item.label),
        structuredExplanation: event.aiInsight?.structuredExplanation ?? {
          headline: this.buildOrganizerExplanationHeadline(event),
          reasons: this.buildOrganizerReasons(event),
          dominantFactors: this.buildOrganizerScoreBreakdown(event)
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, 3)
            .map(item => item.label),
        },
        fallbackStrategy: event.aiInsight?.fallbackStrategy ?? (this.isNewOrganizerEvent(event)
          ? 'New event fallback: baseline score uses timing and default popularity.'
          : 'Primary score comes from backend event intelligence with lightweight frontend display helpers.'),
      },
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════════════════════════
  paginate(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedEvents = this.filteredEvents.slice(start, start + this.pageSize);
  }

  buildPageNumbers(): void {
    this.pageNumbers = Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  prevPage(): void {
    if (this.currentPage > 1) { this.currentPage--; this.paginate(); }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) { this.currentPage++; this.paginate(); }
  }

  goToPage(p: number): void {
    this.currentPage = p;
    this.paginate();
  }

  shouldShowPage(p: number, current: number, total: number): boolean {
    if (total <= 7) return true;
    return p === 1 || p === total || Math.abs(p - current) <= 1;
  }

  shouldShowEllipsis(p: number, current: number, total: number): boolean {
    if (total <= 7) return false;
    const nextShown = p + 1;
    return (
      !this.shouldShowPage(p, current, total) &&
       this.shouldShowPage(nextShown, current, total) &&
       nextShown - p > 1
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAPACITY HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  getCapacityStatusColor(event: EventItem): string {
    if (!event.capacity || event.capacity <= 0) return 'success';
    const remaining = event.capacity - (event.participantsCount || 0);
    if (remaining <= 0)                     return 'danger';
    if (remaining <= event.capacity * 0.10) return 'warning';
    return 'success';
  }

  getCapacityStatusLabel(event: EventItem): string {
    if (!event.capacity || event.capacity <= 0) return 'Unlimited';
    const remaining = event.capacity - (event.participantsCount || 0);
    if (remaining <= 0) return 'Full';
    return `${remaining} left`;
  }

  getCapacityPercent(event: EventItem): number {
    if (!event.capacity || event.capacity <= 0) return 0;
    return Math.min(100, ((event.participantsCount || 0) / event.capacity) * 100);
  }

  isOnlineEvent(event: EventItem): boolean {
    return event.eventType === 'ONLINE';
  }

  canJoinMeeting(event: EventItem): boolean {
    return this.isOnlineEvent(event) && !!event.meetingUrl;
  }

  joinMeeting(event: EventItem): void {
    if (!event.meetingUrl) {
      return;
    }
    window.open(event.meetingUrl, '_blank', 'noopener');
  }

  getCapacityTone(event: EventItem): 'danger' | 'warning' | 'safe' {
    if (!event.capacity || event.capacity <= 0) return 'safe';
    const remaining = event.capacity - (event.participantsCount || 0);
    if (remaining <= 0) return 'danger';
    if (remaining <= Math.max(3, Math.ceil(event.capacity * 0.12))) return 'warning';
    return 'safe';
  }

  getAiBadgeLabel(event: EventAiRankedEventResponse): string {
    if (this.getCapacityTone(event) === 'warning') return 'Almost Full';
    if (event.aiInsight.momentum === 'hot') return 'Trending';
    if (event.aiInsight.popularityScore >= 70) return 'Popular';
    return 'Monitored';
  }

  getAiBadgeClass(event: EventAiRankedEventResponse): string {
    return `ai-badge--${this.getAiBadgeLabel(event).toLowerCase().replace(/\s+/g, '-')}`;
  }

  getMomentumLabel(momentum: 'hot' | 'rising' | 'stable'): string {
    const map: Record<string, string> = {
      hot: 'High momentum',
      rising: 'Rising',
      stable: 'Stable',
    };
    return map[momentum] ?? momentum;
  }

  getPerformanceScore(eventId: number): number {
    return this.smartRankedEvents.find(event => event.id === eventId)?.aiInsight.score ?? 0;
  }

  getEventInsight(eventId: number): EventAiInsightResponse | undefined {
    return this.smartRankedEvents.find(event => event.id === eventId)?.aiInsight;
  }

  getPerformanceRows(eventId: number): Array<{ label: string; value: number }> {
    const insight = this.getEventInsight(eventId);
    if (!insight) return [];

    return [
      { label: 'Popularity', value: insight.popularityScore },
      { label: 'Trend', value: insight.trendScore },
      { label: 'Urgency', value: insight.urgencyScore ?? insight.participationScore },
      { label: 'Conversion', value: insight.conversionScore },
    ];
  }

  getEventInsightReasons(eventId: number): string[] {
    const insight = this.getEventInsight(eventId);
    const reasons = insight?.structuredExplanation?.reasons || insight?.reasons || [];
    if (reasons.length) {
      return reasons;
    }

    return ['Cold-start mode: score estimated from recency and baseline engagement'];
  }

  getEventUrgencyMessage(event: EventItem): string {
    const tone = this.getCapacityTone(event);
    if (tone === 'danger') {
      return 'Capacity reached';
    }
    if (tone === 'warning') {
      return 'Nearly full';
    }
    if (event.views && event.views >= 200) {
      return 'High audience demand';
    }
    return 'Steady demand';
  }

  getEventScoreBreakdown(eventId: number): Array<{ label: string; value: number; weight: number; contribution: number }> {
    return this.getEventInsight(eventId)?.scoreBreakdown ?? [];
  }

  getEventDominantFactors(eventId: number): string[] {
    return this.getEventInsight(eventId)?.dominantFactors ?? [];
  }

  getEventPredictionLabel(eventId: number): string {
    const predictedTrend = this.getEventInsight(eventId)?.predictedTrend;
    const labels: Record<string, string> = {
      'future-trending': 'Likely to become trending',
      watchlist: 'Growth to watch',
      stable: 'Demand remains stable',
    };
    return labels[predictedTrend || 'stable'] || 'Demand remains stable';
  }

  private computeOrganizerUrgencyScore(event: EventItem): number {
    if (!event.capacity || event.capacity <= 0) {
      return event.startDate ? 35 : 20;
    }

    const fillRate = Math.min(100, Math.round(((event.participantsCount || 0) / event.capacity) * 100));
    const daysUntil = this.getOrganizerDaysUntilEvent(event);
    const timePressure = daysUntil == null
      ? 25
      : daysUntil <= 0
        ? 100
        : daysUntil <= 2
          ? 90
          : daysUntil <= 7
            ? 68
            : daysUntil <= 14
              ? 45
              : 22;

    return Math.min(100, Math.round((fillRate * 0.65) + (timePressure * 0.35)));
  }

  private buildOrganizerScoreBreakdown(event: EventAiRankedEventResponse): Array<{ label: string; value: number; weight: number; contribution: number }> {
    const insight = event.aiInsight;
    const parts = [
      { label: 'Popularity', value: insight.popularityScore, weight: this.organizerScoreWeights.popularity },
      { label: 'Trend', value: insight.trendScore, weight: this.organizerScoreWeights.trend },
      { label: 'Urgency', value: this.computeOrganizerUrgencyScore(event), weight: this.organizerScoreWeights.urgency },
      { label: 'Conversion', value: insight.conversionScore, weight: this.organizerScoreWeights.conversion },
    ];

    return parts.map(item => ({
      ...item,
      contribution: Math.round(item.value * item.weight),
    }));
  }

  private buildOrganizerReasons(event: EventAiRankedEventResponse): string[] {
    const reasons: string[] = [];
    if (event.aiInsight.popularityScore >= 70) reasons.push('Popularite elevee');
    if (event.aiInsight.trendScore >= 70) reasons.push('Croissance recente forte');
    if (this.computeOrganizerUrgencyScore(event) >= 75) reasons.push('Pression elevee sur la capacite ou le timing');
    if (event.aiInsight.conversionScore >= 60) reasons.push('Fort engagement et bonne conversion');
    if (this.computeOrganizerPredictedTrend(event) === 'future-trending') reasons.push('Potentiel de tendance a court terme');

    return reasons.length ? reasons : ['Score estime a partir des signaux de base et de la recence'];
  }

  private buildOrganizerExplanationHeadline(event: EventAiRankedEventResponse): string {
    const dominant = this.buildOrganizerScoreBreakdown(event)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2)
      .map(item => item.label.toLowerCase());

    return dominant.length
      ? `High score driven by ${dominant.join(' and ')}.`
      : 'Balanced score from baseline event signals.';
  }

  private computeOrganizerPredictedTrend(event: EventAiRankedEventResponse): 'future-trending' | 'watchlist' | 'stable' {
    if (event.aiInsight.trendScore >= 65 && event.aiInsight.conversionScore >= 40) return 'future-trending';
    if (event.aiInsight.trendScore >= 50 || (!!event.views && event.views >= 150)) return 'watchlist';
    return 'stable';
  }

  private isNewOrganizerEvent(event: EventItem): boolean {
    if (!event.createdAt) return false;
    return (Date.now() - new Date(event.createdAt).getTime()) <= 7 * 24 * 60 * 60 * 1000;
  }

  private getOrganizerDaysUntilEvent(event: EventItem): number | null {
    if (!event.startDate) return null;
    const diff = new Date(event.startDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  private isArchivedEvent(event: EventItem): boolean {
    return event.status === 'COMPLETED' || event.status === 'CANCELLED';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════
  openPopup(event: EventItem): void  {
    this.selectedEvent = event;
    if (typeof window !== 'undefined') {
      setTimeout(() => window.dispatchEvent(new Event('resize')), 180);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 420);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 900);
    }
  }
  closePopup(): void                 { this.selectedEvent = null; }
  openCalendarModal(): void          { this.showCalendarModal = true; }
  closeCalendarModal(): void         { this.showCalendarModal = false; }

  openDeleteModal(event: EventItem): void {
    this.selectedEventToDelete = event;
    this.showDeleteModal       = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal       = false;
    this.selectedEventToDelete = null;
  }

  openCampaignDashboard(event: EventItem): void {
    if (event.campaignId) {
      this.router.navigate(['/campaigns/dashboard', event.campaignId]);
    }
  }

  confirmDelete(): void {
    if (!this.selectedEventToDelete) return;
    const eventId = this.selectedEventToDelete.id;
    
    // New system: Cancel event (set status to CANCELLED + send SMS to participants)
    this.eventService.cancelEvent(eventId).subscribe({
      next: (cancelledEvent) => {
        // Update the event status in all arrays to CANCELLED instead of deleting
        const updateStatus = (event: EventItem) => {
          if (event.id === eventId) {
            event.status = 'CANCELLED';
          }
        };
        this.allEvents.forEach(updateStatus);
        this.displayedEvents.forEach(updateStatus);
        this.filteredEvents.forEach(updateStatus);
        this.paginatedEvents.forEach(updateStatus);
        if (this.selectedEvent?.id === eventId) {
          this.selectedEvent.status = 'CANCELLED';
        }
        this.applyFilters();
        this.loadAiDashboard();
        this.closeDeleteModal();
      },
      error: (err) => {
        console.error('Cancel failed', err);
        alert('Erreur lors de l\'annulation de l\'événement');
      }
    });
  }

  viewParticipants(event: EventItem): void {
    this.selectedEventForParticipants = event;
    this.showParticipantsModal        = true;
    this.isLoadingParticipants        = true;
    this.eventParticipants            = [];
    this.filteredParticipants         = [];
    this.participantSearchTerm        = '';

    this.eventService.getEventParticipants(event.id).subscribe({
      next: (response: any) => {
        let participants: any[] = [];
        if (Array.isArray(response)) {
          participants = response;
        } else if (response && typeof response === 'object') {
          for (const key of ['content', 'data', 'participants']) {
            if (Array.isArray(response[key])) { participants = response[key]; break; }
          }
          if (!participants.length) {
            for (const key in response) {
              if (Array.isArray(response[key])) { participants = response[key]; break; }
            }
          }
        }
        this.eventParticipants     = participants;
        this.filteredParticipants  = participants;
        this.isLoadingParticipants = false;
      },
      error: () => {
        this.eventParticipants     = [];
        this.filteredParticipants  = [];
        this.isLoadingParticipants = false;
      }
    });
  }

  closeParticipantsModal(): void {
    this.showParticipantsModal        = false;
    this.selectedEventForParticipants = undefined;
    this.eventParticipants            = [];
    this.filteredParticipants         = [];
    this.participantSearchTerm        = '';
  }




  // ═══════════════════════════════════════════════════════════════════════════
  // PARTICIPANTS HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  filterParticipants(): void {
    const term = this.participantSearchTerm.trim().toLowerCase();
    if (!term) { this.filteredParticipants = this.eventParticipants; return; }
    this.filteredParticipants = this.eventParticipants.filter(p =>
      (p.userName  || '').toLowerCase().includes(term) ||
      (p.userEmail || '').toLowerCase().includes(term) ||
      (p.teamName  || '').toLowerCase().includes(term)
    );
  }

  getRemainingSeats(event: EventItem | undefined): number {
    if (!event?.capacity) return Infinity;
    return event.capacity - (event.participantsCount || 0);
  }

  getAttendedCount(): number {
    return this.eventParticipants.filter(p => p.status === 'ATTENDED').length;
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getAvatarColor(id: any): string {
    const num = typeof id === 'number' ? id : parseInt(String(id), 10) || 0;
    return AVATAR_COLORS[num % AVATAR_COLORS.length];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  exportParticipants(event: EventItem): void {
    const participants = this.selectedEventForParticipants?.id === event.id
      ? this.filteredParticipants : [];

    if (!participants.length) {
      this.eventService.getEventParticipants(event.id).subscribe({
        next: (response: any) => {
          const list = Array.isArray(response) ? response : (response?.content || []);
          this.downloadCsv(event.title, list);
        },
        error: () => console.error('Could not export participants')
      });
      return;
    }
    this.downloadCsv(event.title, participants);
  }

  private downloadCsv(eventTitle: string, participants: any[]): void {
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Status', 'Seats', 'Team'];
    const rows = participants.map(p => [
      p.id, p.userName || '', p.userEmail || '', p.userPhone || '',
      p.status || 'REGISTERED', p.reservedSeats || 1, p.teamName || '',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `participants-${eventTitle.replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE ERROR HANDLER
  // ═══════════════════════════════════════════════════════════════════════════
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════
  goToNew(): void { this.router.navigate(['/dashboard/events/create']); }

  editEvent(event: EventItem): void {
    this.router.navigate(['/dashboard/events/edit', event.id]);
  }

  reserveResources(event: EventItem): void {
    this.router.navigate(['/dashboard/events/reserve-resources', event.id]);
  }

  viewDetails(event: EventItem): void {
    this.router.navigate(['events', event.id]);
  }

  deleteEvent(event: EventItem): void {
    this.openDeleteModal(event);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMATTING
  // ═══════════════════════════════════════════════════════════════════════════
  formatDate(date?: string | Date): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(new Date(date));
  }

  trackById(_index: number, item: EventItem): any { return item.id; }
  trackByCampaignId(_index: number, item: Campaign): any { return item.id; }
}
