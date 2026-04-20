import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  SponsorService,
  Sponsor,
  CreateSponsorRequest,
  UpdateSponsorRequest,
  SponsorEmail,
  SendSponsorEmailRequest,
  SponsorEmailAttachment
} from '../../../../core/services/sponsor.service';
import { SponsorFileUtilsService } from '../../../../core/services/sponsor-file-utils.service';

interface CountryCodeOption {
  code: string;
  flag: string;
  label: string;
}

@Component({
  selector: 'app-sponsorship-home',
  templateUrl: './sponsorship-home.component.html',
  styleUrls: ['./sponsorship-home.component.scss']
})
export class SponsorshipHomeComponent implements OnInit {
  readonly countryCodeOptions: CountryCodeOption[] = [
    { code: '+216', flag: '🇹🇳', label: 'Tunisia' },
    { code: '+33', flag: '🇫🇷', label: 'France' },
    { code: '+1', flag: '🇺🇸', label: 'United States' },
    { code: '+44', flag: '🇬🇧', label: 'United Kingdom' },
    { code: '+49', flag: '🇩🇪', label: 'Germany' },
    { code: '+39', flag: '🇮🇹', label: 'Italy' },
    { code: '+34', flag: '🇪🇸', label: 'Spain' },
    { code: '+971', flag: '🇦🇪', label: 'UAE' }
  ];

  sponsors: Sponsor[] = [];
  isLoading = false;
  loadError = '';

  showAddForm = false;
  showEditForm = false;
  showDeleteConfirm = false;
  isSubmitting = false;
  isUpdating = false;
  isDeleting = false;
  submitError = '';
  submitSuccess = '';
  editError = '';

  showFilterMenu = false;
  filterStatus: 'ALL' | 'PENDING' | 'CONFIRMED' | 'DENIED' = 'ALL';
  filterCountryCode = 'ALL';
  filterQuery = '';
  filterSort: 'NEWEST' | 'OLDEST' | 'NAME_ASC' | 'NAME_DESC' = 'NEWEST';

  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  toastVisible = false;
  private toastTimer?: ReturnType<typeof setTimeout>;

  activeActionMenuSponsorId: number | null = null;

  showEmailsModal = false;
  emailsLoading = false;
  emailsSyncing = false;
  emailsSubmitting = false;
  emailsError = '';
  selectedEmailSponsor: Sponsor | null = null;
  sponsorEmails: SponsorEmail[] = [];
  selectedEmail: SponsorEmail | null = null;
  showReplyBox = false;
  replyBody = '';
  replyFiles: File[] = [];
  emailTab: 'LIST' | 'COMPOSE' = 'LIST';
  composeForm: SendSponsorEmailRequest = {
    subject: '',
    body: ''
  };
  composeFiles: File[] = [];

  showAttachmentViewer = false;
  viewerAttachments: SponsorEmailAttachment[] = [];
  viewerIndex = 0;
  viewerZoom = 1;
  viewerTextContent = '';
  viewerTextLoading = false;

  addCountryCode = '+216';
  addPhoneDigits = '';

  editCountryCode = '+216';
  editPhoneDigits = '';
  editForm: UpdateSponsorRequest = {
    id: 0,
    name: '',
    contactEmail: '',
    phone: ''
  };

  pendingDelete: Sponsor | null = null;
  deleteReason = 'Strategic realignment of partnership priorities';
  readonly deleteReasonOptions: string[] = [
    'Strategic realignment of partnership priorities',
    'Budget constraints and sponsorship restructuring',
    'End of agreed sponsorship period',
    'Operational scope no longer aligned',
    'Compliance or policy requirements'
  ];

  selectedAddLogoFile: File | null = null;
  selectedEditLogoFile: File | null = null;
  addLogoPreview = '';
  editLogoPreview = '';

  currentPage = 1;
  readonly pageSize = 5;

  form: CreateSponsorRequest = {
    name: '',
    contactEmail: '',
    phone: ''
  };

  constructor(
    private sponsorService: SponsorService,
    private sponsorFileUtils: SponsorFileUtilsService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadSponsors();
  }

