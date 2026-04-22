import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EventApiService, EventItem, normalizeEvent } from '../../services/event-api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { CampaignApiService, Campaign } from '../../services/campaign-api.service';
import { EventStatusChangeService } from '../../services/event-status-change.service';

export const KNOWN_CATEGORIES = [
  'CONFERENCE', 'WORKSHOP', 'MEETING', 'TRAINING', 'HACKATHON', 'SOCIAL'
] as const;

const AVATAR_COLORS = ['indigo', 'teal', 'amber', 'violet', 'rose'] as const;

@Component({
  selector: 'app-event-home',
  templateUrl: './event-home.component.html',
  styleUrls: ['./event-home.component.scss']
})
export class EventHomeComponent implements OnInit, OnDestroy {

  // ─── Data ─────────────────────────────────────────────────────────────────
  allEvents: EventItem[]       = [];
  displayedEvents: EventItem[] = [];
  filteredEvents: EventItem[]  = [];
  paginatedEvents: EventItem[] = [];

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
  showPaymentModal      = false;
  isLoading             = true;

  // ─── Selections ───────────────────────────────────────────────────────────
  selectedEvent: EventItem | null                    = null;
  selectedEventToDelete: EventItem | null            = null;
  selectedEventForParticipants: EventItem | undefined;
  selectedEventForPayment: EventItem | null          = null;
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
      });
  }

  ngOnDestroy(): void {
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
        this.isLoading = false;
      },
      error: () => {
        this.allEvents       = [];
        this.displayedEvents = [];
        this.filteredEvents  = [];
        this.paginatedEvents = [];
        this.isLoading       = false;
      }
    });
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
    return !!campaign.canAddEvent;
  }

  addEventToCampaign(campaign: Campaign): void {
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
    this.totalPages     = Math.max(1, Math.ceil(result.length / this.pageSize));
    this.currentPage    = Math.min(this.currentPage, this.totalPages);
    this.buildPageNumbers();
    this.paginate();
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════
  openPopup(event: EventItem): void  { this.selectedEvent = event; }
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
    const deletedId = this.selectedEventToDelete.id;
    this.eventService.deleteEvent(deletedId).subscribe({
      next: () => {
        this.allEvents       = this.allEvents.filter(e => e.id !== deletedId);
        this.displayedEvents = this.displayedEvents.filter(e => e.id !== deletedId);
        this.filteredEvents  = this.filteredEvents.filter(e => e.id !== deletedId);
        this.paginatedEvents = this.paginatedEvents.filter(e => e.id !== deletedId);
        if (this.selectedEvent?.id === deletedId) this.selectedEvent = null;
        this.applyFilters();
        this.closeDeleteModal();
      },
      error: (err) => console.error('Delete failed', err)
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

  openPaymentModal(event: EventItem): void {
    if (!event.isPaid) return;
    this.selectedEventForPayment = event;
    this.showPaymentModal        = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal        = false;
    this.selectedEventForPayment = null;
  }

  processPayment(paymentData: any): void {
    if (!this.selectedEventForPayment) return;
    console.log('Processing payment:', this.selectedEventForPayment.id, paymentData);
    this.closePaymentModal();
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