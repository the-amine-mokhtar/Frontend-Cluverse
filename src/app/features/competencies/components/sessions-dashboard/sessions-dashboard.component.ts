import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
  AdminCompetencySessionsResponse,
  AdminSessionMetricsResponse,
  ApiService,
  CompetencyResponse,
  CompetencySessionCloseRequest,
  CompetencySessionParticipantResponse,
  CompetencySessionResponse,
  CompetencySessionScheduleRequest,
  MemberCompetencySessionsResponse,
  MemberSessionMetricsResponse,
  SessionParticipantInviteRequest,
  SessionStatus
} from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-sessions-dashboard',
  templateUrl: './sessions-dashboard.component.html',
  styleUrls: ['./sessions-dashboard.component.scss']
})
export class SessionsDashboardComponent implements OnInit, OnDestroy {

  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly adminStatusFilters: Array<'ALL' | SessionStatus> = ['ALL', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'];
  readonly adminStatusChecks: SessionStatus[] = ['SCHEDULED', 'ONGOING', 'COMPLETED'];

  // ─── state ───────────────────────────────────────────────────────────
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  clubId = 0;
  userId = 0;
  role = '';
  isMemberRole = false;

  competencies: CompetencyResponse[] = [];
  members: Array<{ userId: number; firstName?: string; lastName?: string; email?: string }> = [];

  // ─── admin ───────────────────────────────────────────────────────────
  adminMetrics: AdminSessionMetricsResponse = {
    totalSessions: 0,
    upcomingSessions: 0,
    completedThisMonth: 0,
    cancelledSessions: 0
  };
  adminSessions: CompetencySessionResponse[] = [];
  selectedAdminSessionId: number | null = null;

  // ─── member ──────────────────────────────────────────────────────────
  memberMetrics: MemberSessionMetricsResponse = {
    upcomingSessions: 0,
    completedSessions: 0,
    competenciesWorked: 0
  };
  memberUpcomingSessions: CompetencySessionResponse[] = [];
  memberPastSessions: CompetencySessionResponse[] = [];

  // ─── calendar ────────────────────────────────────────────────────────
  selectedCalendarDate: Date | null = null;
  currentCalendarDate = new Date();

  // ─── filters ─────────────────────────────────────────────────────────
  selectedStatus: 'ALL' | SessionStatus = 'ALL';
  activeAdminStatuses = new Set<SessionStatus>(['SCHEDULED', 'ONGOING', 'COMPLETED']);
  selectedCompetencyId: number | null = null;
  selectedCoachUserId: number | null = null;
  searchTerm = '';
  private readonly searchSubject = new Subject<string>();

  // ─── dialogs ─────────────────────────────────────────────────────────
  showScheduleDialog = false;
  showCloseDialog = false;
  showRescheduleDialog = false;
  showCancelDialog = false;
  showDayInfoDialog = false;
  showParticipantsDialog = false;
  showSessionDetailsDialog = false;

  rescheduleTargetSession: CompetencySessionResponse | null = null;
  closeTargetSession: CompetencySessionResponse | null = null;
  cancelTargetSession: CompetencySessionResponse | null = null;
  participantsTargetSession: CompetencySessionResponse | null = null;
  sessionDetailsTarget: CompetencySessionResponse | null = null;
  closeDialogParticipants: CompetencySessionParticipantResponse[] = [];
  participantsDialogParticipants: CompetencySessionParticipantResponse[] = [];
  selectedMemberIds = new Set<number>();
  selectedInvitedMemberIds = new Set<number>();

  expandedReportSessionId: number | null = null;
  dragSessionId: number | null = null;
  isDraggingSession = false;

  // ─── destroy ─────────────────────────────────────────────────────────
  private readonly destroy$ = new Subject<void>();

  // ─── forms ───────────────────────────────────────────────────────────
  readonly scheduleForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(180)]],
    competencyId: [0, [Validators.required, Validators.min(1)]],
    coachUserId: [0, [Validators.required, Validators.min(1)]],
    startsAt: ['', [Validators.required]],
    meetLink: ['']
  });

  readonly closeForm = this.fb.nonNullable.group({
    reportSummary: [''],
    autoGenerateReport: [false],
    speechSessionId: ['']
  });

  readonly rescheduleForm = this.fb.nonNullable.group({
    startsAt: ['', [Validators.required]]
  });

  readonly cancelForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(300)]]
  });

  constructor(
    private readonly apiService: ApiService,
    private readonly authHelperService: AuthHelperService,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.clubId = this.authHelperService.getClubId();
    this.userId = this.authHelperService.getUserId();
    this.role = this.authHelperService.getRole();
    this.isMemberRole = this.role === 'MEMBER';

    if (!this.clubId) {
      this.errorMessage = 'Club not found. Reconnect and try again.';
      return;
    }

    // debounce search — évite de spammer le backend à chaque frappe
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => this.reloadAdminSessions());

    this.loadDependencies();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── chargement ──────────────────────────────────────────────────────

  loadDependencies(): void {
    this.loading = true;
    this.errorMessage = '';

    // forkJoin — charge competencies et members en parallèle
    forkJoin({
      competencies: this.apiService.getCompetencies(this.clubId),
      members: this.apiService.getClubMembers(this.clubId)
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ competencies, members }) => {
        this.competencies = competencies ?? [];
        this.members = members ?? [];
        this.loadSessions();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Failed to load club data.';
      }
    });
  }

  loadSessions(): void {
    if (this.isMemberRole) {
      this.apiService.getMemberCompetencySessions(this.clubId, this.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: MemberCompetencySessionsResponse) => {
            this.memberMetrics = response.metrics;
            this.memberUpcomingSessions = response.upcoming;
            this.memberPastSessions = response.past;
            this.ensureCalendarSelection();
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            this.errorMessage = 'Failed to load sessions.';
          }
        });
      return;
    }

    this.reloadAdminSessions();
  }

  private reloadAdminSessions(): void {
    this.loading = true;
    this.apiService.getAdminCompetencySessions(this.clubId, {
      status: this.selectedStatus,
      competencyId: this.selectedCompetencyId ?? undefined,
      coachUserId: this.selectedCoachUserId ?? undefined,
      search: this.searchTerm.trim() || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: AdminCompetencySessionsResponse) => {
        this.adminMetrics = response.metrics;
        this.adminSessions = response.sessions;
        this.ensureCalendarSelection();
        this.ensureSelectedAdminSession();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Failed to load sessions.';
      }
    });
  }

  // ─── filtres ─────────────────────────────────────────────────────────

  onSearchInput(): void {
    this.searchSubject.next(this.searchTerm);
  }

  applyAdminFilters(): void {
    if (!this.isMemberRole) {
      this.reloadAdminSessions();
    }
  }

  setStatusFilter(status: 'ALL' | SessionStatus): void {
    this.selectedStatus = status;
    this.applyAdminFilters();
  }

  toggleAdminStatusCheck(status: SessionStatus): void {
    if (this.activeAdminStatuses.has(status)) {
      this.activeAdminStatuses.delete(status);
    } else {
      this.activeAdminStatuses.add(status);
    }
  }

  // ─── schedule dialog ─────────────────────────────────────────────────

  openScheduleDialog(): void {
    this.showScheduleDialog = true;
    this.clearMessages();
    this.clearSelections();
    this.scheduleForm.reset({ title: '', competencyId: 0, coachUserId: 0, startsAt: '', meetLink: '' });
  }

  closeScheduleDialog(): void {
    this.showScheduleDialog = false;
  }

  submitSchedule(): void {
    if (this.scheduleForm.invalid) {
      this.scheduleForm.markAllAsTouched();
      return;
    }
    const participantUserIds = this.selectedParticipantIds;
    if (participantUserIds.length === 0) {
      this.errorMessage = 'Select at least one participant.';
      return;
    }
    const payload: CompetencySessionScheduleRequest = {
      clubId: this.clubId,
      title: this.scheduleForm.controls.title.value.trim(),
      competencyId: this.scheduleForm.controls.competencyId.value,
      coachUserId: this.scheduleForm.controls.coachUserId.value,
      startsAt: this.toIsoDateTime(this.scheduleForm.controls.startsAt.value),
      meetLink: this.scheduleForm.controls.meetLink.value.trim(),
      participantUserIds
    };
    this.saving = true;
    this.apiService.scheduleCompetencySession(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.successMessage = 'Session scheduled successfully.';
          this.closeScheduleDialog();
          this.loading = true;
          this.loadSessions();
        },
        error: () => {
          this.saving = false;
          this.errorMessage = 'Scheduling failed.';
        }
      });
  }

  // ─── close dialog ────────────────────────────────────────────────────

  openCloseDialog(session: CompetencySessionResponse): void {
    this.closeSessionDetailsDialog();
    this.closeTargetSession = session;
    this.showCloseDialog = true;
    this.closeDialogParticipants = [];
    this.closeForm.reset({ reportSummary: '', autoGenerateReport: false, speechSessionId: '' });

    this.apiService.getCompetencySessionParticipants(session.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (participants) => {
          this.closeDialogParticipants = participants.map(p => ({ ...p, attended: p.attended ?? false }));
        },
        error: () => {
          this.errorMessage = 'Failed to load participants.';
        }
      });
  }

  closeCloseDialog(): void {
    this.showCloseDialog = false;
    this.closeTargetSession = null;
    this.closeDialogParticipants = [];
  }

  submitCloseSession(): void {
    if (!this.closeTargetSession) return;
    const payload: CompetencySessionCloseRequest = {
      reportSummary: this.closeForm.controls.reportSummary.value.trim(),
      autoGenerateReport: this.closeForm.controls.autoGenerateReport.value,
      speechSessionId: this.closeForm.controls.speechSessionId.value.trim(),
      attendance: this.closeDialogParticipants.map(p => ({
        userId: p.userId,
        attended: !!p.attended
      }))
    };
    this.saving = true;
    this.apiService.closeCompetencySession(this.closeTargetSession.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.successMessage = 'Session closed.';
          this.closeCloseDialog();
          this.loading = true;
          this.loadSessions();
        },
        error: (error) => {
          this.saving = false;
          this.errorMessage = error?.message || 'Failed to close session.';
        }
      });
  }

  // ─── cancel dialog ───────────────────────────────────────────────────

  openCancelDialog(session: CompetencySessionResponse): void {
    this.closeSessionDetailsDialog();
    this.cancelTargetSession = session;
    this.showCancelDialog = true;
    this.cancelForm.reset({ reason: '' });
    this.clearMessages();
  }

  closeCancelDialog(): void {
    this.showCancelDialog = false;
    this.cancelTargetSession = null;
  }

  // ─── participants dialog ─────────────────────────────────────────────

  openParticipantsDialog(session: CompetencySessionResponse): void {
    this.closeSessionDetailsDialog();
    this.participantsTargetSession = session;
    this.showParticipantsDialog = true;
    this.participantsDialogParticipants = [];
    this.selectedInvitedMemberIds.clear();
    this.clearMessages();

    this.apiService.getCompetencySessionParticipants(session.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (participants) => {
          this.participantsDialogParticipants = participants;
          participants.forEach((p) => this.selectedInvitedMemberIds.add(p.userId));
        },
        error: () => {
          this.errorMessage = 'Impossible de charger les participants.';
        }
      });
  }

  closeParticipantsDialog(): void {
    this.showParticipantsDialog = false;
    this.participantsTargetSession = null;
    this.participantsDialogParticipants = [];
    this.selectedInvitedMemberIds.clear();
  }

  toggleInvitedMemberSelection(userId: number): void {
    if (this.selectedInvitedMemberIds.has(userId)) {
      this.selectedInvitedMemberIds.delete(userId);
      return;
    }
    this.selectedInvitedMemberIds.add(userId);
  }

  isInvitedMemberSelected(userId: number): boolean {
    return this.selectedInvitedMemberIds.has(userId);
  }

  submitParticipantsUpdate(): void {
    if (!this.participantsTargetSession) {
      return;
    }

    const payload: SessionParticipantInviteRequest = {
      participantUserIds: Array.from(this.selectedInvitedMemberIds)
    };

    if (payload.participantUserIds.length === 0) {
      this.errorMessage = 'Select at least one participant.';
      return;
    }

    this.saving = true;
    this.apiService.inviteCompetencySessionParticipants(this.participantsTargetSession.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (participants) => {
          this.saving = false;
          this.participantsDialogParticipants = participants;
          this.successMessage = 'Participants updated.';
          this.loading = true;
          this.loadSessions();
        },
        error: () => {
          this.saving = false;
          this.errorMessage = 'Failed to update participants.';
        }
      });
  }

  submitCancelSession(): void {
    if (!this.cancelTargetSession || this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.apiService.cancelCompetencySession(this.cancelTargetSession.id, {
      reason: this.cancelForm.controls.reason.value.trim()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = 'Session cancelled.';
        this.closeCancelDialog();
        this.loading = true;
        this.loadSessions();
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = error?.message || 'Failed to cancel session.';
      }
    });
  }

  // ─── reschedule dialog ───────────────────────────────────────────────

  openRescheduleDialog(session: CompetencySessionResponse): void {
    if (!this.canReschedule(session)) {
      this.errorMessage = 'This session cannot be rescheduled.';
      return;
    }
    this.closeSessionDetailsDialog();
    this.rescheduleTargetSession = session;
    this.showRescheduleDialog = true;
    this.clearMessages();
    this.rescheduleForm.reset({ startsAt: this.toDateTimeLocalValue(session.startsAt) });
  }

  closeRescheduleDialog(): void {
    this.showRescheduleDialog = false;
    this.rescheduleTargetSession = null;
  }

  submitReschedule(): void {
    if (!this.rescheduleTargetSession || this.rescheduleForm.invalid) {
      this.rescheduleForm.markAllAsTouched();
      return;
    }
    const date = new Date(this.rescheduleForm.controls.startsAt.value);
    if (isNaN(date.getTime())) {
      this.errorMessage = 'Date invalid.';
      return;
    }
    this.rescheduleSessionToDate(this.rescheduleTargetSession, date, false);
  }

  // ─── CDK drag & drop calendrier ──────────────────────────────────────

  onCalendarDrop(event: CdkDragDrop<any, any, any>, day: Date | null): void {
    if (!day) return;
    const session = event.item.data as CompetencySessionResponse;
    if (!session || !this.canReschedule(session)) {
      this.errorMessage = 'Cannot reschedule this session.';
      return;
    }
    const original = new Date(session.startsAt);
    if (this.isSameDay(original, day)) {
      this.dragSessionId = null;
      return;
    }
    const rescheduled = new Date(
      day.getFullYear(), day.getMonth(), day.getDate(),
      original.getHours(), original.getMinutes(), original.getSeconds(), 0
    );
    this.rescheduleSessionToDate(session, rescheduled, true);
  }

  onDragStarted(session: CompetencySessionResponse): void {
    this.dragSessionId = session.id;
    this.isDraggingSession = true;
    this.clearMessages();
  }

  onDragEnded(): void {
    this.dragSessionId = null;
    setTimeout(() => {
      this.isDraggingSession = false;
    }, 0);
  }

  private rescheduleSessionToDate(session: CompetencySessionResponse, newDate: Date, fromDrag: boolean): void {
    this.saving = true;
    this.clearMessages();
    this.apiService.rescheduleCompetencySession(session.id, { startsAt: this.toApiDateTime(newDate) })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.saving = false;
          this.successMessage = fromDrag
            ? 'Session rescheduled by drag & drop.'
            : 'Session rescheduled successfully.';
          this.adminSessions = this.adminSessions.map(s => s.id === updated.id ? updated : s);
          this.ensureCalendarSelection();
          this.ensureSelectedAdminSession();
          this.closeRescheduleDialog();
          this.loading = true;
          this.loadSessions();
        },
        error: (error) => {
          this.saving = false;
          this.errorMessage = error?.message || 'Rescheduling failed.';
        }
      });
  }

  // ─── sélection calendrier ────────────────────────────────────────────

  selectCalendarDay(day: Date): void {
    this.selectedCalendarDate = day;
  }

  openDayInfoDialog(day: Date): void {
    if (this.isDraggingSession) return;
    this.selectCalendarDay(day);
    this.showDayInfoDialog = true;
  }

  closeDayInfoDialog(): void {
    this.showDayInfoDialog = false;
  }

  openSessionDetails(session: CompetencySessionResponse): void {
    this.selectAdminSession(session);
    this.sessionDetailsTarget = session;
    this.showSessionDetailsDialog = true;
    this.showDayInfoDialog = false;
    this.clearMessages();
  }

  closeSessionDetailsDialog(): void {
    this.showSessionDetailsDialog = false;
    this.sessionDetailsTarget = null;
  }

  selectAdminSession(session: CompetencySessionResponse): void {
    this.selectedAdminSessionId = session.id;
    // sync le calendrier sur la date de la session sélectionnée
    const sessionDate = new Date(session.startsAt);
    if (sessionDate.getMonth() !== this.currentCalendarDate.getMonth()
      || sessionDate.getFullYear() !== this.currentCalendarDate.getFullYear()) {
      this.currentCalendarDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), 1);
    }
    this.selectedCalendarDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
  }

  previousCalendarMonth(): void {
    this.currentCalendarDate = new Date(
      this.currentCalendarDate.getFullYear(),
      this.currentCalendarDate.getMonth() - 1, 1
    );
  }

  nextCalendarMonth(): void {
    this.currentCalendarDate = new Date(
      this.currentCalendarDate.getFullYear(),
      this.currentCalendarDate.getMonth() + 1, 1
    );
  }

  // ─── actions sessions ─────────────────────────────────────────────────

  joinMeet(session: CompetencySessionResponse): void {
    if (session.meetLink) window.open(session.meetLink, '_blank');
  }

  viewReport(session: CompetencySessionResponse): void {
    this.expandedReportSessionId = this.expandedReportSessionId === session.id ? null : session.id;
  }

  openDetailsFromCalendar(session: CompetencySessionResponse): void {
    this.openSessionDetails(session);
  }

  shouldShowViewReport(session: CompetencySessionResponse): boolean {
    return session.status === 'COMPLETED' && !!session.reportSummary;
  }

  // ─── getters computed ────────────────────────────────────────────────

  get calendarMonthLabel(): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(this.currentCalendarDate);
  }

  get calendarSessions(): CompetencySessionResponse[] {
    if (this.isMemberRole) {
      return [...this.memberUpcomingSessions, ...this.memberPastSessions];
    }
    return this.adminSessions.filter(s => this.activeAdminStatuses.has(s.status));
  }

  get selectedAdminSession(): CompetencySessionResponse | null {
    if (this.selectedAdminSessionId === null) return null;
    return this.adminSessions.find(s => s.id === this.selectedAdminSessionId) ?? null;
  }

  get calendarDays(): Array<Date | null> {
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = (firstDay.getDay() + 6) % 7;

    const cells: Array<Date | null> = [];
    for (let i = 0; i < firstDayIndex; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  get selectedDaySessions(): CompetencySessionResponse[] {
    if (!this.selectedCalendarDate) return [];
    return this.calendarSessions
      .filter(s => this.isSameDay(new Date(s.startsAt), this.selectedCalendarDate!))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  get selectedCalendarDateLabel(): string {
    if (!this.selectedCalendarDate) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.selectedCalendarDate);
  }

  get draggableAdminSessions(): CompetencySessionResponse[] {
    return this.adminSessions
      .filter(s => this.canReschedule(s))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    // suppression de la limite arbitraire à 8
  }

  get calendarDropListIds(): string[] {
    const ids: string[] = ['sessions-source-list'];
    this.calendarDays.forEach((day, idx) => {
      if (day) ids.push(this.dayDropListId(idx));
    });
    return ids;
  }

  get selectedParticipantIds(): number[] {
    return Array.from(this.selectedMemberIds).filter(id => id > 0);
  }

  // ─── helpers calendrier ──────────────────────────────────────────────

  sessionsOnDay(day: Date): CompetencySessionResponse[] {
    return this.calendarSessions
      .filter(s => this.isSameDay(new Date(s.startsAt), day))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  sessionsCountOnDay(day: Date): number {
    return this.calendarSessions.filter(s => this.isSameDay(new Date(s.startsAt), day)).length;
  }

  hasSessionsOnDay(day: Date): boolean {
    return this.sessionsCountOnDay(day) > 0;
  }

  isSelectedCalendarDay(day: Date): boolean {
    return !!this.selectedCalendarDate && this.isSameDay(day, this.selectedCalendarDate);
  }

  isToday(day: Date): boolean {
    return this.isSameDay(day, new Date());
  }

  dayDropListId(idx: number): string {
    return `sessions-day-${idx}`;
  }

  canReschedule(session: CompetencySessionResponse): boolean {
    const s = String(session.status || '').toUpperCase();
    return s === 'SCHEDULED' || s === 'ONGOING';
  }

  // ─── helpers display ─────────────────────────────────────────────────

  statusLabel(status: SessionStatus): string {
    const map: Record<SessionStatus, string> = {
      SCHEDULED: 'Scheduled',
      ONGOING: 'Ongoing',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled'
    };
    return map[status] ?? status;
  }

  statusClass(status: SessionStatus): string {
    return `status--${status.toLowerCase()}`;
  }

  dayLabel(startsAt: string): string {
    const date = new Date(startsAt);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(todayStart.getDate() + 1);
    const dayAfter = new Date(todayStart);
    dayAfter.setDate(todayStart.getDate() + 2);

    if (date >= todayStart && date < tomorrow) return "Today";
    if (date >= tomorrow && date < dayAfter) return 'Tomorrow';
    return '';
  }

  formatDate(dateValue?: string): string {
    if (!dateValue) return '-';
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateValue));
  }

  memberDisplayName(userId: number): string {
    const found = this.members.find(m => m.userId === userId);
    if (!found) return 'Unknown';
    return `${found.firstName ?? ''} ${found.lastName ?? ''}`.trim() || found.email || 'Unknown';
  }

  toggleMemberSelection(userId: number): void {
    if (this.selectedMemberIds.has(userId)) {
      this.selectedMemberIds.delete(userId);
    } else {
      this.selectedMemberIds.add(userId);
    }
  }

  clearSelections(): void {
    this.selectedMemberIds.clear();
  }

  isMemberSelected(userId: number): boolean {
    return this.selectedMemberIds.has(userId);
  }

  trackBySessionId(_idx: number, item: CompetencySessionResponse): number {
    return item.id;
  }

  // ─── privé ───────────────────────────────────────────────────────────

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  private ensureCalendarSelection(): void {
    if (this.calendarSessions.length === 0) {
      this.selectedCalendarDate = null;
      return;
    }
    if (this.selectedCalendarDate
      && this.calendarSessions.some(s => this.isSameDay(new Date(s.startsAt), this.selectedCalendarDate!))) {
      return;
    }
    const first = [...this.calendarSessions]
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
    this.selectedCalendarDate = first ? new Date(first.startsAt) : null;
  }

  private ensureSelectedAdminSession(): void {
    if (this.isMemberRole || this.adminSessions.length === 0) {
      this.selectedAdminSessionId = null;
      return;
    }
    if (this.selectedAdminSessionId !== null
      && this.adminSessions.some(s => s.id === this.selectedAdminSessionId)) {
      return;
    }
    this.selectedAdminSessionId = this.adminSessions[0].id;
  }

  private toIsoDateTime(value: string): string {
    return this.toApiDateTime(new Date(value));
  }

  private toApiDateTime(date: Date): string {
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
  }

  private toDateTimeLocalValue(dateValue: string): string {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
  }
}