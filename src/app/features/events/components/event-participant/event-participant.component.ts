import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  EventApiService, EventItem, ParticipantAiDashboardResponse, ParticipantAiRecommendationResponse, Participation, ParticipationPayload, ParticipationStatus,
  ResourceItem, ReservationItem, ReservationRequestPayload, normalizeEvent,
} from '../../services/event-api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { CampaignApiService, Campaign } from '../../services/campaign-api.service';
import { EventNotificationService } from '../../services/event-notification.service';
import { EventStatusChangeService } from '../../services/event-status-change.service';
import { SmsNotificationService, SmsNotification } from '../../services/sms-notification.service';

@Component({
  selector: 'app-event-participant',
  templateUrl: './event-participant.component.html',
  styleUrls: ['./event-participant.component.scss'],
})
export class EventParticipantComponent implements OnInit, OnDestroy {
  private readonly participantScoreWeights = {
    popularity: 0.30,
    trend: 0.25,
    urgency: 0.20,
    affinity: 0.25,
    conversion: 0.10,
  };
  private readonly participantAiFeedbackStorageKey = 'cluverse-participant-ai-feedback';
  private readonly seenRecommendationIds = new Set<number>();

  events: EventItem[] = [];
  myParticipations: Participation[] = [];
  activeParticipations: Participation[] = [];
  completedParticipations: Participation[] = [];
  cancelledParticipations: Participation[] = [];
  waitingListParticipations: Participation[] = [];
  campaigns: Campaign[] = [];
  isLoadingCampaigns = false;
  resources: ResourceItem[] = [];
  availableResources: ResourceItem[] = [];
  detailReservations: ReservationItem[] = [];
  selectedEvent: EventItem | null = null;
  detailEvent: EventItem | null = null;
  detailParticipants: Participation[] = [];
  editId: number | null = null;
  searchQuery = '';
  isAdmin = false;
  isLoadingEvents = false;
  isLoadingParticipations = false;
  isLoadingReservations = false;
  isSubmitting = false;
  isSubmittingReservation = false;
  isRequestingParticipation = false;
  showReservationForm = false;
  showWaitingListConfirm = false;
  showWaitingListSuccess = false;
  waitingListEvent: EventItem | null = null;
  eventsByCampaign: Map<number | null, EventItem[]> = new Map();
  showWaitingListNotice = false;
  waitingListNoticeEventTitle = '';
  confirmDeleteParticipationId: number | null = null;
  activeTab: 'active' | 'waiting' | 'history' = 'active';
  notifications: any[] = [];
  showNotifications = true;
  participationForm!: FormGroup;
  reservationForm!: FormGroup;
  smsNotificationsByParticipation: Map<number, SmsNotification[]> = new Map();
  smsLoadingMap: Map<number, boolean> = new Map();

  showSuccessPopup = false;
  showWaitingPopup = false;
  showErrorPopup = false;
  successMessage = '';
  errorMessage = '';
  successEventTitle = '';
  // ═══════════════════════════════════════════════════════════════════════════
  // AI ASSISTANT - How it works:
  // 
  // 1. FRONTEND (Angular):
  //    - loadParticipantAiDashboard() → calls backend API
  //    - smartParticipationRecommendations → getter that returns AI recommendations
  //    - sendAssistantMessage() → processes user query
  //    - buildAssistantResponseV2() → rule-based logic using AI data
  //
  // 2. BACKEND (Java/Spring):
  //    - GET /api/participants/me/ai-dashboard
  //    - EventAiService.buildParticipantDashboard() → calculates scores
  //    - Returns: recommendations, trendingEvents, urgentEvents, profileSummary
  //
  // 3. DATA FLOW:
  //    User Query → Intent Detection → Use AI Data → Generate Response
  //
  // 4. VOICE SUPPORT:
  //    - SpeechRecognition API (webkitSpeechRecognition)
  //    - speechSynthesis for voice replies
  // DEBUG MODE - Set to true to see debug info in console
  private readonly DEBUG_AI = false;
  // ═══════════════════════════════════════════════════════════════════════════

  assistantQuery = '';
  assistantTyping = false;
  isListeningToAssistant = false;
  voiceAssistantSupported = false;
  voiceRepliesEnabled = true;
  voiceErrorMessage = '';
  assistantWidgetOpen = false;
  assistantWidgetMinimized = false;
  voicePermissionDenied = false;
  assistantMessages: Array<{ role: 'assistant' | 'user'; text: string }> = [
    {
      role: 'assistant',
      text: 'Bonjour ! 👋 Je suis ton assistant IA pour Smart Events. Je peux t\'aider à trouver les meilleures recommandations d\'événements, expliquer les scores, identifier les tendances, et bien plus. Clique sur les suggestions rapides ou pose-moi une question !'
    }
  ];
  assistantQuickPrompts: Array<{ label: string; query: string }> = [
    { label: 'Top Recommandation', query: 'Quelle est ma meilleure recommandation ?' },
    { label: 'Events Urgents', query: 'Quels événements sont urgents et bientôt complets ?' },
    { label: 'En Tendance', query: 'Quels événements sont en tendance en ce moment ?' },
    { label: 'Mon Profil IA', query: 'Explique comment mon profil influence les recommandations' },
  ];
  readonly participantScoringWeights: Array<{ label: string; weight: number }> = [
    { label: 'Popularity', weight: 30 },
    { label: 'Trend', weight: 25 },
    { label: 'Urgency', weight: 20 },
    { label: 'Affinity', weight: 25 },
  ];
  readonly aiRefreshIntervalMinutes = 5;
  participantAiLastRefreshAt: Date | null = null;
  private participantAiDashboard: ParticipantAiDashboardResponse | null = null;

  private destroy$ = new Subject<void>();
  private speechRecognition: any = null;
  private participantAiRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private eventService: EventApiService,
    private fb: FormBuilder,
    private authHelper: AuthHelperService,
    private campaignService: CampaignApiService,
    private router: Router,
    private notificationService: EventNotificationService,
    private statusChangeService: EventStatusChangeService,
    private smsNotificationService: SmsNotificationService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authHelper.getRole() === 'SUPER_ADMIN'
      || this.authHelper.getRole() === 'PRESIDENT';
    this.buildParticipationForm();
    this.buildReservationForm();
    
