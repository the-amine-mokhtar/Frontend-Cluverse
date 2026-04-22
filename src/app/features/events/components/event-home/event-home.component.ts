import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EventApiService, EventItem } from '../../services/event-api.service';
import { environment } from '../../../../../environments/environment';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

// ─── Known categories ──────────────────────────────────────────
const KNOWN_CATEGORIES = ['CONFERENCE', 'WORKSHOP', 'MEETING', 'TRAINING', 'HACKATHON', 'SOCIAL'];

@Component({
  selector: 'app-event-home',
  templateUrl: './event-home.component.html',
  styleUrls: ['./event-home.component.scss']
})
export class EventHomeComponent implements OnInit {

  // ─── Data ────────────────────────────────────────────────────
  allEvents: EventItem[] = [];
  displayedEvents: EventItem[] = [];
  filteredEvents: EventItem[] = [];
  paginatedEvents: EventItem[] = [];

  // ─── View state ──────────────────────────────────────────────
  isViewingHistory = false;
  showCalendarModal = false;
  showDeleteModal = false;
  showParticipantsModal = false;
  showPaymentModal = false;
  isLoading = true;

  // ─── Selections ──────────────────────────────────────────────
  selectedEvent: EventItem | null = null;
  selectedEventToDelete: EventItem | null = null;
  selectedEventForParticipants: EventItem | undefined;
  selectedEventForPayment: EventItem | null = null;
  selectedDate = '';

  // ─── Category filter ─────────────────────────────────────────
  selectedCategory = '';
  customCategoryInput = '';
  isCustomCategory = false;

  // ─── Search ──────────────────────────────────────────────────
  searchTerm = '';

  // ─── Pagination ──────────────────────────────────────────────
  currentPage = 1;
  pageSize = 6;
  totalPages = 1;
  pageNumbers: number[] = [];


  // ─── Participants ─────────────────────────────────────────────
  eventParticipants: any[] = [];
  isLoadingParticipants = false;

  // ─── User Role ───────────────────────────────────────────────
  userRole: string = '';
  isPresident = false;

  constructor(
    private eventService: EventApiService,
    private router: Router,
    private authHelper: AuthHelperService
  ) {}


