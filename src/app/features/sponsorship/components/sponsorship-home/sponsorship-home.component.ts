import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SponsorService, Sponsor, CreateSponsorRequest, UpdateSponsorRequest } from '../../../../core/services/sponsor.service';

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

  constructor(private sponsorService: SponsorService) {}

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

  onExtraAction(sponsor: Sponsor): void {
    this.showToast(`Extra action for ${sponsor.name} is reserved for next step.`, 'info');
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