  loadSponsors(): void {
    this.isLoading = true;
    this.loadError = '';

    this.sponsorService.getAll().subscribe({
      next: (data) => {
        this.sponsors = [...data].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        this.currentPage = 1;
        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'Failed to load sponsors. Please refresh the page.';
        this.isLoading = false;
        this.showToast(this.loadError, 'error');
      }
    });
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.submitError = '';
    this.submitSuccess = '';
    this.addCountryCode = '+216';
    this.addPhoneDigits = '';
    this.selectedAddLogoFile = null;
    this.addLogoPreview = '';
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.submitError = '';
    this.submitSuccess = '';
    this.form = { name: '', contactEmail: '', phone: '' };
    this.addCountryCode = '+216';
    this.addPhoneDigits = '';
    this.selectedAddLogoFile = null;
    this.addLogoPreview = '';
  }

  onConfirmAdd(): void {
    if (!this.isFormValid()) return;

    this.isSubmitting = true;
    this.submitError = '';
    this.submitSuccess = '';
    const payload: CreateSponsorRequest = {
      name: this.form.name.trim(),
      contactEmail: this.form.contactEmail.trim(),
      phone: this.buildFullPhone(this.addCountryCode, this.addPhoneDigits)
    };

    this.sponsorService.create(payload).subscribe({
      next: (created) => {
        if (this.selectedAddLogoFile && created.id) {
          this.sponsorService.uploadLogo(created.id, this.selectedAddLogoFile).subscribe({
            next: (updatedWithLogo) => {
              this.sponsors = [updatedWithLogo, ...this.sponsors];
              this.finishAddFlow();
            },
            error: () => {
              this.sponsors = [created, ...this.sponsors];
              this.finishAddFlow('Sponsor created, but logo upload failed.');
            }
          });
        } else {
          this.sponsors = [created, ...this.sponsors];
          this.finishAddFlow();
        }
      },
      error: (err: unknown) => {
        this.isSubmitting = false;
        if (err instanceof HttpErrorResponse) {
          const msg = typeof err.error === 'string'
            ? err.error
            : (err.error?.message ?? err.message ?? 'Failed to add sponsor.');
          this.submitError = msg;
        } else {
          this.submitError = 'Failed to add sponsor.';
        }
        this.showToast(this.submitError, 'error');
      }
    });
  }

  private finishAddFlow(message = 'Sponsor invitation sent successfully.'): void {
    this.currentPage = 1;
    this.isSubmitting = false;
    this.submitSuccess = 'Sponsor invitation sent and saved as Pending.';
    this.form = { name: '', contactEmail: '', phone: '' };
    this.addCountryCode = '+216';
    this.addPhoneDigits = '';
    this.selectedAddLogoFile = null;
    this.addLogoPreview = '';
    setTimeout(() => this.closeAddForm(), 700);
    this.showToast(message, 'success');
  }