  // ─── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    this.userRole = this.authHelper.getRole();
    this.isPresident = this.authHelper.getRole() === 'PRESIDENT';
    this.loadAllEvents();
  }

  // ─── Loading Events and Data ────────────────────────────────
  loadAllEvents(): void {
    this.isLoading = true;
    this.eventService.getMyEvents().subscribe({
      next: (allEvents) => {
        this.allEvents = allEvents;
        this.loadDisplayedEvents();
      },
      error: () => {
        this.allEvents = [];
        this.displayedEvents = [];
        this.filteredEvents = [];
        this.paginatedEvents = [];
        this.isLoading = false;
      }
    });
  }

  loadDisplayedEvents(status?: string): void {
    this.eventService.getMyEvents(status).subscribe({
      next: (events) => {
        if (!status && !this.isViewingHistory) {
          this.displayedEvents = events.filter(e => e.status !== 'COMPLETED');
        } else {
          this.displayedEvents = events;
        }
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.displayedEvents = [];
        this.filteredEvents = [];
        this.paginatedEvents = [];
        this.isLoading = false;
      }
    });
  }

  // ─── Category Filter ─────────────────────────────────────────
  setCategoryFilter(cat: string): void {
    this.selectedCategory = cat;
    this.customCategoryInput = '';
    this.isCustomCategory = false;
    this.currentPage = 1;
    this.applyFilters();
  }

  onCustomCategoryInput(): void {
    const val = this.customCategoryInput.trim().toUpperCase();
    if (KNOWN_CATEGORIES.includes(val)) {
      this.selectedCategory = val;
      this.customCategoryInput = '';
      this.isCustomCategory = false;
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
    this.isCustomCategory = false;
    this.selectedCategory = '';
    this.applyFilters();
  }

  // ─── Master Filter ───────────────────────────────────────────
  applyFilters(): void {
    let result = [...this.displayedEvents];

    // Known category pill
    if (this.selectedCategory) {
      result = result.filter(e =>
        (e.category || '').toUpperCase() === this.selectedCategory
      );
    }

    // Custom free-text category — partial match, case-insensitive
    if (this.isCustomCategory && this.customCategoryInput.trim()) {
      const needle = this.customCategoryInput.trim().toLowerCase();
      result = result.filter(e =>
        (e.category || '').toLowerCase().includes(needle)
      );
    }

    // Date filter
    if (this.selectedDate) {
      result = result.filter(e => {
        const d = new Date(e.startDate!);
        return d.toISOString().substring(0, 10) === this.selectedDate;
      });
    }

    // Search term (title / description)
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term)
      );
    }

    this.filteredEvents = result;
    this.totalPages = Math.max(1, Math.ceil(result.length / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    this.buildPageNumbers();
    this.paginate();
  }

  // ─── Pagination ────────────────────────────────────────────
  paginate(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedEvents = this.filteredEvents.slice(start, start + this.pageSize);
  }

  buildPageNumbers(): void {
    this.pageNumbers = Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.paginate();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.paginate();
    }
  }

  goToPage(p: number): void {
    this.currentPage = p;
    this.paginate();
  }

  // ─── History ─────────────────────────────────────────────────
  toggleHistoryView(): void {
    this.isViewingHistory = !this.isViewingHistory;
    this.loadDisplayedEvents(this.isViewingHistory ? 'COMPLETED' : undefined);
  }

  // ─── Modals ──────────────────────────────────────────────────
  openPopup(event: EventItem): void {
    this.selectedEvent = event;
  }

  closePopup(): void {
    this.selectedEvent = null;
  }

  openCalendarModal(): void {
    this.showCalendarModal = true;
  }

  closeCalendarModal(): void {
    this.showCalendarModal = false;
  }

  openDeleteModal(event: EventItem): void {
    this.selectedEventToDelete = event;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
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
        this.allEvents = this.allEvents.filter(e => e.id !== deletedId);
        this.displayedEvents = this.displayedEvents.filter(e => e.id !== deletedId);
        this.filteredEvents = this.filteredEvents.filter(e => e.id !== deletedId);
        this.paginatedEvents = this.paginatedEvents.filter(e => e.id !== deletedId);

        if (this.selectedEvent?.id === deletedId) {
          this.selectedEvent = null;
        }

        this.applyFilters();
        this.closeDeleteModal();
      },
      error: (err) => {
        console.error('Delete failed', err);
        alert('Failed to delete event.');
      }
    });
  }

  viewParticipants(event: EventItem): void {
    this.selectedEventForParticipants = event;
    this.showParticipantsModal = true;
    this.isLoadingParticipants = true;
    this.eventParticipants = [];

    this.eventService.getEventParticipants(event.id).subscribe({
      next: (response: any) => {
        let participants: any[] = [];
        if (Array.isArray(response)) {
          participants = response;
        } else if (response && typeof response === 'object') {
          if (response.content && Array.isArray(response.content)) {
            participants = response.content;
          } else if (response.data && Array.isArray(response.data)) {
            participants = response.data;
          } else if (response.participants && Array.isArray(response.participants)) {
            participants = response.participants;
          } else {
            for (const key in response) {
              if (Array.isArray(response[key])) {
                participants = response[key];
                break;
              }
            }
          }
        }
        this.eventParticipants = participants;
        this.isLoadingParticipants = false;
      },
      error: () => {
        this.eventParticipants = [];
        this.isLoadingParticipants = false;
      }
    });
  }

  closeParticipantsModal(): void {
    this.showParticipantsModal = false;
    this.selectedEventForParticipants = undefined;
    this.eventParticipants = [];
  }

  openPaymentModal(event: EventItem): void {
    if (!event.isPaid) {
      alert('This event is free, no payment required.');
      return;
    }
    this.selectedEventForPayment = event;
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.selectedEventForPayment = null;
  }

  processPayment(paymentData: any): void {
    if (!this.selectedEventForPayment) return;
    console.log('Processing payment for event:', this.selectedEventForPayment.id, paymentData);
    alert('Payment processing would be integrated here with Stripe/PayPal');
    this.closePaymentModal();
  }

  // ─── Navigation ──────────────────────────────────────────────
  goToNew(): void {
    this.router.navigate(['/dashboard/events/create']);
  }

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
    if (confirm(`Voulez-vous vraiment supprimer "${event.title}" ?`)) {
      this.eventService.deleteEvent(event.id).subscribe(() => {
        this.loadAllEvents();
      });
    }
  }

  // ─── Capacity Helpers ────────────────────────────────────────
  getCapacityStatusColor(event: EventItem): string {
    if (!event.capacity || event.capacity <= 0) {
      return 'success';
    }
    const remaining = event.capacity - (event.participantsCount || 0);
    if (remaining <= 0) return 'danger';
    if (remaining <= (event.capacity * 0.10)) return 'warning';
    return 'success';
  }

  getCapacityStatusLabel(event: EventItem): string {
    if (!event.capacity || event.capacity <= 0) {
      return 'Unlimited';
    }
    const remaining = event.capacity - (event.participantsCount || 0);
    if (remaining <= 0) return 'Full';
    return `${remaining} seats left`;
  }

  // ─── Formatting ──────────────────────────────────────────────
  formatDate(date?: string | Date): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(date));
  }

  trackById(index: number, item: EventItem): any {
    return item.id;
  }

}