    // Initialize voice assistant after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.initializeVoiceAssistant();
    }, 500);
    this.startParticipantAiRefreshLoop();

    this.notificationService.notifications
      .pipe(takeUntil(this.destroy$))
      .subscribe(notification => {
        this.notifications.unshift(notification);
        setTimeout(() => {
          this.notifications = this.notifications.filter(n => n.timestamp !== notification.timestamp);
        }, 8000);
      });

    this.statusChangeService.onReloadEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.notificationService.reset();
        this.loadEventsAndCampaigns();
        this.loadMyParticipations();
      });

    this.loadEventsAndCampaigns();
    this.loadMyParticipations();
  }

  ngOnDestroy(): void {
    if (this.participantAiRefreshTimer) {
      clearInterval(this.participantAiRefreshTimer);
      this.participantAiRefreshTimer = null;
    }
    this.stopVoiceInput();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildParticipationForm(): void {
    this.participationForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      reservedSeats: [1, [Validators.required, Validators.min(1)]],
      contactInfo: [''],
      comment: [''],
      wantsReminder: [true],
      dietaryRequirements: [''],
      emergencyContact: [''],
      teamName: [''],
    });
  }

  private buildReservationForm(): void {
    this.reservationForm = this.fb.group({
      resourceId: ['', Validators.required],
      quantityReserved: [1, [Validators.required, Validators.min(1)]],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      notes: [''],
    });
  }

  // ── Load events ───────────────────────────────────────────────────────────

  loadEventsAndCampaigns(): void {
    this.isLoadingEvents = true;
    this.isLoadingCampaigns = true;
    forkJoin({ events: this.eventService.getAllEvents(), campaigns: this.campaignService.getAllCampaigns() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ events, campaigns }) => {
          const now = new Date();
          this.campaigns = campaigns.filter(c => {
            if (c.status !== 'ACTIVE' && c.status !== 'PLANNED') return false;
            if (c.endDate && new Date(c.endDate) < now) return false;
            return true;
          });
          this.events = events.map(e => {
            const normalized = { ...normalizeEvent(e), imageUrl: this.resolveImageUrl(e.imageUrl) ?? undefined };
            if (!normalized.campaign && normalized.campaignId) {
              const matched = this.campaigns.find(c => c.id === normalized.campaignId);
              if (matched) normalized.campaign = matched;
            }
            return normalized;
          });
          this.isLoadingEvents = false;
          this.isLoadingCampaigns = false;
          this.loadParticipantAiDashboard();
        },
        error: () => { this.loadEventsFallback(); this.isLoadingCampaigns = false; },
      });
  }

  private loadEventsFallback(): void {
    this.eventService.getAllEvents().pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.events = res.map(e => ({ ...normalizeEvent(e), imageUrl: this.resolveImageUrl(e.imageUrl) ?? undefined }));
        this.isLoadingEvents = false;
        this.loadParticipantAiDashboard();
      },
      error: () => { this.isLoadingEvents = false; },
    });
  }

  isOnlineEvent(event?: EventItem | null): boolean {
    return event?.eventType === 'ONLINE';
  }

  canJoinMeeting(event?: EventItem | null): boolean {
    return !!event?.meetingUrl && this.isOnlineEvent(event);
  }

  joinMeeting(event?: EventItem | null): void {
    if (!event?.meetingUrl) {
      return;
    }
    window.open(event.meetingUrl, '_blank', 'noopener');
  }

  // ── Load participations ───────────────────────────────────────────────────

  loadMyParticipations(): void {
    this.isLoadingParticipations = true;
    forkJoin({
      participations: this.eventService.getMyParticipations(),
      waitingList: this.eventService.getMyWaitingList(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ participations, waitingList }) => {
        const normalizedParticipations = participations.map(p => {
          const normalizedEvent = p.event ? normalizeEvent(p.event) : undefined;
          if (normalizedEvent && !normalizedEvent.campaign && normalizedEvent.campaignId) {
            const matched = this.campaigns.find(c => c.id === normalizedEvent.campaignId);
            if (matched) normalizedEvent.campaign = matched;
          }
          return { ...p, event: normalizedEvent };
        });

        // Build synthetic EventItem for waiting list so template + notifications work
        const waitingListAsParticipations: Participation[] = (waitingList || []).map(wl => {
          const matchedEvent = this.events.find(e => e.id === wl.eventId);
          const syntheticEvent: EventItem | undefined = matchedEvent
            ? matchedEvent
            : wl.eventId
              ? {
                  id: wl.eventId,
                  title: wl.eventTitle ?? `Event #${wl.eventId}`,
                  description: '',
                  startDate: wl.eventStartDate ?? '',
                  endDate: '',
                  capacity: 0,
                  imageUrl: this.resolveImageUrl(wl.eventImageUrl) ?? undefined,
                  status: 'PLANNED' as const,
                }
              : undefined;

          return {
            id: wl.id,
            status: 'WAITING_LIST' as ParticipationStatus,
            eventId: wl.eventId,
            event: syntheticEvent,
            registrationDate: wl.joinedAt,
            comment: `Position in queue: ${wl.positionInQueue || 'N/A'}`,
          } as Participation;
        });

        const allParticipations = [...normalizedParticipations, ...waitingListAsParticipations];
        this.myParticipations = allParticipations;
        this.splitParticipations(allParticipations);
        this.notificationService.checkUpcomingEvents(normalizedParticipations);
        this.isLoadingParticipations = false;
        this.loadParticipantAiDashboard();
      },
      error: () => {
        this.eventService.getMyParticipations().pipe(takeUntil(this.destroy$)).subscribe({
          next: res => {
            const normalized = res.map(p => {
              const normalizedEvent = p.event ? normalizeEvent(p.event) : undefined;
              if (normalizedEvent && !normalizedEvent.campaign && normalizedEvent.campaignId) {
                const matched = this.campaigns.find(c => c.id === normalizedEvent.campaignId);
                if (matched) normalizedEvent.campaign = matched;
              }
              return { ...p, event: normalizedEvent };
            });
            this.myParticipations = normalized;
            this.splitParticipations(normalized);
            this.notificationService.checkUpcomingEvents(normalized);
            this.isLoadingParticipations = false;
            this.loadParticipantAiDashboard();
          },
          error: () => { this.isLoadingParticipations = false; },
        });
      },
    });
  }

  // ── SMS ───────────────────────────────────────────────────────────────────

  loadSmsNotifications(participationId: number): void {
    if (this.smsNotificationsByParticipation.has(participationId)) return;
    this.smsLoadingMap.set(participationId, true);
    this.smsNotificationService.getSmsHistory(participationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          this.smsNotificationsByParticipation.set(participationId, result.notifications || []);
          this.smsLoadingMap.set(participationId, false);
        },
        error: () => {
          this.smsNotificationsByParticipation.set(participationId, []);
          this.smsLoadingMap.set(participationId, false);
        },
      });
  }

  getSmsNotifications(participationId: number): SmsNotification[] {
    return this.smsNotificationsByParticipation.get(participationId) || [];
  }

  isSmsLoading(participationId: number): boolean {
    return this.smsLoadingMap.get(participationId) || false;
  }

  toggleSmsNotifications(participationId: number): void {
    if (!this.smsNotificationsByParticipation.has(participationId)) {
      this.loadSmsNotifications(participationId);
    }
  }

  // ── Resources & reservations ──────────────────────────────────────────────

  private loadResources(): void {
    if (!this.isAdmin) { this.resources = this.availableResources = []; return; }
    this.eventService.getResources().pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.resources = data; this.availableResources = data.filter(r => r.availableQuantity > 0); },
      error: () => { this.resources = this.availableResources = []; },
    });
  }

  private loadEventReservations(eventId: number): void {
    if (!this.isAdmin) { this.detailReservations = []; return; }
    this.isLoadingReservations = true;
    this.eventService.getReservationsByEvent(eventId).pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.detailReservations = data; this.isLoadingReservations = false; },
      error: () => { this.detailReservations = []; this.isLoadingReservations = false; },
    });
  }

  private loadEventParticipants(eventId: number): void {
    if (!this.isAdmin) { this.detailParticipants = []; return; }
    this.eventService.getEventParticipants(eventId).pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.detailParticipants = data; },
      error: () => { this.detailParticipants = []; },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private splitParticipations(list: Participation[]): void {
    this.activeParticipations = list.filter(p => p.status === 'REGISTERED' && p.event?.status !== 'COMPLETED');
    this.completedParticipations = list.filter(p => p.status === 'ATTENDED' || (p.status === 'REGISTERED' && p.event?.status === 'COMPLETED'));
    this.cancelledParticipations = list.filter(p => p.status === 'CANCELLED');
    this.waitingListParticipations = list.filter(p => p.status === 'WAITING_LIST');
  }

  // ── FIX: filteredEvents — always show full events for waiting list button ─
  get filteredEvents(): EventItem[] {
    const participatedEventIds = new Set(
      this.myParticipations
        .filter(p => p.status !== 'CANCELLED')
        .map(p => p.event?.id ?? p.eventId)
        .filter((id): id is number => id != null)
    );

    const visible = this.events.filter(e => {
      if (e.status === 'CANCELLED') return false;
      if (e.status === 'COMPLETED' && !participatedEventIds.has(e.id)) return false;
      // Always show full events so user can click "Join Waiting List"
      return true;
    });

    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(e =>
      e.title?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.locationName?.toLowerCase().includes(q)
    );
  }

  getEventsByCampaign(): Map<number | null, EventItem[]> {
    const grouped = new Map<number | null, EventItem[]>();
    this.filteredEvents.forEach(event => {
      const campaignId = event.campaignId ?? null;
      if (!grouped.has(campaignId)) grouped.set(campaignId, []);
      grouped.get(campaignId)?.push(event);
    });
    return grouped;
  }

  getCampaignTitle(campaignId: number | null): string {
    if (!campaignId) return 'Other Events';
    const campaign = this.campaigns.find(c => c.id === campaignId);
    return campaign?.title ?? `Campaign #${campaignId}`;
  }

  get smartParticipationRecommendations(): ParticipantAiRecommendationResponse[] {
    if (this.DEBUG_AI) console.log('[AI] Getting smart recommendations, dashboard:', !!this.participantAiDashboard);
    
    if (!this.participantAiDashboard) {
      if (this.DEBUG_AI) console.log('[AI] No dashboard, returning empty array');
      return [];
    }

    const primary = this.participantAiDashboard.recommendations?.length
      ? this.participantAiDashboard.recommendations
      : (this.participantAiDashboard.trendingEvents || []);

    if (this.DEBUG_AI) console.log('[AI] Primary recommendations count:', primary.length);

    return primary
      .map(rec => this.mapBackendRecommendation(rec))
      .slice(0, 4);
  }

  get recommendedParticipationEvents(): ParticipantAiRecommendationResponse[] {
    return this.smartParticipationRecommendations.filter(event =>
      event.participationAi.recommendationLabel === 'Recommended'
      || event.participationAi.badges.includes('Recommended')
    ).slice(0, 3);
  }

  get trendingParticipationEvents(): ParticipantAiRecommendationResponse[] {
    const source = this.participantAiDashboard?.trendingEvents?.length
      ? this.participantAiDashboard.trendingEvents
      : this.smartParticipationRecommendations.filter(event => event.participationAi.badges.includes('Trending'));

    return source
      .map(event => this.mapBackendRecommendation(event))
      .slice(0, 3);
  }

  get urgentParticipationEvents(): ParticipantAiRecommendationResponse[] {
    const source = this.participantAiDashboard?.urgentEvents?.length
      ? this.participantAiDashboard.urgentEvents
      : this.smartParticipationRecommendations.filter(event =>
          event.participationAi.urgencyLevel !== 'low'
          || event.participationAi.badges.includes('Almost Full')
        );

    return source
      .map(event => this.mapBackendRecommendation(event))
      .slice(0, 3);
  }

  get participantAiOverview(): { recommended: number; trending: number; urgent: number; profileSignals: number } {
    if (this.participantAiDashboard) {
      return {
        recommended: this.participantAiDashboard.recommended,
        trending: this.participantAiDashboard.trending,
        urgent: this.participantAiDashboard.urgent,
        profileSignals: this.participantAiDashboard.profileSignals,
      };
    }

    return {
      recommended: 0,
      trending: 0,
      urgent: 0,
      profileSignals: 0,
    };
  }

  get participantStatisticsCards(): Array<{ label: string; value: number | string; hint: string }> {
    if (this.participantAiDashboard?.statistics?.length) {
      return this.participantAiDashboard.statistics.map(stat => ({
        label: stat.label,
        value: stat.value,
        hint: stat.hint,
      }));
    }

    return [
      { label: 'Views Analysed', value: '--', hint: 'Loading AI statistics from the backend' },
      { label: 'Registrations', value: '--', hint: 'Loading AI statistics from the backend' },
      { label: 'Avg Affinity', value: '--', hint: 'Loading AI statistics from the backend' },
      { label: 'Urgent Picks', value: '--', hint: 'Loading AI statistics from the backend' },
    ];
  }

  get participantProfileSummary(): string {
    if (this.participantAiDashboard?.profileSummary) {
      return this.participantAiDashboard.profileSummary;
    }

    return 'The backend AI profile summary is loading. Until it arrives, the interface keeps recommendations readable without replacing the backend decision logic.';
  }

  get participantAiRefreshLabel(): string {
    if (!this.participantAiLastRefreshAt) {
      return 'Sync in progress';
    }

    const formatted = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(this.participantAiLastRefreshAt);
    return `Last update ${formatted}`;
  }

  get assistantStatusLabel(): string {
    if (this.assistantTyping) {
      return '💭 Thinking...';
    }

    if (this.isListeningToAssistant) {
      return '🎤 Listening...';
    }

    if (this.smartParticipationRecommendations.length) {
      return `✅ Ready • ${this.smartParticipationRecommendations.length} recommendations`;
    }

    return '⏳ Loading recommendations...';
  }

  get assistantStatusClass(): string {
    return this.smartParticipationRecommendations.length
      ? 'assistant-status assistant-status--ready'
      : 'assistant-status';
  }

  get assistantLauncherLabel(): string {
    if (this.isListeningToAssistant) {
      return 'Listening...';
    }

    if (this.assistantTyping) {
      return 'Thinking...';
    }

    return 'Smart AI Assistant';
  }

  getParticipationScore(eventId: number): number {
    return this.smartParticipationRecommendations.find(event => event.id === eventId)?.participationAi.score ?? 0;
  }

  getParticipationBadges(eventId: number): string[] {
    return this.smartParticipationRecommendations.find(event => event.id === eventId)?.participationAi.badges ?? [];
  }

  getParticipationDecisionMessage(eventId: number): string {
    return this.smartParticipationRecommendations.find(event => event.id === eventId)?.participationAi.decisionMessage ?? 'Optional participation';
  }

  isParticipationRecommended(eventId: number): boolean {
    return this.smartParticipationRecommendations.some(event => event.id === eventId);
  }

  getParticipationUrgencyClass(eventId: number): string {
    const urgency = this.smartParticipationRecommendations.find(event => event.id === eventId)?.participationAi.urgencyLevel ?? 'low';
    return `card-ai-strip--${urgency}`;
  }

  getParticipationLabel(eventId: number): string {
    return this.getParticipationInsight(eventId)?.recommendationLabel ?? 'Explore';
  }

  getParticipationExplanation(eventId: number): string {
    const insight = this.getParticipationInsight(eventId);
    if (!insight) {
      return 'Balanced option based on current event signals.';
    }

    return insight.structuredExplanation?.headline || insight.explanation || 'Balanced option based on current event signals.';
  }

  getParticipationNudge(eventId: number): string {
    const insight = this.getParticipationInsight(eventId);
    if (!insight) {
      return 'Cold-start recommendation from global trends';
    }

    if (insight.urgencyLevel === 'high') {
      return 'High urgency';
    }

    if (insight.badges.includes('Trending')) {
      return 'Trending now';
    }

    if (insight.recommendationLabel === 'Recommended' || insight.badges.includes('Recommended')) {
      return 'Recommended for you';
    }

    return 'Balanced opportunity';
  }

  getParticipationBadgeClass(badge: string): string {
    return `ai-badge ai-badge--${badge.toLowerCase().replace(/\s+/g, '-')}`;
  }

  getAiPanelTone(eventId: number): string {
    const label = this.getParticipationLabel(eventId).toLowerCase().replace(/\s+/g, '-');
    return `card-ai-panel--${label}`;
  }

  getParticipationInsightRows(eventId: number): Array<{ label: string; value: number }> {
    const insight = this.getParticipationInsight(eventId);
    if (!insight) {
      return [];
    }

    return [
      { label: 'Popularity', value: insight.popularityScore },
      { label: 'Trend', value: insight.trendScore },
      { label: 'Urgency', value: insight.urgencyScore ?? insight.availabilityScore },
      { label: 'Affinity', value: insight.affinityScore },
    ];
  }

  getParticipationBreakdown(eventId: number): Array<{ label: string; value: number; weight: number; contribution: number }> {
    return this.getParticipationInsight(eventId)?.scoreBreakdown ?? [];
  }

  getParticipationDominantFactors(eventId: number): string[] {
    return this.getParticipationInsight(eventId)?.dominantFactors ?? [];
  }

  getParticipationStructuredReasons(eventId: number): string[] {
    return this.getParticipationInsight(eventId)?.structuredExplanation?.reasons ?? [];
  }

  getParticipationAffinitySummary(eventId: number): string {
    const profile = this.getParticipationInsight(eventId)?.affinityProfile;
    if (!profile) {
      return 'Affinity is primarily determined by the backend recommendation engine.';
    }

    const categories = profile.preferredCategories.slice(0, 2).join(', ') || 'backend profile signals';
    return `Backend affinity uses profile preferences and history. Frontend interactions only enrich the display layer (${categories}).`;
  }

  getParticipationUrgencySummary(eventId: number): string {
    const event = this.smartParticipationRecommendations.find(item => item.id === eventId);
    const insight = event?.participationAi;
    if (!event || !insight) {
      return 'Urgency combines seat pressure and event timing.';
    }

    const seats = this.getSeatsLeftLabel(event);
    const countdown = this.getEventCountdownLabel(event);
    return `Urgency combines ${seats.toLowerCase()} and timing (${countdown.toLowerCase()}).`;
  }

  getPredictionLabel(eventId: number): string {
    const predictedTrend = this.getParticipationInsight(eventId)?.predictedTrend;
    const labels: Record<string, string> = {
      'future-trending': 'Likely to trend soon',
      watchlist: 'Momentum to watch',
      stable: 'Current demand is stable',
    };
    return labels[predictedTrend || 'stable'] || 'Current demand is stable';
  }

  getEventCountdownLabel(event: EventItem): string {
    if (!event.startDate) {
      return 'Date not defined';
    }

    const today = new Date();
    const start = new Date(event.startDate);
    const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return 'Already started';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return `In ${diff} days`;
    return this.formatDate(event.startDate);
  }

  getSeatsLeftLabel(event: EventItem): string {
    if (!event.capacity || event.capacity <= 0) {
      return 'Open capacity';
    }

    const seatsLeft = Math.max(0, event.capacity - (event.participantsCount ?? 0));
    if (seatsLeft === 0) return 'Full';
    if (seatsLeft === 1) return '1 seat left';
    return `${seatsLeft} seats left`;
  }

  sendAssistantMessage(quickQuery?: string): void {
    const query = (quickQuery ?? this.assistantQuery).trim();
    if (!query) return;

    if (this.DEBUG_AI) console.log('[AI] User query:', query);

    this.assistantWidgetOpen = true;
    this.assistantWidgetMinimized = false;
    this.assistantMessages.push({ role: 'user', text: query });
    this.assistantQuery = '';
    this.assistantTyping = true;
    this.scrollAssistantToBottom();

    const response = this.buildAssistantResponseV2(query);

    if (this.DEBUG_AI) console.log('[AI] Assistant response:', response);

    setTimeout(() => {
      this.assistantMessages.push({ role: 'assistant', text: response });
      this.assistantTyping = false;
      this.scrollAssistantToBottom();
      this.speakAssistantResponse(response);
    }, 250);
  }

  openAssistantWidget(): void {
    this.assistantWidgetOpen = true;
    this.assistantWidgetMinimized = false;
    this.scrollAssistantToBottom();
  }

  closeAssistantWidget(): void {
    this.assistantWidgetOpen = false;
    this.assistantWidgetMinimized = false;
    this.stopVoiceInput();
  }

  toggleAssistantWidget(): void {
    if (!this.assistantWidgetOpen) {
      this.openAssistantWidget();
      return;
    }

    this.assistantWidgetMinimized = !this.assistantWidgetMinimized;
    if (!this.assistantWidgetMinimized) {
      this.scrollAssistantToBottom();
    }
  }

  async toggleVoiceInput(): Promise<void> {
    // Check support and permissions
    if (!this.voiceAssistantSupported) {
      this.voiceErrorMessage = '❌ La reconnaissance vocale n\'est pas supportée.';
      console.warn('[Voice] Not supported');
      return;
    }

    if (this.voicePermissionDenied) {
      this.voiceErrorMessage = '🔒 Veuillez autoriser l\'accès au microphone dans les paramètres.';
      console.warn('[Voice] Permission denied');
      return;
    }

    // Stop listening if already active
    if (this.isListeningToAssistant) {
      this.stopVoiceInput();
      this.voiceErrorMessage = '';
      return;
    }

    // Open widget and start listening
    this.openAssistantWidget();
    this.voiceErrorMessage = '';

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      this.voiceErrorMessage = '🔒 Le micro vocal nécessite une page sécurisée (HTTPS ou localhost).';
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.voiceErrorMessage = '🌐 Vous êtes hors ligne. La reconnaissance vocale nécessite une connexion.';
      return;
    }

    const hasMicAccess = await this.ensureMicrophoneAccess();
    if (!hasMicAccess) {
      return;
    }

    try {
      if (!this.speechRecognition) {
        console.error('[Voice] SpeechRecognition not initialized. Re-initializing...');
        this.initializeVoiceAssistant();
        
        // Retry after initialization
        setTimeout(() => {
          if (this.speechRecognition) {
            try {
              this.speechRecognition.start();
              console.log('[Voice] 🎤 Started after re-init');
            } catch (e) {
              console.error('[Voice] Start after re-init failed:', e);
              this.voiceErrorMessage = '❌ Impossible de démarrer le microphone.';
              this.isListeningToAssistant = false;
            }
          }
        }, 300);
        return;
      }

      // Stop any ongoing recognition first
      try {
        this.speechRecognition.abort();
      } catch (e) {
        console.warn('[Voice] Abort failed:', e);
      }

      // Start new recognition session
      this.speechRecognition.start();
      console.log('[Voice] 🎤 Starting recognition...');
    } catch (error) {
      this.isListeningToAssistant = false;
      this.voiceErrorMessage = '❌ Erreur au démarrage du microphone.';
      console.error('[Voice] Failed to start:', error);
    }
  }

  toggleVoiceReplies(): void {
    this.voiceRepliesEnabled = !this.voiceRepliesEnabled;
    if (!this.voiceRepliesEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  applyFilters(): void {}

  getParticipation(eventId: number): Participation | undefined {
    return this.myParticipations.find(
      p => (p.event?.id === eventId || p.eventId === eventId) && p.status !== 'CANCELLED'
    );
  }

  isParticipating(eventId: number): boolean { return !!this.getParticipation(eventId); }

  // FIX: capacity 0 means unlimited — only mark full if capacity > 0
  isEventFull(event: EventItem): boolean {
    if (!event.capacity || event.capacity <= 0) return false;
    return (event.participantsCount ?? 0) >= event.capacity;
  }

  isEventCompleted(event?: EventItem | null): boolean { return event?.status === 'COMPLETED'; }
  countByStatus(s: string): number { return this.myParticipations.filter(p => p.status === s).length; }
  setTab(tab: 'active' | 'waiting' | 'history'): void { this.activeTab = tab; }
  dismissNotification(eventId: number): void { this.notifications = this.notifications.filter(n => n.eventId !== eventId); }

  // FIX: single source of truth for card button state
  isInWaitingList(eventId: number): boolean {
    return this.myParticipations.some(
      p => (p.event?.id === eventId || p.eventId === eventId) && p.status === 'WAITING_LIST'
    );
  }

  getEventButtonState(event: EventItem): 'join' | 'full' | 'waiting' | 'registered' | 'completed' {
    if (this.isEventCompleted(event)) return 'completed';
    const participation = this.getParticipation(event.id);
    if (participation?.status === 'REGISTERED') return 'registered';
    if (this.isInWaitingList(event.id)) return 'waiting';
    if (this.isEventFull(event)) return 'full';
    return 'join';
  }

  getVisibilityLabel(visibility: string | undefined): string {
    if (!visibility) return '';
    const map: Record<string, string> = { PUBLIC: '🌍 Public', SHARED: '👥 Shared', PRIVATE: '🔒 Private' };
    return map[visibility] ?? visibility;
  }

  getCampaignStatusLabel(status: string | undefined): string {
    if (!status) return '';
    const map: Record<string, string> = { PLANNED: '🕐 Planned', ACTIVE: '🟢 Active', FINISHED: '✅ Finished', CANCELLED: '❌ Cancelled' };
    return map[status] ?? status;
  }

  formatDate(date?: string): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
  }

  // ── Popups ────────────────────────────────────────────────────────────────

  private getParticipantPreferenceProfile(): { preferredCategories: string[]; joinedCampaignIds: number[]; averageParticipationVolume: number } {
    const preferredCategories = this.myParticipations
      .map(participation => participation.event?.category?.toUpperCase())
      .filter((category): category is string => !!category);

    const joinedCampaignIds = this.myParticipations
      .map(participation => participation.event?.campaignId)
      .filter((campaignId): campaignId is number => campaignId != null);

    const participantVolumes = this.myParticipations
      .map(participation => participation.event?.participantsCount ?? 0)
      .filter(value => value > 0);

    const averageParticipationVolume = participantVolumes.length
      ? Math.round(participantVolumes.reduce((sum, value) => sum + value, 0) / participantVolumes.length)
      : 0;

    return {
      preferredCategories: [...new Set(preferredCategories)],
      joinedCampaignIds: [...new Set(joinedCampaignIds)],
      averageParticipationVolume,
    };
  }

  private buildAssistantResponseV2(rawQuery: string): string {
    const query = this.normalizeAssistantQuery(rawQuery);
    const recommendations = this.smartParticipationRecommendations;
    const topRecommendation = recommendations[0];
    const matchedEvent = this.findMentionedRecommendation(rawQuery, recommendations);

    if (!recommendations.length) {
      return 'Je synchronise encore les recommandations IA du backend. Reessaie dans quelques secondes.';
    }

    if (this.matchesIntent(query, ['help', 'aide', 'que peux', 'qu est ce que tu peux'])) {
      return 'Je peux te donner les meilleures recommandations, les evenements urgents, les tendances, les details de score ou un resume de ton profil IA.';
    }

    if (matchedEvent && this.matchesIntent(query, ['pourquoi', 'expli', 'score', 'detail'])) {
      return this.buildRecommendationFocusResponse(matchedEvent);
    }

    if (this.matchesIntent(query, ['poids', 'weight', 'calcul', 'score final'])) {
      return 'Le score final combine des poids sur la popularite, la tendance, l urgence, l affinite utilisateur et un signal de conversion. Le frontend affiche ensuite les facteurs dominants et les explications structurees.';
    }

    if (this.matchesIntent(query, ['recommand', 'best', 'mieux', 'top'])) {
      const topThree = recommendations.slice(0, 3);
      const summary = topThree
        .map((event, index) => `${index + 1}) ${event.title} (score ${event.participationAi.score})`)
        .join(' | ');
      return `Top recommandations du moment: ${summary}. Priorite actuelle: ${topRecommendation.title}. ${topRecommendation.participationAi.decisionMessage}`;
    }

    if (this.matchesIntent(query, ['place', 'seat', 'limite', 'urgent', 'complet'])) {
      const urgentEvents = recommendations.filter(event =>
        event.participationAi.urgencyLevel !== 'low' || event.participationAi.badges.includes('Almost Full')
      );

      if (!urgentEvents.length) {
        return 'Aucun evenement urgent detecte pour le moment. Tu peux te concentrer sur les meilleurs scores.';
      }

      const urgentSummary = urgentEvents
        .slice(0, 3)
        .map(event => `${event.title} (${this.getSeatsLeftLabel(event)})`)
        .join(', ');
      return `Evenements urgents: ${urgentSummary}.`;
    }

    if (this.matchesIntent(query, ['tendance', 'trend', 'popular'])) {
      const trending = recommendations.filter(event => event.participationAi.badges.includes('Trending'));
      if (!trending.length) {
        return 'Pas de forte tendance pour le moment. Je peux te proposer les meilleurs scores a la place.';
      }
      return `En tendance: ${trending.slice(0, 3).map(event => `${event.title} (trend ${event.participationAi.trendScore})`).join(', ')}.`;
    }

    if (this.matchesIntent(query, ['profil', 'affinite', 'category'])) {
      const profileSummary = this.participantAiDashboard?.profileSummary?.trim();
      if (profileSummary) {
        return profileSummary;
      }
      const profile = this.getParticipantPreferenceProfile();
      if (!profile.preferredCategories.length) {
        return 'Je n ai pas encore assez d historique pour deduire clairement ton profil. Tes prochaines activites vont ameliorer les recommandations.';
      }
      return `Profil detecte: ${profile.preferredCategories.join(', ')}. J utilise aussi les clics precedents et l historique de participation pour ajuster l affinite.`;
    }

    if (this.matchesIntent(query, ['prediction', 'predict', 'future', 'bientot tendance'])) {
      const predicted = recommendations.filter(event => event.participationAi.predictedTrend === 'future-trending');
      if (!predicted.length) {
        return 'Aucun evenement n a encore un signal predictif fort. Je surveille surtout l acceleration recente des vues et des inscriptions.';
      }
      return `Evenements susceptibles de devenir tendance: ${predicted.map(event => event.title).join(', ')}.`;
    }

    if (this.matchesIntent(query, ['date', 'quand'])) {
      const target = matchedEvent ?? topRecommendation;
      if (!target?.startDate) {
        return 'Je n ai pas de date prioritaire a signaler pour le moment.';
      }
      return `${target.title} est prevu pour le ${this.formatDate(target.startDate)}.`;
    }

    if (matchedEvent) {
      return this.buildRecommendationFocusResponse(matchedEvent);
    }

    const fallbackTop = recommendations
      .slice(0, 2)
      .map(event => `${event.title} (${event.participationAi.score})`)
      .join(', ');
    return `Je te conseille de commencer par: ${fallbackTop}. Pose-moi une question sur score, tendance, urgence, ou profil.`;
  }

  private buildRecommendationFocusResponse(event: ParticipantAiRecommendationResponse): string {
    const badges = event.participationAi.badges.length ? event.participationAi.badges.join(', ') : 'No badge';
    const dominantFactors = event.participationAi.dominantFactors?.join(', ') || 'balanced signals';
    return `${event.title}: score ${event.participationAi.score}, badges ${badges}. Facteurs dominants: ${dominantFactors}. ${event.participationAi.structuredExplanation?.headline || event.participationAi.explanation}. ${event.participationAi.decisionMessage}`;
  }

  private findMentionedRecommendation(
    rawQuery: string,
    recommendations: ParticipantAiRecommendationResponse[],
  ): ParticipantAiRecommendationResponse | undefined {
    const normalizedQuery = this.normalizeAssistantQuery(rawQuery);
    return recommendations
      .filter(event => normalizedQuery.includes(this.normalizeAssistantQuery(event.title || '')))
      .sort((a, b) => (b.title?.length || 0) - (a.title?.length || 0))[0];
  }

  private normalizeAssistantQuery(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private matchesIntent(query: string, tokens: string[]): boolean {
    return tokens.some(token => query.includes(token));
  }

  private buildAssistantResponse(query: string): string {
    const topRecommendation = this.smartParticipationRecommendations[0];
    const limitedSeats = this.filteredEvents.filter(event => {
      if (!event.capacity || event.capacity <= 0) return false;
      return event.capacity - (event.participantsCount ?? 0) <= 3;
    });
    const trending = this.smartParticipationRecommendations.filter(event => event.participationAi.badges.includes('Trending'));

    if (query.includes('recommand') || query.includes('best') || query.includes('mieux')) {
      if (!topRecommendation) {
        return 'Je ne vois pas encore de recommandation forte pour le moment.';
      }
      return `${topRecommendation.title} est actuellement la meilleure recommandation pour toi. Score ${topRecommendation.participationAi.score}. ${topRecommendation.participationAi.decisionMessage}.`;
    }

    if (query.includes('place') || query.includes('seat') || query.includes('limite')) {
      if (!limitedSeats.length) {
        return 'Il n’y a pas d’événement presque complet pour le moment.';
      }
      const event = limitedSeats[0];
      const seatsLeft = Math.max(0, (event.capacity ?? 0) - (event.participantsCount ?? 0));
      return `${event.title} n’a plus que ${seatsLeft} place(s) disponible(s). Une inscription rapide est conseillée.`;
    }

    if (query.includes('tendance') || query.includes('trend') || query.includes('popular')) {
      if (!trending.length) {
        return 'Aucun événement n’est fortement en tendance pour l’instant, mais je peux te montrer les meilleures options du moment.';
      }
      return `Événements en tendance: ${trending.slice(0, 3).map(event => event.title).join(', ')}.`;
    }

    if (query.includes('profil') || query.includes('affinite') || query.includes('category')) {
      const profileSummary = this.participantAiDashboard?.profileSummary?.trim();
      if (profileSummary) {
        return profileSummary;
      }
      const profile = this.getParticipantPreferenceProfile();
      if (!profile.preferredCategories.length) {
        return 'Je n’ai pas encore assez d’historique pour déduire clairement tes préférences. Tes prochaines activités amélioreront les recommandations.';
      }
      return `Tes préférences actuelles semblent surtout alignées avec: ${profile.preferredCategories.join(', ')}. J’accorde aussi plus de poids aux campagnes que tu as déjà rejointes.`;
    }

    if (query.includes('date') || query.includes('quand')) {
      if (!topRecommendation?.startDate) {
        return 'Je n’ai pas de date prioritaire à mettre en avant pour le moment.';
      }
      return `${topRecommendation.title} est prévu pour le ${this.formatDate(topRecommendation.startDate)}.`;
    }

    return 'Je peux te recommander un événement, expliquer une tendance, signaler les places limitées ou montrer ce qui correspond le mieux à ton profil.';
  }

  private getParticipationInsight(eventId: number) {
    return this.smartParticipationRecommendations.find(event => event.id === eventId)?.participationAi;
  }

  private loadParticipantAiDashboard(): void {
    if (this.DEBUG_AI) console.log('[AI] Loading participant AI dashboard...');
    
    this.eventService.getParticipantAiDashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dashboard) => {
          this.participantAiDashboard = dashboard;
          this.participantAiLastRefreshAt = new Date();
          this.registerDisplayedRecommendationImpressions();
          
          if (this.DEBUG_AI) {
            console.log('[AI] Dashboard loaded:', {
              recommended: dashboard.recommended,
              trending: dashboard.trending,
              urgent: dashboard.urgent,
              recommendationsCount: dashboard.recommendations?.length || 0
            });
          }
        },
        error: (err) => {
          if (this.DEBUG_AI) console.error('[AI] Dashboard load error:', err);
          this.participantAiDashboard = null;
        },
      });
  }

  private startParticipantAiRefreshLoop(): void {
    if (this.participantAiRefreshTimer) {
      clearInterval(this.participantAiRefreshTimer);
    }

    this.participantAiRefreshTimer = setInterval(() => {
      this.loadParticipantAiDashboard();
    }, this.aiRefreshIntervalMinutes * 60 * 1000);
  }

  private mapBackendRecommendation(rec: ParticipantAiRecommendationResponse): ParticipantAiRecommendationResponse {
    const normalizedEvent = normalizeEvent(rec);
    const affinityProfile = this.buildAffinityProfile(normalizedEvent);
    const feedbackSignals = this.getFeedbackSignals(rec.id);
    const urgencyScore = this.computeUrgencyScore(normalizedEvent);
    const conversionScore = this.computeConversionScore(normalizedEvent);
    const scoreBreakdown = rec.participationAi.scoreBreakdown?.length
      ? rec.participationAi.scoreBreakdown
      : this.buildParticipantScoreBreakdown(rec.participationAi, urgencyScore, conversionScore);
    const dominantFactors = [...scoreBreakdown]
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map(item => item.label);
    const structuredReasons = this.buildStructuredReasons(normalizedEvent, rec.participationAi, affinityProfile, urgencyScore);

    return {
      ...normalizedEvent,
      participationAi: {
        eventId: rec.participationAi.eventId,
        score: rec.participationAi.score,
        popularityScore: rec.participationAi.popularityScore,
        availabilityScore: rec.participationAi.availabilityScore,
        recencyScore: rec.participationAi.recencyScore,
        trendScore: rec.participationAi.trendScore,
        affinityScore: rec.participationAi.affinityScore,
        urgencyLevel: rec.participationAi.urgencyLevel ?? this.resolveUrgencyLevel(urgencyScore),
        recommendationLabel: rec.participationAi.recommendationLabel,
        explanation: rec.participationAi.explanation || structuredReasons.join(', '),
        seatsLeft: rec.participationAi.seatsLeft,
        decisionMessage: rec.participationAi.decisionMessage || this.buildDecisionMessage(normalizedEvent, dominantFactors),
        badges: rec.participationAi.badges?.length
          ? rec.participationAi.badges
          : this.buildParticipantBadges([], normalizedEvent, urgencyScore),
        urgencyScore: rec.participationAi.urgencyScore ?? urgencyScore,
        conversionScore: rec.participationAi.conversionScore ?? conversionScore,
        predictedTrend: rec.participationAi.predictedTrend ?? this.computePredictedTrend(normalizedEvent, rec.participationAi.trendScore),
        scoreBreakdown,
        dominantFactors,
        structuredExplanation: rec.participationAi.structuredExplanation ?? {
          headline: this.buildExplanationHeadline(dominantFactors),
          reasons: structuredReasons,
          dominantFactors,
        },
        affinityProfile,
        feedbackSignals,
        fallbackStrategy: rec.participationAi.fallbackStrategy ?? this.resolveParticipantFallbackStrategy(normalizedEvent, affinityProfile),
      },
    };
  }

  private computeUrgencyScore(event: EventItem): number {
    const seatsPercent = !event.capacity || event.capacity <= 0
      ? 0
      : 100 - Math.round(((event.capacity - (event.participantsCount ?? 0)) / event.capacity) * 100);
    const daysUntil = this.getDaysUntilEvent(event);
    const timePressure = daysUntil == null
      ? 25
      : daysUntil <= 0
        ? 100
        : daysUntil <= 2
          ? 92
          : daysUntil <= 7
            ? 70
            : daysUntil <= 14
              ? 45
              : 20;
    return Math.min(100, Math.round((seatsPercent * 0.6) + (timePressure * 0.4)));
  }

  private computeConversionScore(event: EventItem): number {
    const effectiveViews = this.getEffectiveEventViews(event);
    if (effectiveViews <= 0) {
      return Math.min(100, (event.participantsCount ?? 0) * 10);
    }

    return Math.min(100, Math.round(((event.participantsCount ?? 0) / effectiveViews) * 1000));
  }

  private buildParticipantScoreBreakdown(
    insight: ParticipantAiRecommendationResponse['participationAi'],
    urgencyScore: number,
    conversionScore: number,
  ): Array<{ label: string; value: number; weight: number; contribution: number }> {
    const parts = [
      { label: 'Popularity', value: insight.popularityScore, weight: this.participantScoreWeights.popularity },
      { label: 'Trend', value: insight.trendScore, weight: this.participantScoreWeights.trend },
      { label: 'Urgency', value: urgencyScore, weight: this.participantScoreWeights.urgency },
      { label: 'Affinity', value: insight.affinityScore, weight: this.participantScoreWeights.affinity },
      { label: 'Conversion', value: conversionScore, weight: this.participantScoreWeights.conversion },
    ];

    return parts.map(item => ({
      ...item,
      contribution: Math.round(item.value * item.weight),
    }));
  }

  private buildAffinityProfile(event: EventItem): {
    preferredCategories: string[];
    clickedCategories: string[];
    participationHistoryCount: number;
    interactionBalance: number;
  } {
    const profile = this.getParticipantPreferenceProfile();
    const feedback = this.getFeedbackSignals(event.id);
    const clickedCategories = feedback.clicks > 0 && event.category ? [event.category] : [];

    return {
      preferredCategories: profile.preferredCategories,
      clickedCategories,
      participationHistoryCount: this.myParticipations.length,
      interactionBalance: feedback.clicks - feedback.ignored,
    };
  }

  private buildStructuredReasons(
    event: EventItem,
    insight: ParticipantAiRecommendationResponse['participationAi'],
    affinityProfile: { preferredCategories: string[]; clickedCategories: string[]; participationHistoryCount: number; interactionBalance: number },
    urgencyScore: number,
  ): string[] {
    const reasons: string[] = [];

    if (insight.popularityScore >= 70) reasons.push('Popularite elevee');
    if (insight.trendScore >= 70) reasons.push('Croissance recente forte');
    if (urgencyScore >= 75) reasons.push('Places limitees ou evenement proche');
    if (insight.affinityScore >= 70) reasons.push('Bon match avec vos preferences');
    if (affinityProfile.clickedCategories.length) reasons.push('Interaction utilisateur positive recente');
    if (this.computeConversionScore(event) >= 60) reasons.push('Fort engagement et conversion');

    return reasons.length ? reasons : ['Recommandation de fallback basee sur les tendances globales'];
  }

  private applyFeedbackToAffinity(baseScore: number, feedback: { clicks: number; impressions: number; ignored: number }): number {
    const adjusted = baseScore + (feedback.clicks * 4) - (feedback.ignored * 2);
    return Math.max(0, Math.min(100, adjusted));
  }

  private buildParticipantBadges(existingBadges: string[], event: EventItem, urgencyScore: number): string[] {
    const badges = new Set(existingBadges);
    const effectiveViews = this.getEffectiveEventViews(event);
    if (urgencyScore >= 75) badges.add('Almost Full');
    if (this.computePredictedTrend(event, effectiveViews ? Math.min(100, Math.round(effectiveViews / 4)) : 0) === 'future-trending') {
      badges.add('Rising');
    }
    if (this.isNewEvent(event)) badges.add('New');
    return Array.from(badges);
  }

  private computePredictedTrend(event: EventItem, trendScore: number): 'future-trending' | 'watchlist' | 'stable' {
    const effectiveViews = this.getEffectiveEventViews(event);
    const conversion = this.computeConversionScore(event);
    if (trendScore >= 65 && conversion >= 40) return 'future-trending';
    if (trendScore >= 50 || effectiveViews >= 120) return 'watchlist';
    return 'stable';
  }

  getDisplayedEventViews(event: EventItem): number | null {
    const effectiveViews = this.getEffectiveEventViews(event);
    return effectiveViews > 0 ? effectiveViews : null;
  }

  private buildExplanationHeadline(dominantFactors: string[]): string {
    if (!dominantFactors.length) {
      return 'Recommended from global event signals.';
    }

    return `High score driven by ${dominantFactors.slice(0, 2).join(' and ').toLowerCase()}.`;
  }

  private buildDecisionMessage(event: EventItem, dominantFactors: string[]): string {
    if (dominantFactors.includes('Urgency')) {
      return 'Act quickly: this event combines strong fit and rising urgency.';
    }
    if (dominantFactors.includes('Affinity')) {
      return 'Strong personal fit based on your preferences and activity.';
    }
    if (dominantFactors.includes('Trend')) {
      return 'Momentum is rising and demand may increase soon.';
    }
    return `Balanced recommendation for ${event.title}.`;
  }

  private resolveUrgencyLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 75) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
  }

  private resolveParticipantFallbackStrategy(
    event: EventItem,
    affinityProfile: { preferredCategories: string[]; clickedCategories: string[]; participationHistoryCount: number; interactionBalance: number },
  ): string {
    if (!affinityProfile.participationHistoryCount) {
      return 'New user fallback: recommendations rely on global popularity and trends.';
    }
    if (this.isNewEvent(event)) {
      return 'New event fallback: score starts from popularity baseline and event timing.';
    }
    return 'Personalized recommendation: user history and live event signals combined.';
  }

  private isNewEvent(event: EventItem): boolean {
    if (!event.createdAt) return false;
    const ageMs = Date.now() - new Date(event.createdAt).getTime();
    return ageMs <= 7 * 24 * 60 * 60 * 1000;
  }

  private getDaysUntilEvent(event: EventItem): number | null {
    if (!event.startDate) return null;
    const diff = new Date(event.startDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  private registerDisplayedRecommendationImpressions(): void {
    this.smartParticipationRecommendations.forEach(event => {
      if (this.seenRecommendationIds.has(event.id)) {
        return;
      }

      this.seenRecommendationIds.add(event.id);
      this.updateFeedbackSignals(event.id, feedback => ({
        clicks: feedback.clicks,
        impressions: feedback.impressions + 1,
      }));
    });
  }

  private registerRecommendationClick(eventId: number): void {
    this.updateFeedbackSignals(eventId, feedback => ({
      clicks: feedback.clicks + 1,
      impressions: Math.max(feedback.impressions, 1),
    }));
  }

  private getFeedbackSignals(eventId: number): { clicks: number; impressions: number; ignored: number } {
    const store = this.readAiFeedbackStore();
    const feedback = store[eventId] || { clicks: 0, impressions: 0 };
    return {
      clicks: feedback.clicks,
      impressions: feedback.impressions,
      ignored: Math.max(0, feedback.impressions - feedback.clicks),
    };
  }

  private getEffectiveEventViews(event: EventItem): number {
    const backendViews = Number(event.views ?? 0);
    if (backendViews > 0) {
      return backendViews;
    }

    return this.getFeedbackSignals(event.id).impressions;
  }

  private updateFeedbackSignals(
    eventId: number,
    updater: (feedback: { clicks: number; impressions: number }) => { clicks: number; impressions: number },
  ): void {
    const store = this.readAiFeedbackStore();
    const current = store[eventId] || { clicks: 0, impressions: 0 };
    store[eventId] = updater(current);
    this.writeAiFeedbackStore(store);
  }

  private readAiFeedbackStore(): Record<number, { clicks: number; impressions: number }> {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      return JSON.parse(localStorage.getItem(this.participantAiFeedbackStorageKey) || '{}');
    } catch {
      return {};
    }
  }

  private writeAiFeedbackStore(store: Record<number, { clicks: number; impressions: number }>): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.participantAiFeedbackStorageKey, JSON.stringify(store));
  }

  private initializeVoiceAssistant(): void {
    if (typeof window === 'undefined') {
      this.voiceAssistantSupported = false;
      return;
    }

    // Check for SpeechRecognition API support
    const speechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!speechRecognitionCtor || !('speechSynthesis' in window)) {
      this.voiceAssistantSupported = false;
      console.warn('[Voice Assistant] SpeechRecognition API not supported');
      return;
    }

    try {
      this.speechRecognition = new speechRecognitionCtor();
      this.setupSpeechRecognitionListeners();
      this.voiceAssistantSupported = true;
      console.log('[Voice Assistant] ✅ Initialized successfully');
    } catch (error) {
      this.voiceAssistantSupported = false;
      console.error('[Voice Assistant] Initialization failed:', error);
    }
  }

  private setupSpeechRecognitionListeners(): void {
    if (!this.speechRecognition) return;

    // Configure recognition settings
    this.speechRecognition.language = 'fr-FR';
    this.speechRecognition.continuous = false;
    this.speechRecognition.interimResults = true;
    this.speechRecognition.maxAlternatives = 1;

    // On start listening
    this.speechRecognition.onstart = () => {
      this.isListeningToAssistant = true;
      this.voiceErrorMessage = '';
      this.voicePermissionDenied = false;
      console.log('[Voice] 🎤 Listening started...');
    };

    // On end listening
    this.speechRecognition.onend = () => {
      this.isListeningToAssistant = false;
      console.log('[Voice] 🎤 Listening ended');
    };

    // Process results
    this.speechRecognition.onresult = (event: any) => {
      let transcript = '';
      let isFinal = false;

      // Get transcript from all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const current = event.results[i][0]?.transcript || '';
        transcript += current;
        if (event.results[i].isFinal) {
          isFinal = true;
        }
      }

      transcript = transcript.trim();

      if (isFinal && transcript) {
        console.log('[Voice] ✅ Recognized:', transcript);
        this.assistantQuery = transcript;
        this.isListeningToAssistant = false;
        
        // Auto-send the message
        setTimeout(() => this.sendAssistantMessage(), 100);
      } else if (transcript) {
        // Show interim results for better UX
        console.log('[Voice] ⏳ Interim:', transcript);
      }
    };

    // Handle errors
    this.speechRecognition.onerror = (event: any) => {
      this.isListeningToAssistant = false;
      const errorType = event.error || 'unknown';

      console.error('[Voice] ❌ Error:', errorType);

      // Map error codes to user-friendly messages
      switch (errorType) {
        case 'no-speech':
          this.voiceErrorMessage = '🔇 Aucun son détecté. Parlez plus fort.';
          break;
        case 'audio-capture':
          this.voiceErrorMessage = '🎤 Microphone non disponible. Vérifiez les permissions.';
          this.voicePermissionDenied = true;
          break;
        case 'network':
          this.voiceErrorMessage = '🌐 Service vocal indisponible. Vérifiez Chrome, votre connexion, ou réessayez dans quelques secondes.';
          break;
        case 'permission-denied':
          this.voiceErrorMessage = '🔒 Permission microphone refusée.';
          this.voicePermissionDenied = true;
          break;
        case 'service-not-allowed':
          this.voiceErrorMessage = '❌ Service de reconnaissance vocale désactivé.';
          break;
        default:
          this.voiceErrorMessage = `❌ Erreur: ${errorType}`;
      }
    };
  }

  private async ensureMicrophoneAccess(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      this.voicePermissionDenied = false;
      return true;
    } catch (error: any) {
      const errorName = error?.name || '';
      this.voicePermissionDenied =
        errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError';

      if (this.voicePermissionDenied) {
        this.voiceErrorMessage = '🔒 Permission microphone refusée. Autorisez le micro puis réessayez.';
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        this.voiceErrorMessage = '🎤 Aucun microphone détecté sur cet appareil.';
      } else {
        this.voiceErrorMessage = '🎤 Impossible d’accéder au microphone pour le moment.';
      }

      console.error('[Voice] Microphone access failed:', error);
      return false;
    }
  }

  private stopVoiceInput(): void {
    if (!this.speechRecognition) return;
    try {
      this.speechRecognition.stop();
      this.isListeningToAssistant = false;
      this.voiceErrorMessage = '';
    } catch (error) {
      console.warn('[Voice] Stop failed:', error);
      this.isListeningToAssistant = false;
    }
  }

  private speakAssistantResponse(text: string): void {
    if (!this.voiceRepliesEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Create utterance with French language support
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.95; // Slightly slower for clarity
      utterance.pitch = 1;
      utterance.volume = 0.8;

      // Handle errors
      utterance.onerror = (event: any) => {
        console.warn('[Voice] Speech synthesis error:', event.error);
        this.voiceErrorMessage = `🔊 Erreur de synthèse vocale: ${event.error}`;
      };

      utterance.onend = () => {
        console.log('[Voice] 🔊 Speech synthesis complete');
      };

      utterance.onstart = () => {
        console.log('[Voice] 🔊 Starting voice reply...');
      };

      // Speak the response
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('[Voice] Speech synthesis failed:', error);
    }
  }

  private scrollAssistantToBottom(): void {
    if (typeof document === 'undefined') {
      return;
    }

    setTimeout(() => {
      const panel = document.querySelector('.assistant-messages--floating') as HTMLElement | null;
      if (panel) {
        panel.scrollTop = panel.scrollHeight;
      }
    });
  }

  showSuccess(message: string, eventTitle = ''): void {
    this.successMessage = message;
    this.successEventTitle = eventTitle;
    this.showSuccessPopup = true;
  }

  showWaiting(eventTitle = ''): void {
    this.successEventTitle = eventTitle;
    this.showWaitingPopup = true;
  }

  showError(message: string): void {
    this.errorMessage = message;
    this.showErrorPopup = true;
  }

  closeSuccessPopup(): void { this.showSuccessPopup = false; }
  closeWaitingPopup(): void { this.showWaitingPopup = false; }
  closeErrorPopup(): void { this.showErrorPopup = false; }

  // ── Modals ────────────────────────────────────────────────────────────────

  // FIX: openJoin routes to waiting list confirm when event is full
  openJoin(event: EventItem): void {
    this.registerRecommendationClick(event.id);

    if (this.isEventCompleted(event)) return;

    if (this.isInWaitingList(event.id)) {
      this.showError('You are already on the waiting list for this event.');
      return;
    }

    if (this.isEventFull(event)) {
      this.waitingListEvent = event;
      this.showWaitingListConfirm = true;
      return;
    }

    this.requestParticipationFlow(event);
  }