  isFormValid(): boolean {
    return this.form.name.trim().length >= 2
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.contactEmail)
      && this.addPhoneDigits.length === 8;
  }

  isEditFormValid(): boolean {
    return this.editForm.name.trim().length >= 2
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.editForm.contactEmail)
      && this.editPhoneDigits.length === 8
      && this.editForm.id > 0;
  }

  get pagedSponsors(): Sponsor[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredSponsors.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredSponsors.length / this.pageSize));
  }

  get pinnedEmails(): SponsorEmail[] {
    return this.sponsorEmails.filter(email => !!email.pinned);
  }

  get unpinnedEmails(): SponsorEmail[] {
    return this.sponsorEmails.filter(email => !email.pinned);
  }

  get filteredSponsors(): Sponsor[] {
    const q = this.filterQuery.trim().toLowerCase();

    const filtered = this.sponsors.filter((sponsor) => {
      const statusMatches = this.filterStatus === 'ALL' || (sponsor.status || 'PENDING').toUpperCase() === this.filterStatus;
      const countryMatches = this.filterCountryCode === 'ALL' || this.splitPhone(sponsor.phone || '').code === this.filterCountryCode;
      const queryMatches = !q
        || sponsor.name.toLowerCase().includes(q)
        || sponsor.contactEmail.toLowerCase().includes(q)
        || sponsor.phone.toLowerCase().includes(q);
      return statusMatches && countryMatches && queryMatches;
    });

    const sorted = [...filtered];
    switch (this.filterSort) {
      case 'OLDEST':
        sorted.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        break;
      case 'NAME_ASC':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'NAME_DESC':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        sorted.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        break;
    }
    return sorted;
  }


  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  toggleFilterMenu(): void {
    this.showFilterMenu = !this.showFilterMenu;
  }

  onFiltersChanged(): void {
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.filterStatus = 'ALL';
    this.filterCountryCode = 'ALL';
    this.filterQuery = '';
    this.filterSort = 'NEWEST';
    this.currentPage = 1;
  }

  statusClass(status: string | undefined): string {
    switch ((status || '').toUpperCase()) {
      case 'CONFIRMED': return 'sponsors__status-badge--confirmed';
      case 'DENIED': return 'sponsors__status-badge--denied';
      default: return 'sponsors__status-badge--pending';
    }
  }

  onEditSponsor(sponsor: Sponsor): void {
    if (!sponsor.id) return;
    const split = this.splitPhone(sponsor.phone || '');
    this.editForm = {
      id: sponsor.id,
      name: sponsor.name,
      contactEmail: sponsor.contactEmail,
      phone: sponsor.phone,
      status: sponsor.status,
      confirmationToken: sponsor.confirmationToken,
      tokenExpiresAt: sponsor.tokenExpiresAt
    };
    this.editCountryCode = split.code;
    this.editPhoneDigits = split.local;
    this.selectedEditLogoFile = null;
    this.editLogoPreview = sponsor.logoUrl || '';
    this.editError = '';
    this.showEditForm = true;
  }

  onDeleteSponsor(sponsor: Sponsor): void {
    if (!sponsor.id) return;
    this.pendingDelete = sponsor;
    this.showDeleteConfirm = true;
    this.editError = '';
    this.deleteReason = this.deleteReasonOptions[0];
  }

  closeEditForm(): void {
    this.showEditForm = false;
    this.editError = '';
    this.selectedEditLogoFile = null;
    this.editLogoPreview = '';
  }

  closeDeleteConfirm(): void {
    this.showDeleteConfirm = false;
    this.pendingDelete = null;
    this.deleteReason = this.deleteReasonOptions[0];
  }

  onConfirmEdit(): void {
    if (!this.isEditFormValid()) return;

    this.isUpdating = true;
    this.editError = '';

    const payload: UpdateSponsorRequest = {
      ...this.editForm,
      name: this.editForm.name.trim(),
      contactEmail: this.editForm.contactEmail.trim(),
      phone: this.buildFullPhone(this.editCountryCode, this.editPhoneDigits)
    };

    this.sponsorService.update(payload).subscribe({
      next: (updated) => {
        if (this.selectedEditLogoFile && updated.id) {
          this.sponsorService.uploadLogo(updated.id, this.selectedEditLogoFile).subscribe({
            next: (updatedWithLogo) => {
              this.sponsors = this.sponsors.map(s => (s.id === updatedWithLogo.id ? updatedWithLogo : s));
              this.isUpdating = false;
              this.showEditForm = false;
              this.showToast(`Sponsor ${updatedWithLogo.name} updated successfully.`, 'success');
            },
            error: () => {
              this.sponsors = this.sponsors.map(s => (s.id === updated.id ? updated : s));
              this.isUpdating = false;
              this.showEditForm = false;
              this.showToast(`Sponsor ${updated.name} updated, but logo upload failed.`, 'error');
            }
          });
        } else {
          this.sponsors = this.sponsors.map(s => (s.id === updated.id ? updated : s));
          this.isUpdating = false;
          this.showEditForm = false;
          this.showToast(`Sponsor ${updated.name} updated successfully.`, 'success');
        }
      },
      error: (err: unknown) => {
        this.isUpdating = false;
        this.editError = this.resolveError(err, 'Failed to update sponsor.');
        this.showToast(this.editError, 'error');
      }
    });
  }

  onConfirmDelete(): void {
    if (!this.pendingDelete?.id) return;

    this.isDeleting = true;
    this.editError = '';
    const sponsorName = this.pendingDelete.name;

    this.sponsorService.delete(this.pendingDelete.id, this.deleteReason).subscribe({
      next: () => {
        this.sponsors = this.sponsors.filter(s => s.id !== this.pendingDelete?.id);
        this.isDeleting = false;
        this.showDeleteConfirm = false;
        this.pendingDelete = null;
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages;
        }
        this.showToast(`Sponsor ${sponsorName} deleted successfully.`, 'success');
      },
      error: (err: unknown) => {
        this.isDeleting = false;
        this.editError = this.resolveError(err, 'Failed to delete sponsor.');
        this.showToast(this.editError, 'error');
      }
    });
  }

  toggleActionMenu(sponsor: Sponsor): void {
    if (!sponsor.id) {
      return;
    }
    this.activeActionMenuSponsorId = this.activeActionMenuSponsorId === sponsor.id ? null : sponsor.id;
  }

  onOpenEmails(sponsor: Sponsor): void {
    if (!sponsor.id) {
      return;
    }

    this.activeActionMenuSponsorId = null;
    this.selectedEmailSponsor = sponsor;
    this.showEmailsModal = true;
    this.emailTab = 'LIST';
    this.sponsorEmails = [];
    this.selectedEmail = null;
    this.showReplyBox = false;
    this.replyBody = '';
    this.replyFiles = [];
    this.composeForm = {
      subject: `Sponsorship Follow-up - ${sponsor.name}`,
      body: ''
    };
    this.composeFiles = [];
    this.loadSponsorEmails(sponsor.id);
  }

  onOpenHistory(sponsor: Sponsor): void {
    if (!sponsor.id) {
      return;
    }
    this.activeActionMenuSponsorId = null;
  }

  closeEmailsModal(): void {
    this.showEmailsModal = false;
    this.selectedEmailSponsor = null;
    this.sponsorEmails = [];
    this.selectedEmail = null;
    this.showReplyBox = false;
    this.replyBody = '';
    this.replyFiles = [];
    this.emailTab = 'LIST';
    this.emailsError = '';
    this.composeFiles = [];
  }

  setEmailTab(tab: 'LIST' | 'COMPOSE'): void {
    this.emailTab = tab;
    this.emailsError = '';
    if (tab === 'COMPOSE') {
      this.showReplyBox = false;
    }
  }

  selectEmail(email: SponsorEmail): void {
    this.selectedEmail = email;
    this.showReplyBox = false;
    this.replyBody = '';

    if (!this.selectedEmailSponsor?.id) {
      return;
    }

    this.sponsorService.getEmail(this.selectedEmailSponsor.id, email.id).subscribe({
      next: (detailed) => {
        this.selectedEmail = detailed;
      },
      error: () => {
        this.selectedEmail = email;
      }
    });
  }

  openReplyBox(): void {
    this.showReplyBox = true;
    this.replyBody = '';
    this.replyFiles = [];
  }

  sendComposeEmail(): void {
    if (!this.selectedEmailSponsor?.id) {
      return;
    }

    const subject = this.composeForm.subject.trim();
    const body = this.composeForm.body.trim();
    if (!subject || !body) {
      this.emailsError = 'Subject and message are required.';
      return;
    }

    this.emailsSubmitting = true;
    this.emailsError = '';

    const payload: SendSponsorEmailRequest = { subject, body };
    const request$ = this.composeFiles.length > 0
      ? this.sponsorService.sendEmailWithFiles(this.selectedEmailSponsor.id, payload, this.composeFiles)
      : this.sponsorService.sendEmail(this.selectedEmailSponsor.id, payload);

    request$.subscribe({
      next: (created) => {
        this.sponsorEmails = [created, ...this.sponsorEmails];
        this.selectedEmail = created;
        this.emailTab = 'LIST';
        this.composeForm.body = '';
        this.composeFiles = [];
        this.emailsSubmitting = false;
        this.showToast(`Email sent to ${this.selectedEmailSponsor?.name}.`, 'success');
      },
      error: (err: unknown) => {
        this.emailsSubmitting = false;
        this.emailsError = this.resolveError(err, 'Failed to send email.');
      }
    });
  }

  sendReply(): void {
    if (!this.selectedEmailSponsor?.id || !this.selectedEmail?.id) {
      return;
    }

    const body = this.replyBody.trim();
    if (!body) {
      this.emailsError = 'Reply message is required.';
      return;
    }

    this.emailsSubmitting = true;
    this.emailsError = '';

    const payload: SendSponsorEmailRequest = { subject: '', body };
    const request$ = this.replyFiles.length > 0
      ? this.sponsorService.replyEmailWithFiles(this.selectedEmailSponsor.id, this.selectedEmail.id, payload, this.replyFiles)
      : this.sponsorService.replyEmail(this.selectedEmailSponsor.id, this.selectedEmail.id, payload);

    request$.subscribe({
      next: (reply) => {
        this.sponsorEmails = [reply, ...this.sponsorEmails];
        this.selectedEmail = reply;
        this.showReplyBox = false;
        this.replyBody = '';
        this.replyFiles = [];
        this.emailsSubmitting = false;
        this.showToast(`Reply sent to ${this.selectedEmailSponsor?.name}.`, 'success');
      },
      error: (err: unknown) => {
        this.emailsSubmitting = false;
        this.emailsError = this.resolveError(err, 'Failed to send reply.');
      }
    });
  }

  togglePin(email: SponsorEmail): void {
    if (!this.selectedEmailSponsor?.id || !email?.id) {
      return;
    }

    this.emailsSubmitting = true;
    this.emailsError = '';

    const request$ = email.pinned
      ? this.sponsorService.unpinEmail(this.selectedEmailSponsor.id, email.id)
      : this.sponsorService.pinEmail(this.selectedEmailSponsor.id, email.id);

    request$.subscribe({
      next: (updated) => {
        this.sponsorEmails = this.sponsorEmails.map(item => item.id === updated.id ? updated : item);
        this.selectedEmail = updated;
        this.emailsSubmitting = false;
        this.showToast(
          updated.pinned ? 'Email pinned successfully.' : 'Email unpinned successfully.',
          'success'
        );
      },
      error: (err: unknown) => {
        this.emailsSubmitting = false;
        this.emailsError = this.resolveError(err, 'Failed to update pin status.');
      }
    });
  }

  formatEmailDate(value: string | undefined): string {
    if (!value) {
      return '--';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  onComposeFilesSelected(event: Event): void {
    this.composeFiles = this.mergeFiles(this.composeFiles, this.extractValidFiles(event));
  }

  removeComposeFile(index: number): void {
    this.composeFiles = this.composeFiles.filter((_, i) => i !== index);
  }

  onReplyFilesSelected(event: Event): void {
    this.replyFiles = this.mergeFiles(this.replyFiles, this.extractValidFiles(event));
  }

  removeReplyFile(index: number): void {
    this.replyFiles = this.replyFiles.filter((_, i) => i !== index);
  }

  formatFileSize(sizeBytes: number | undefined): string {
    return this.sponsorFileUtils.formatSize(sizeBytes || 0);
  }

  openAttachmentViewer(attachments: SponsorEmailAttachment[] | undefined, index: number): void {
    if (!attachments || attachments.length === 0) {
      return;
    }
    this.viewerAttachments = attachments;
    this.viewerIndex = Math.max(0, Math.min(index, attachments.length - 1));
    this.viewerZoom = 1;
    this.showAttachmentViewer = true;
    this.loadViewerTextIfNeeded();
  }

  closeAttachmentViewer(): void {
    this.showAttachmentViewer = false;
    this.viewerAttachments = [];
    this.viewerIndex = 0;
    this.viewerZoom = 1;
    this.viewerTextContent = '';
    this.viewerTextLoading = false;
  }

  get currentViewerAttachment(): SponsorEmailAttachment | null {
    if (!this.viewerAttachments.length) {
      return null;
    }
    return this.viewerAttachments[this.viewerIndex] || null;
  }

  previousAttachment(): void {
    if (this.viewerAttachments.length === 0) {
      return;
    }
    this.viewerIndex = (this.viewerIndex - 1 + this.viewerAttachments.length) % this.viewerAttachments.length;
    this.viewerZoom = 1;
    this.loadViewerTextIfNeeded();
  }

  nextAttachment(): void {
    if (this.viewerAttachments.length === 0) {
      return;
    }
    this.viewerIndex = (this.viewerIndex + 1) % this.viewerAttachments.length;
    this.viewerZoom = 1;
    this.loadViewerTextIfNeeded();
  }

  zoomInViewer(): void {
    this.viewerZoom = Math.min(3, this.viewerZoom + 0.2);
  }

  zoomOutViewer(): void {
    this.viewerZoom = Math.max(0.6, this.viewerZoom - 0.2);
  }

  isImageAttachment(att: SponsorEmailAttachment | null): boolean {
    return !!att?.contentType?.startsWith('image/');
  }

  isPdfAttachment(att: SponsorEmailAttachment | null): boolean {
    return att?.contentType === 'application/pdf';
  }

  isTextAttachment(att: SponsorEmailAttachment | null): boolean {
    return !!att?.contentType?.startsWith('text/');
  }

  viewerTransformStyle(): string {
    const att = this.currentViewerAttachment;
    if (this.isPdfAttachment(att)) {
      return 'scale(1)';
    }
    return `scale(${this.viewerZoom})`;
  }

  safeViewerPdfUrl(att: SponsorEmailAttachment | null): SafeResourceUrl | null {
    if (!att?.fileUrl) {
      return null;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(att.fileUrl);
  }

  directionLabel(direction: string | undefined): string {
    if ((direction || '').toUpperCase() === 'INBOUND') {
      return 'Inbound';
    }
    if ((direction || '').toUpperCase() === 'REPLY') {
      return 'Reply';
    }
    return 'Outbound';
  }

  private loadSponsorEmails(sponsorId: number): void {
    this.emailsLoading = true;
    this.emailsError = '';
    this.emailsSyncing = true;

    // Show cached DB emails first, then refresh in background after mailbox sync.
    this.fetchSponsorEmails(sponsorId);

    this.sponsorService.syncInboundEmails().subscribe({
      next: (synced) => {
        this.emailsSyncing = false;
        if (synced && synced.length > 0) {
          this.fetchSponsorEmails(sponsorId);
        }
      },
      error: (err: unknown) => {
        this.emailsSyncing = false;
        const reason = this.resolveError(err, 'Inbox sync failed.');
        this.showToast(`Inbox sync failed: ${reason}`, 'info');
      }
    });
  }

  private fetchSponsorEmails(sponsorId: number): void {
    const previouslySelectedId = this.selectedEmail?.id;

    this.sponsorService.getEmails(sponsorId).subscribe({
      next: (emails) => {
        this.sponsorEmails = emails;
        this.selectedEmail = emails.find(email => email.id === previouslySelectedId) || (emails.length > 0 ? emails[0] : null);
        this.emailsLoading = false;
      },
      error: (err: unknown) => {
        this.sponsorEmails = [];
        this.selectedEmail = null;
        this.emailsLoading = false;
        this.emailsError = this.resolveError(err, 'Failed to load emails.');
      }
    });
  }

  onLogoFileSelected(mode: 'add' | 'edit', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const preview = String(reader.result || '');
      if (mode === 'add') {
        this.selectedAddLogoFile = file;
        this.addLogoPreview = preview;
      } else {
        this.selectedEditLogoFile = file;
        this.editLogoPreview = preview;
      }
    };
    reader.readAsDataURL(file);
  }

  formatJoinDate(sponsor: Sponsor): string {
    if ((sponsor.status || '').toUpperCase() !== 'CONFIRMED' || !sponsor.joinDate) {
      return '--';
    }
    return sponsor.joinDate;
  }

  onPhoneDigitsInput(mode: 'add' | 'edit', value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (mode === 'add') {
      this.addPhoneDigits = digits;
    } else {
      this.editPhoneDigits = digits;
    }
  }

  private buildFullPhone(code: string, digits: string): string {
    return `${code}${digits}`;
  }

  private splitPhone(phone: string): { code: string; local: string } {
    const normalized = (phone || '').replace(/\s+/g, '');
    const sortedCodes = [...this.countryCodeOptions].sort((a, b) => b.code.length - a.code.length);
    for (const option of sortedCodes) {
      if (normalized.startsWith(option.code)) {
        return {
          code: option.code,
          local: normalized.slice(option.code.length).replace(/\D/g, '').slice(0, 8)
        };
      }
    }
    return {
      code: '+216',
      local: normalized.replace(/^\+/, '').replace(/\D/g, '').slice(0, 8)
    };
  }

  private extractValidFiles(event: Event): File[] {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    const valid: File[] = [];

    for (const file of files) {
      const validation = this.sponsorFileUtils.validateFile(file);
      if (validation) {
        this.showToast(validation, 'error');
        continue;
      }
      valid.push(file);
    }

    input.value = '';
    return valid;
  }

  private mergeFiles(existing: File[], incoming: File[]): File[] {
    const merged = [...existing];
    for (const file of incoming) {
      const duplicate = merged.some(f => f.name === file.name && f.size === file.size && f.type === file.type);
      if (!duplicate) {
        merged.push(file);
      }
    }
    return merged;
  }

  private loadViewerTextIfNeeded(): void {
    const attachment = this.currentViewerAttachment;
    if (!this.isTextAttachment(attachment) || !attachment?.fileUrl) {
      this.viewerTextContent = '';
      this.viewerTextLoading = false;
      return;
    }

    this.viewerTextLoading = true;
    fetch(attachment.fileUrl)
      .then(response => response.text())
      .then(text => {
        this.viewerTextContent = text;
        this.viewerTextLoading = false;
      })
      .catch(() => {
        this.viewerTextContent = 'Failed to load text preview.';
        this.viewerTextLoading = false;
      });
  }

  private resolveError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      return typeof err.error === 'string'
        ? err.error
        : (err.error?.message ?? err.message ?? fallback);
    }
    return fallback;
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = true;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
    }, 10000);
  }
}