// Add these methods to your component class

getEventStatusClassFixed(event: any): string {
  if (!event) return '';
  if (event.status === 'ONGOING') return 'status-ongoing';
  if (event.isFull) return 'status-full';
  return 'status-open';
}

getEventStatusLabelFixed(event: any): string {
  if (!event) return 'Unknown';
  if (event.status === 'ONGOING') return 'Live';
  if (event.isFull) return 'Full';
  return 'Open';
}

getEventCapacityPercentageFixed(event: any): number {
  if (!event || !event.capacity || event.capacity === 0) return 0;
  const percent = ((event.participantsCount || 0) / event.capacity) * 100;
  return Math.min(percent, 100);
}
  private requestParticipationFlow(event: EventItem): void {
    if (this.isEventCompleted(event)) return;
    this.selectedEvent = event;
    this.editId = null;
    this.detailEvent = null;
    
    // ✅ Auto-remplir avec les données de l'utilisateur courant
    const firstName = this.authHelper.getFirstName();
    const lastName = this.authHelper.getLastName();
    const email = this.authHelper.getDecodedToken()?.email ?? '';
    const phone = this.authHelper.getDecodedToken()?.phone ?? '';
    
    const fullName = firstName && lastName 
      ? `${firstName} ${lastName}` 
      : firstName || '';
    
    this.participationForm.reset({
      fullName: fullName,
      email: email,
      phone: phone,
      reservedSeats: 1,
      contactInfo: phone,
      comment: '',
      wantsReminder: true,
      dietaryRequirements: '',
      emergencyContact: '',
      teamName: '',
    });
  }

  // FIX: after user confirms waiting list dialog, open form (backend auto-routes to waiting list)
  confirmWaitingList(accept: boolean): void {
    const event = this.waitingListEvent;
    this.showWaitingListConfirm = false;
    this.waitingListEvent = null;
    if (!event || !accept) return;
    this.requestParticipationFlow(event);
  }

  openEdit(eventId: number): void {
    const p = this.getParticipation(eventId);
    if (!p?.event || this.isEventCompleted(p.event)) return;
    this.selectedEvent = p.event;
    this.editId = p.id;
    this.detailEvent = null;
    this.participationForm.patchValue({
      // ✅ Utiliser les données stockées lors de la participation
      fullName: p.fullName ?? p.userName ?? '', 
      email: p.userEmail ?? '', 
      phone: p.participantPhone ?? p.userPhone ?? '',
      reservedSeats: p.reservedSeats ?? 1, 
      contactInfo: p.contactInfo ?? '',
      comment: p.comment ?? '', 
      wantsReminder: p.wantsReminder ?? true,
      dietaryRequirements: p.dietaryRequirements ?? '', 
      emergencyContact: p.emergencyContact ?? '',
      teamName: p.teamName ?? '',
    });
  }

  openDetail(event: EventItem): void {
    this.registerRecommendationClick(event.id);
    this.detailEvent = event;
    this.selectedEvent = null;
    this.editId = null;
    this.detailParticipants = [];
    this.detailReservations = [];
    this.showReservationForm = false;
    this.reservationForm.reset({ resourceId: '', quantityReserved: 1, startDate: '', endDate: '', notes: '' });
    if (this.isAdmin) {
      this.loadResources();
      this.loadEventReservations(event.id);
      this.loadEventParticipants(event.id);
    }
  }

  closeModal(): void {
    this.selectedEvent = null;
    this.detailEvent = null;
    this.detailParticipants = [];
    this.detailReservations = [];
    this.editId = null;
    this.showReservationForm = false;
    this.showWaitingListConfirm = false;
    this.showWaitingListNotice = false;
    this.waitingListEvent = null;
    this.isSubmitting = false;
    this.isSubmittingReservation = false;
  }

  closeModalOnOverlay(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) this.closeModal();
  }

  toggleReservationForm(): void { this.showReservationForm = !this.showReservationForm; }
  dismissWaitingListNotice(): void { this.showWaitingListNotice = false; }

  // ── Submit participation ──────────────────────────────────────────────────

  // FIX: handles both REGISTERED and WAITING_LIST_ADDED responses correctly
  submitParticipation(): void {
    if (!this.selectedEvent) return;
    if (this.participationForm.invalid || this.isSubmitting) {
      this.participationForm.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;

    if (this.editId !== null) {
      this.eventService.updateParticipation(this.editId, this.participationForm.value)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.isSubmitting = false;
            this.closeModal();
            this.showSuccess('Your registration has been updated successfully.');
            this.loadMyParticipations();
          },
          error: err => {
            this.isSubmitting = false;
            this.showError(err?.error?.message || 'Error updating participation.');
          },
        });
    } else {
      const payload: ParticipationPayload = {
        ...this.participationForm.value,
        eventId: this.selectedEvent.id,
      };
      const eventTitle = this.selectedEvent.title;

      this.eventService.participate(payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: (status: string) => {
          this.isSubmitting = false;
          this.closeModal();

          if (status === 'REGISTERED') {
            const ev = this.events.find(e => e.id === payload.eventId);
            if (ev) {
              ev.participantsCount = (ev.participantsCount ?? 0) + 1;
              ev.isFull = this.isEventFull(ev);
            }
            this.showSuccess('You are now registered for this event!', eventTitle);
            this.loadMyParticipations();
            this.loadEventsAndCampaigns();

          } else if (status === 'WAITING_LIST_ADDED') {
            // Mark full locally so button flips immediately
            const ev = this.events.find(e => e.id === payload.eventId);
            if (ev) ev.isFull = true;

            this.showWaiting(eventTitle);
            this.loadMyParticipations();
            this.loadEventsAndCampaigns();
          }
        },
         error: err => {
  this.isSubmitting = false;
  if (err?.status === 409) {
    const msg = (err?.error?.message || '').toLowerCase();
    if (msg.includes('waiting')) {
      this.showError('You are already on the waiting list for this event.');
    } else if (msg.includes('already registered') || msg.includes('already in')) {
      this.showError('You are already registered for this event.');
    } else {
      // ✅ Conflit de planning — afficher le message du backend directement
      // Le backend envoie un message lisible du type :
      // "Vous êtes déjà inscrit à l'événement 'X' qui se déroule du ... au ..."
      this.showError(err?.error?.message || 'Schedule conflict: you are already registered for another event at this time.');
    }
  } else {
    this.showError(err?.error?.message || 'Error registering for event.');
  }
},
      });
    }
  }

  // ── Cancel / delete ───────────────────────────────────────────────────────

  requestCancelParticipation(id: number): void { this.confirmDeleteParticipationId = id; }
  cancelDeleteParticipation(): void { this.confirmDeleteParticipationId = null; }
  cancelParticipation(id: number): void { this.requestCancelParticipation(id); }
  deleteParticipation(id: number): void { this.requestCancelParticipation(id); }

  confirmDeleteParticipation(): void {
    const id = this.confirmDeleteParticipationId;
    if (!id) return;
    this.confirmDeleteParticipationId = null;
    const participation = this.myParticipations.find(p => p.id === id);
    this.eventService.deleteParticipation(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        const ev = this.events.find(e => e.id === (participation?.event?.id ?? participation?.eventId));
        if (ev && (ev.participantsCount ?? 0) > 0) {
          ev.participantsCount = (ev.participantsCount ?? 0) - 1;
          ev.isFull = this.isEventFull(ev);
        }
        this.showSuccess('Your participation has been cancelled.');
        this.loadMyParticipations();
        this.loadEventsAndCampaigns();
      },
      error: () => { this.showError('Could not cancel participation.'); },
    });
  }

  confirmPromotion(waitingId: number): void {
    this.eventService.confirmPromotion(waitingId).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        if (result === 'CONFIRMED') {
          this.showSuccess('Your spot is confirmed! See you at the event.', '');
          this.loadMyParticipations();
          this.loadEventsAndCampaigns();
        }
      },
      error: () => { this.showError('Error confirming your spot.'); },
    });
  }

  reactivateParticipation(id: number): void {
    this.eventService.reactivateParticipation(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess('Participation reactivated successfully!');
        this.loadMyParticipations();
        this.loadEventsAndCampaigns();
      },
      error: err => {
  if (err?.status === 409) {
    // ✅ Récupérer le message exact du backend (conflit terrain ou planning)
    const msg = err?.error?.message || '';
    if (msg) {
      this.showError(msg);
    } else {
      this.showError('This event is now full. You can join the waiting list instead.');
    }
  } else {
    this.showError(err?.error?.message || 'Could not reactivate participation.');
  }
},
    });
  }

  // ── Reservations ──────────────────────────────────────────────────────────



  editEvent(eventId: number): void { this.router.navigate(['/dashboard/events/edit', eventId]); }

  resolveImageUrl(url?: string): string | null {
    if (!url?.trim()) return null;
    if (url.startsWith('http')) return url;
    return `http://localhost:8081${url}`;
  }

  onImgError(e: Event): void { (e.target as HTMLImageElement).style.display = 'none'; }
}
