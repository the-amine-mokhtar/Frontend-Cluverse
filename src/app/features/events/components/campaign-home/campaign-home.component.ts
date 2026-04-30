import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import {
  FormBuilder, FormGroup, Validators,
  FormControl, AbstractControl, ValidationErrors
} from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { trigger, transition, style, animate } from '@angular/animations';
import { Router } from '@angular/router';
import { CampaignApiService, Participant, Club, CampaignAccess, CampaignPermission, Event as CampaignEvent } from '../../services/campaign-api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CampaignStatus     = 'PLANNED' | 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'ARCHIVED' | 'FINISHED' | 'CANCELLED';
export type CampaignVisibility = 'PUBLIC' | 'SHARED' | 'PRIVATE';
export type ViewMode           = 'list' | 'form' | 'detail' | 'dashboard';

export interface Campaign {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  targetAudience?: string;
  visibility: CampaignVisibility;
  status: CampaignStatus;
  maxParticipants?: number;
  currentParticipants: number;
  eventsCount?: number;
  views: number;
  featured: boolean;
  createdAt: string;
  ownerClubId?: number;
  ownerClubName?: string;
  events?: any[];
  canAddEvent?: boolean;
}

export interface WizardStep {
  id: number;
  name: string;
  sub: string;
  icon: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-campaign-home',
  templateUrl: './campaign-home.component.html',
  styleUrls: ['./campaign-home.component.scss'],
  animations: [
    trigger('stepSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(20px)' }),
        animate('220ms cubic-bezier(0.4,0,0.2,1)',
          style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
      transition(':leave', [
        animate('160ms cubic-bezier(0.4,0,0.2,1)',
          style({ opacity: 0, transform: 'translateX(-20px)' })),
      ]),
    ]),
  ],
})
export class CampaignHomeComponent implements OnInit, OnDestroy {

  // ── Permissions ──────────────────────────────────────────────
  isAdmin = false;

  campaignPermissions: CampaignAccess[] = [];
  permissionsLoading = false;
  showPermissionsPanel = false;
  permissionsOptions: CampaignPermission[] = ['VIEW', 'ADD_EVENT', 'MANAGE'];

  allClubs: Club[] = [];
  allClubsLoading = false;
  clubSearchControl = new FormControl('');
  filteredClubs: Club[] = [];
  selectedClubForPermission: Club | null = null;
  pendingPermissions: Set<CampaignPermission> = new Set(['VIEW']);

  // ── Status change ────────────────────────────────────────────
  openStatusDropdownId: number | null = null;

  readonly changeableStatuses: Array<{ value: CampaignStatus; label: string; icon: string; color: string }> = [
    { value: 'PLANNED',   label: 'Planifiée',   icon: 'schedule',      color: '#d97706' },
    { value: 'ACTIVE',    label: 'Active',       icon: 'play_circle',   color: '#059669' },
    { value: 'LOCKED',    label: 'Verrouillée',  icon: 'lock',          color: '#ea580c' },
    { value: 'DISABLED',  label: 'Désactivée',   icon: 'block',         color: '#dc2626' },
    { value: 'ARCHIVED',  label: 'Archivée',     icon: 'archive',       color: '#607d8b' },
    { value: 'FINISHED',  label: 'Terminée',     icon: 'check_circle',  color: '#7c3aed' },
    { value: 'CANCELLED', label: 'Annulée',      icon: 'cancel',        color: '#9e9e9e' },
  ];

  // ── View state ───────────────────────────────────────────────
  viewMode: ViewMode = 'list';
  selectedCampaign: Campaign | undefined;
  detailTab: 'overview' | 'events' | 'participants' = 'overview';

  // ── List state ───────────────────────────────────────────────
  campaigns: Campaign[] = [];
  filteredCampaigns: Campaign[] = [];
  isLoading = false;
  activeFilter: CampaignStatus | 'ALL' | 'FEATURED' = 'ALL';
  searchControl = new FormControl('');

  readonly filters: { label: string; value: CampaignStatus | 'ALL' | 'FEATURED' }[] = [
    { label: 'All',       value: 'ALL'       },
    { label: 'Active',    value: 'ACTIVE'    },
    { label: 'Planned',   value: 'PLANNED'   },
    { label: 'Finished',  value: 'FINISHED'  },
    { label: 'Cancelled', value: 'CANCELLED' },
    { label: 'Featured',  value: 'FEATURED'  },
  ];

  // ── Wizard state ─────────────────────────────────────────────
  currentStep = 0;
  isSaving    = false;
  isEditMode  = false;
  imagePreviewUrl = '';
  imageError      = false;
  selectedFile: File | null = null;

  readonly wizardSteps: WizardStep[] = [
    { id: 0, name: 'Identity',      sub: 'Title, description',  icon: 'badge'        },
    { id: 1, name: 'Visual',        sub: 'Cover image',         icon: 'image'        },
    { id: 2, name: 'Dates & Setup', sub: 'Schedule, capacity',  icon: 'event'        },
    { id: 3, name: 'Summary',       sub: 'Final review',        icon: 'check_circle' },
  ];

  private readonly stepFields: string[][] = [
    ['title', 'description'],
    [],
    ['startDate', 'endDate'],
    [],
  ];

  readonly statusOptions: Array<{
    value: CampaignStatus; label: string; sub: string; dotClass: string
  }> = [
    { value: 'ACTIVE',    label: 'Active',    sub: 'Ongoing',  dotClass: 'dot-active'    },
    { value: 'PLANNED',   label: 'Planned',   sub: 'Upcoming', dotClass: 'dot-planned'   },
    { value: 'FINISHED',  label: 'Finished',  sub: 'Past',     dotClass: 'dot-finished'  },
    { value: 'CANCELLED', label: 'Cancelled', sub: 'Stopped',  dotClass: 'dot-cancelled' },
  ];

  // ── Delete Modal state ───────────────────────────────────────
  showDeleteModal = false;
  selectedCampaignToDelete: Campaign | undefined;

  readonly visibilityOptions: Array<{
    value: CampaignVisibility; label: string; icon: string; hint: string;
  }> = [
    { value: 'PUBLIC',  label: 'Public',  icon: 'public', hint: 'Visible to all clubs' },
    { value: 'SHARED',  label: 'Shared',  icon: 'group',  hint: 'Controlled via permissions' },
    { value: 'PRIVATE', label: 'Private', icon: 'lock',   hint: 'Owner club only' },
  ];

  // ── Form ─────────────────────────────────────────────────────
  campaignForm!: FormGroup;

  // ── Detail state ─────────────────────────────────────────────
  participants: Participant[] = [];
  isParticipantsLoading = false;
  isRegistered  = false;
  isRegistering = false;

  // ── Detail — Events tab ──────────────────────────────────────
  campaignEvents: CampaignEvent[] = [];
  isEventsLoading = false;

  // ── Dashboard state ──────────────────────────────────────────
  dashStats = {
    totalCampaigns:    0,
    activeCampaigns:   0,
    totalParticipants: 0,
    totalViews:        0,
    byStatus: { PLANNED: 0, ACTIVE: 0, FINISHED: 0, CANCELLED: 0 } as Record<string, number>,
  };
  topCampaigns: Campaign[] = [];
  topCampaignsLoading = false;
  private viewedCampaignIds = new Set<number>();

  readonly statusBreakdown: {
    label: string; key: CampaignStatus; cls: string; icon: string
  }[] = [
    { label: 'Active',    key: 'ACTIVE',    cls: 'bar-active',    icon: 'play_circle'  },
    { label: 'Planned',   key: 'PLANNED',   cls: 'bar-planned',   icon: 'schedule'     },
    { label: 'Finished',  key: 'FINISHED',  cls: 'bar-finished',  icon: 'check_circle' },
    { label: 'Cancelled', key: 'CANCELLED', cls: 'bar-cancelled', icon: 'cancel'       },
  ];

  private destroy$ = new Subject<void>();
  private draftData: any = null;

  constructor(
    private fb: FormBuilder,
    private campaignApi: CampaignApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router,
    private authHelper: AuthHelperService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────

  ngOnInit(): void {
    this.isAdmin = this.authHelper.getRole() === 'SUPER_ADMIN' || this.authHelper.getRole() === 'PRESIDENT';
    this.buildForm();
    this.loadCampaigns();
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilter());

    this.clubSearchControl.valueChanges
      .pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe(q => this.filterClubs(q ?? ''));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Form builder ─────────────────────────────────────────────

  private buildForm(): void {
    this.campaignForm = this.fb.group(
      {
        title:              ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
        description:        ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
        targetAudience:     [''],
        imageUrl:           [''],
        visibility:         ['SHARED', Validators.required],
        startDate:          ['', [Validators.required, this.minDateValidator()]],
        startTime:          ['09:00'],
        endDate:            ['', Validators.required],
        endTime:            ['17:00'],
        capacity:           [null, [Validators.min(1)]],
        featured:           [false],
        publicRegistration: [true],
      },
      { validators: this.dateRangeValidator },
    );

    this.campaignForm.get('imageUrl')!.valueChanges
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(url => {
        if (url && !this.selectedFile) {
          this.imagePreviewUrl = url ?? '';
          this.imageError = false;
        }
      });
  }

  private minDateValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      try {
        const selectedDate = new Date(control.value + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate < today ? { minDate: true } : null;
      } catch { return null; }
    };
  }

  private dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const start = group.get('startDate')?.value;
    const end   = group.get('endDate')?.value;
    if (start && end) {
      try {
        if (new Date(end + 'T00:00:00') <= new Date(start + 'T00:00:00')) return { dateRange: true };
      } catch { return null; }
    }
    return null;
  }

  get f() { return this.campaignForm.controls; }

  // ── Data loading ─────────────────────────────────────────────

  loadCampaigns(): void {
    this.isLoading = true;
    this.campaignApi.getAllCampaigns().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Campaign[]) => {
        this.campaigns = data;
        this.applyFilter();
        this.computeDashStats();
        this.isLoading = false;
      },
      error: (err) => {
        this.snackBar.open('Error loading campaigns: ' + (err.status || 'Unknown'), 'Close', { duration: 3000 });
        this.isLoading = false;
      },
    });
  }

  // ── Navigation views ─────────────────────────────────────────

  showList(): void {
    this.viewMode         = 'list';
    this.selectedCampaign = undefined;
    this.isEditMode       = false;
    this.currentStep      = 0;
    this.showPermissionsPanel = false;
    this.openStatusDropdownId = null;
  }

  showCreate(): void {
    this.isEditMode       = false;
    this.selectedCampaign = undefined;
    this.currentStep      = 0;
    this.imagePreviewUrl  = '';
    this.imageError       = false;
    this.selectedFile     = null;
    this.campaignForm.reset({
      featured: false, publicRegistration: true, visibility: 'SHARED',
      capacity: null, startTime: '09:00', endTime: '17:00'
    });
    this.viewMode = 'form';
  }

  showEdit(campaign: Campaign): void {
    this.isEditMode       = true;
    this.selectedCampaign = campaign;
    this.currentStep      = 0;
    this.imagePreviewUrl  = campaign.imageUrl ?? '';
    this.imageError       = false;
    this.selectedFile     = null;
    this.campaignForm.patchValue({
      title: campaign.title, description: campaign.description,
      targetAudience: campaign.targetAudience ?? '', imageUrl: campaign.imageUrl ?? '',
      visibility: campaign.visibility ?? 'SHARED',
      startDate: campaign.startDate?.slice(0, 10) ?? '',
      startTime: campaign.startDate?.slice(11, 16) ?? '09:00',
      endDate: campaign.endDate?.slice(0, 10) ?? '',
      endTime: campaign.endDate?.slice(11, 16) ?? '17:00',
      capacity: campaign.maxParticipants ?? null,
      featured: campaign.featured, publicRegistration: true,
    });
    this.viewMode = 'form';
  }

  showDetail(campaign: Campaign): void {
    this.selectedCampaign = campaign;
    this.detailTab        = 'overview';
    this.participants     = [];
    this.campaignEvents   = [];
    this.isRegistered     = false;
    this.viewMode         = 'detail';
    this.checkRegistration(campaign.id);

    if (this.viewedCampaignIds.has(campaign.id)) {
      return;
    }

    this.campaignApi.recordCampaignView(campaign.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.viewedCampaignIds.add(campaign.id);
          this.selectedCampaign = { ...this.selectedCampaign!, views: updated.views };
          const idx = this.campaigns.findIndex(c => c.id === campaign.id);
          if (idx !== -1) this.campaigns[idx] = { ...this.campaigns[idx], views: updated.views };
          this.applyFilter();
        },
        error: () => {}
      });
  }

  showDashboard(): void {
    this.computeDashStats();
    this.viewMode = 'dashboard';
    this.loadTop5FromBackend();
  }

  private loadTop5FromBackend(): void {
    this.topCampaignsLoading = true;
    this.campaignApi.getTop5Campaigns().pipe(takeUntil(this.destroy$)).subscribe({
      next: (top5) => { this.topCampaigns = top5; this.topCampaignsLoading = false; },
      error: () => {
        this.topCampaigns = [...this.campaigns]
          .sort((a, b) => {
            const eventsDiff = (b.eventsCount ?? 0) - (a.eventsCount ?? 0);
            if (eventsDiff !== 0) return eventsDiff;

            const participantsDiff = (b.currentParticipants ?? 0) - (a.currentParticipants ?? 0);
            if (participantsDiff !== 0) return participantsDiff;

            const viewsDiff = (b.views ?? 0) - (a.views ?? 0);
            if (viewsDiff !== 0) return viewsDiff;

            return (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER);
          }).slice(0, 5);
        this.topCampaignsLoading = false;
      }
    });
  }

  setDetailTab(tab: 'overview' | 'events' | 'participants'): void {
    this.detailTab = tab;
    if (tab === 'participants' && this.selectedCampaign) {
      this.loadParticipants(this.selectedCampaign.id);
    }
    if (tab === 'events' && this.selectedCampaign) {
      this.loadCampaignEvents(this.selectedCampaign.id);
    }
  }

  // ── Campaign Events (detail tab) ─────────────────────────────

  loadCampaignEvents(campaignId: number): void {
    this.isEventsLoading = true;
    this.campaignApi.getCampaignEvents(campaignId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (events) => {
        this.campaignEvents  = events;
        this.isEventsLoading = false;
      },
      error: () => {
        this.campaignEvents  = [];
        this.isEventsLoading = false;
        this.snackBar.open('Erreur lors du chargement des événements', 'Fermer', { duration: 3000 });
      }
    });
  }

  // ── Status change ─────────────────────────────────────────────

  toggleStatusDropdown(event: Event, campaignId: number): void {
    event.stopPropagation();
    this.openStatusDropdownId = this.openStatusDropdownId === campaignId ? null : campaignId;
  }

  closeStatusDropdown(): void {
    this.openStatusDropdownId = null;
  }

  changeStatus(event: Event, campaign: Campaign, newStatus: CampaignStatus): void {
    event.stopPropagation();
    this.openStatusDropdownId = null;

    if (campaign.status === newStatus) return;

    if (newStatus === 'LOCKED') {
      this.snackBar.open('Le statut VERROUILLÉE est géré automatiquement.', 'Fermer', { duration: 3000 });
      return;
    }

    this.campaignApi.updateCampaignStatus(campaign.id, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const label = this.changeableStatuses.find(s => s.value === newStatus)?.label ?? newStatus;
        this.snackBar.open(`Statut changé → ${label}`, 'Fermer', { duration: 2500 });
        const idx = this.campaigns.findIndex(c => c.id === campaign.id);
        if (idx !== -1) this.campaigns[idx] = { ...this.campaigns[idx], status: newStatus };
        if (this.selectedCampaign?.id === campaign.id) {
          this.selectedCampaign = { ...this.selectedCampaign, status: newStatus };
        }
        this.applyFilter();
        this.computeDashStats();
      },
      error: (err) => {
        this.snackBar.open('Erreur lors du changement de statut: ' + (err?.error?.message || 'Inconnu'), 'Fermer', { duration: 4000 });
      }
    });
  }

  canChangeStatus(campaign: Campaign): boolean {
    return this.isAdmin && campaign.status !== 'LOCKED';
  }

  // ── Wizard navigation ────────────────────────────────────────

  get progressPercent(): number {
    return Math.round(((this.currentStep + 1) / this.wizardSteps.length) * 100);
  }

  isStepDone(idx: number): boolean      { return idx < this.currentStep; }
  isStepActive(idx: number): boolean    { return idx === this.currentStep; }
  isStepClickable(idx: number): boolean { return idx < this.currentStep; }

  private isCurrentStepValid(): boolean {
    const fields = this.stepFields[this.currentStep];
    if (!fields.length) return true;
    return fields.every(name => {
      const ctrl = this.campaignForm.get(name);
      return ctrl ? ctrl.valid : true;
    });
  }

  isCurrentStepValidForUI(): boolean { return this.isCurrentStepValid(); }

  saveDraft(): void {
    try {
      this.draftData = {
        formValue: this.campaignForm.value, editMode: this.isEditMode,
        campaignId: this.selectedCampaign?.id ?? null, savedAt: new Date().toISOString(),
      };
      this.snackBar.open('Draft saved (session)', 'Close', { duration: 2500 });
    } catch {
      this.snackBar.open('Could not save draft', 'Close', { duration: 3000 });
    }
  }

  restoreDraft(): void {
    if (!this.draftData) { this.snackBar.open('No draft available', 'Close', { duration: 2500 }); return; }
    this.campaignForm.patchValue(this.draftData.formValue);
    this.snackBar.open('Draft restored', 'Close', { duration: 2500 });
  }

  clearDraft(): void { this.draftData = null; }

  private markCurrentStepTouched(): void {
    this.stepFields[this.currentStep].forEach(name => this.campaignForm.get(name)?.markAsTouched());
  }

  goNext(): void {
    if (this.currentStep === this.wizardSteps.length - 1) { this.onSubmit(); return; }
    this.markCurrentStepTouched();
    if (!this.isCurrentStepValid()) {
      const invalid = this.stepFields[this.currentStep].filter(n => this.campaignForm.get(n)?.invalid);
      if (invalid.length) this.snackBar.open(`Please fill in: ${invalid.join(', ')}`, 'Close', { duration: 3000 });
      return;
    }
    this.currentStep++;
  }

  goBack(): void { if (this.currentStep > 0) this.currentStep--; }
  jumpToStep(idx: number): void { if (this.isStepClickable(idx)) this.currentStep = idx; }

  // ── File upload ──────────────────────────────────────────────

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { this.snackBar.open('Image too large (max 5 MB)', 'Close', { duration: 3000 }); return; }
    if (!file.type.startsWith('image/')) { this.snackBar.open('Unsupported format', 'Close', { duration: 3000 }); return; }
    this.selectedFile = file;
    this.imageError   = false;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreviewUrl = e.target?.result as string;
      this.campaignForm.get('imageUrl')!.setValue(this.imagePreviewUrl);
    };
    reader.readAsDataURL(file);
  }

  onImageError(): void { this.imageError = true; }

  // ── Filter ───────────────────────────────────────────────────

  setFilter(value: CampaignStatus | 'ALL' | 'FEATURED'): void { this.activeFilter = value; this.applyFilter(); }

  applyFilter(): void {
    const query = (this.searchControl.value ?? '').toLowerCase();
    this.filteredCampaigns = this.campaigns.filter(c => {
      const matchSearch  = !query || c.title.toLowerCase().includes(query) || (c.description && c.description.toLowerCase().includes(query));
      const matchFilter  = this.activeFilter === 'ALL' || (this.activeFilter === 'FEATURED' ? c.featured : c.status === this.activeFilter);
      return matchSearch && matchFilter;
    });
  }

  // ── CRUD ─────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.campaignForm.invalid) {
      this.campaignForm.markAllAsTouched();
      this.snackBar.open('Please fill all fields correctly', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formData = this.campaignForm.value;

    const startDateStr: string = formData.startDate instanceof Date
      ? formData.startDate.toISOString().split('T')[0] : formData.startDate;
    const endDateStr: string = formData.endDate instanceof Date
      ? formData.endDate.toISOString().split('T')[0] : formData.endDate;

    const payload = {
      title: formData.title, description: formData.description,
      targetAudience: formData.targetAudience || '',
      visibility: formData.visibility || 'SHARED',
      startDate: `${startDateStr}T${formData.startTime || '09:00'}:00`,
      endDate: `${endDateStr}T${formData.endTime || '17:00'}:00`,
      maxParticipants: formData.capacity || null,
      featured: formData.featured,
    };

    const request$ = this.isEditMode && this.selectedCampaign
      ? this.campaignApi.updateCampaign(this.selectedCampaign.id, payload, this.selectedFile)
      : this.campaignApi.createCampaign(payload, this.selectedFile);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open(this.isEditMode ? 'Campaign updated!' : 'Campaign created!', 'Close', { duration: 3000 });
        this.clearDraft(); this.loadCampaigns(); this.showList(); this.isSaving = false;
      },
      error: (err) => {
        this.snackBar.open('Error saving campaign', 'Close', { duration: 3000 });
        this.isSaving = false;
      },
    });
  }

  // ── Delete ───────────────────────────────────────────────────

  deleteCampaign(event: Event, campaign: Campaign): void {
    event.stopPropagation();
    this.openDeleteModal(campaign);
  }

  public openDeleteModal(campaign: Campaign): void {
    this.selectedCampaignToDelete = campaign;
    this.showDeleteModal = true;
  }

  public closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedCampaignToDelete = undefined;
  }

  public confirmDelete(): void {
    if (!this.selectedCampaignToDelete) return;
    const campaign = this.selectedCampaignToDelete;
    this.closeDeleteModal();

    // New system: Cancel campaign (set status to CANCELLED)
    this.campaignApi.cancelCampaign(campaign.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedCampaign) => {
          // Update campaign status to CANCELLED
          const idx = this.campaigns.findIndex(c => c.id === campaign.id);
          if (idx >= 0) {
            this.campaigns[idx].status = updatedCampaign?.status ?? 'CANCELLED';
            if (this.selectedCampaign?.id === campaign.id) {
              this.selectedCampaign.status = updatedCampaign?.status ?? 'CANCELLED';
            }
          }
          this.applyFilter();
          this.computeDashStats();
          this.snackBar.open('Campagne annulée. Les notifications email aux Event Managers ont été déclenchées.', 'Fermer', { duration: 4500 });
        },
        error: (err) => {
          console.error('[Campaign Cancel Error]', err);
          const message = err?.error?.message || err?.statusText || 'Erreur lors de l\'annulation';
          this.snackBar.open(`❌ ${message}`, 'Fermer', { duration: 6000, panelClass: ['error-snackbar'] });
        }
      });
  }

  // ── Detail ───────────────────────────────────────────────────

  checkRegistration(id: number): void {
    this.campaignApi.isUserRegistered(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: val => (this.isRegistered = val), error: () => (this.isRegistered = false),
    });
  }

  loadParticipants(id: number): void {
    this.isParticipantsLoading = true;
    this.campaignApi.getCampaignParticipants(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.participants = data; this.isParticipantsLoading = false; },
      error: () => { this.participants = []; this.isParticipantsLoading = false; },
    });
  }

  toggleRegistration(): void {
    if (!this.selectedCampaign) return;
    this.isRegistering = true;
    const action$ = this.isRegistered
      ? this.campaignApi.unregisterFromCampaign(this.selectedCampaign.id)
      : this.campaignApi.registerForCampaign(this.selectedCampaign.id);

    action$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.refreshCampaign(this.selectedCampaign!.id);
        this.isRegistered = !this.isRegistered;
        this.snackBar.open(this.isRegistered ? 'Registered!' : 'Unregistered', 'Close', { duration: 3000 });
        this.isRegistering = false;
      },
      error: () => { this.snackBar.open('Error', 'Close', { duration: 3000 }); this.isRegistering = false; }
    });
  }

  private refreshCampaign(id: number): void {
    this.campaignApi.getCampaignById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.selectedCampaign = updated;
        const index = this.campaigns.findIndex(c => c.id === id);
        if (index !== -1) this.campaigns[index] = { ...this.campaigns[index], currentParticipants: updated.currentParticipants };
        this.applyFilter(); this.computeDashStats();
      }
    });
  }

  addEventToCampaign(campaign: Campaign): void {
    this.router.navigate(['/dashboard/events/create'], { queryParams: { campaignId: campaign.id } });
  }

  // ── Permissions panel ────────────────────────────────────────

  closePanel(): void {
    this.showPermissionsPanel      = false;
    this.selectedClubForPermission = null;
    this.clubSearchControl.setValue('');
    this.filteredClubs             = [];
    this.pendingPermissions        = new Set(['VIEW']);
  }

  togglePermissionsPanel(campaign: Campaign): void {
    if (campaign.visibility !== 'SHARED') {
      this.snackBar.open('Le panneau de permissions est uniquement disponible pour les campagnes SHARED', 'Fermer', { duration: 3000 });
      return;
    }
    if (this.showPermissionsPanel && this.selectedCampaign?.id === campaign.id) {
      this.showPermissionsPanel = false;
      return;
    }
    this.showPermissionsPanel = false;
    this.campaignPermissions  = [];
    this.allClubs             = [];
    this.selectedClubForPermission = null;
    this.pendingPermissions   = new Set(['VIEW']);
    this.clubSearchControl.setValue('');
    this.selectedCampaign     = campaign;

    setTimeout(() => {
      this.showPermissionsPanel = true;
      this.loadCampaignPermissions(campaign.id);
      this.loadAllClubs();
    }, 0);
  }

  canShowPermissionsPanel(campaign: Campaign): boolean {
    return this.isAdmin && campaign.visibility === 'SHARED';
  }

  loadCampaignPermissions(campaignId: number): void {
    if (!this.isAdmin) return;
    this.permissionsLoading = true;
    this.campaignApi.getCampaignPermissions(campaignId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (permissions) => { this.campaignPermissions = permissions; this.permissionsLoading = false; },
      error: () => { this.snackBar.open('Error loading permissions', 'Close', { duration: 3000 }); this.permissionsLoading = false; },
    });
  }

  private loadAllClubs(): void {
    this.allClubsLoading = true;
    this.campaignApi.getAllClubs().pipe(takeUntil(this.destroy$)).subscribe({
      next: (clubs) => { this.allClubs = clubs; this.filteredClubs = clubs; this.allClubsLoading = false; },
      error: () => { this.allClubsLoading = false; }
    });
  }

  filterClubs(query: string): void {
    const q = query.toLowerCase();
    const alreadyGranted = new Set(this.campaignPermissions.map(a => a.clubId));
    this.filteredClubs = this.allClubs.filter(c =>
      !alreadyGranted.has(c.id) &&
      (c.name.toLowerCase().includes(q) || String(c.id).includes(q))
    );
  }

  selectClubForPermission(club: Club): void {
    this.selectedClubForPermission = club;
    this.clubSearchControl.setValue(club.name);
    this.filteredClubs = [];
  }

  get clubsWithoutAccess(): Club[] {
    const alreadyGranted = new Set(this.campaignPermissions.map(a => a.clubId));
    return this.allClubs.filter(c => !alreadyGranted.has(c.id));
  }

  togglePendingPermission(perm: string | CampaignPermission): void {
    const permission = perm as CampaignPermission;
    if (this.pendingPermissions.has(permission)) this.pendingPermissions.delete(permission);
    else this.pendingPermissions.add(permission);
  }

  isPendingPermission(perm: CampaignPermission): boolean { return this.pendingPermissions.has(perm); }

  grantAccessToClub(): void {
    if (!this.selectedClubForPermission || !this.selectedCampaign) {
      this.snackBar.open('Sélectionnez un club', 'Fermer', { duration: 2500 }); return;
    }
    if (this.pendingPermissions.size === 0) {
      this.snackBar.open('Sélectionnez au moins une permission', 'Fermer', { duration: 2500 }); return;
    }

    const clubId     = this.selectedClubForPermission.id;
    const campaignId = this.selectedCampaign.id;
    const perms      = Array.from(this.pendingPermissions) as CampaignPermission[];

    const grantNext = (index: number) => {
      if (index >= perms.length) {
        this.snackBar.open(`Accès accordé à ${this.selectedClubForPermission!.name}`, 'Fermer', { duration: 2500 });
        this.selectedClubForPermission = null;
        this.clubSearchControl.setValue('');
        this.pendingPermissions = new Set(['VIEW']);
        this.loadCampaignPermissions(campaignId);
        this.filterClubs('');
        return;
      }
      this.campaignApi.grantPermission(campaignId, clubId, perms[index]).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => grantNext(index + 1),
        error: (err) => { this.snackBar.open(`Erreur: ${err?.error?.message || 'Inconnu'}`, 'Fermer', { duration: 5000 }); }
      });
    };
    grantNext(0);
  }

  grantPermissionToClub(campaignId: number, clubId: number, permission: string): void {
    this.campaignApi.grantPermission(campaignId, clubId, permission as CampaignPermission).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.snackBar.open(`Permission "${permission}" accordée`, 'Fermer', { duration: 2000 }); this.loadCampaignPermissions(campaignId); },
      error: () => this.snackBar.open('Erreur', 'Fermer', { duration: 3000 }),
    });
  }

  revokePermissionFromClub(campaignId: number, clubId: number, permission: string): void {
    this.campaignApi.revokePermission(campaignId, clubId, permission as CampaignPermission).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.snackBar.open(`Permission "${permission}" révoquée`, 'Fermer', { duration: 2000 }); this.loadCampaignPermissions(campaignId); this.filterClubs(this.clubSearchControl.value ?? ''); },
      error: () => this.snackBar.open('Erreur', 'Fermer', { duration: 3000 }),
    });
  }

  revokeAllFromClub(campaignId: number, access: CampaignAccess): void {
    const dialogRef = this.dialog.open(ConfirmRevokeAllDialog, {
      width: '380px',
      data: { clubName: access.clubName || `Club #${access.clubId}` }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const perms = [...access.permissions] as CampaignPermission[];
      const revokeNext = (index: number) => {
        if (index >= perms.length) {
          this.snackBar.open('Toutes les permissions révoquées', 'Fermer', { duration: 2500 });
          this.loadCampaignPermissions(campaignId);
          this.filterClubs(this.clubSearchControl.value ?? '');
          return;
        }
        this.campaignApi.revokePermission(campaignId, access.clubId, perms[index]).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => revokeNext(index + 1), error: () => revokeNext(index + 1)
        });
      };
      revokeNext(0);
    });
  }

  hasPermission(access: any, permission: string): boolean {
    return Array.isArray(access.permissions) && access.permissions.includes(permission);
  }

  // ── Dashboard ────────────────────────────────────────────────

  computeDashStats(): void {
    if (!this.campaigns) return;
    this.dashStats.totalCampaigns    = this.campaigns.length;
    this.dashStats.activeCampaigns   = this.campaigns.filter(c => c.status === 'ACTIVE').length;
    this.dashStats.totalParticipants = this.campaigns.reduce((s, c) => s + (c.currentParticipants || 0), 0);
    this.dashStats.totalViews        = this.campaigns.reduce((s, c) => s + (c.views || 0), 0);
    (['PLANNED', 'ACTIVE', 'FINISHED', 'CANCELLED'] as CampaignStatus[]).forEach(s => {
      this.dashStats.byStatus[s] = this.campaigns.filter(c => c.status === s).length;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────

  getVisibilityClass(visibility: string): string {
    const map: Record<string, string> = {
      PUBLIC:  'ch-badge--public',
      PRIVATE: 'ch-badge--private',
      SHARED:  'ch-badge--shared',
    };
    return map[visibility] ?? '';
  }

  /** Alias used by HTML template (getVisibilityBadgeClass → getVisibilityClass) */
  getVisibilityBadgeClass(visibility: string): string {
    return this.getVisibilityClass(visibility);
  }

  getVisibilityIcon(visibility: string): string {
    return ({ PRIVATE: 'lock', SHARED: 'group', PUBLIC: 'public' } as Record<string, string>)[visibility] ?? 'public';
  }

  getVisibilityLabel(visibility: string): string {
    return ({ PRIVATE: 'Private', SHARED: 'Shared', PUBLIC: 'Public' } as Record<string, string>)[visibility] ?? 'Public';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE:    'ch-badge--active',
      PLANNED:   'ch-badge--draft',
      DISABLED:  'ch-badge--draft',
      ARCHIVED:  'ch-badge--archived',
      LOCKED:    'ch-badge--locked',
      FINISHED:  'ch-badge--archived',
      CANCELLED: 'ch-badge--cancelled',
    };
    return map[status] ?? '';
  }

  /** Alias used by HTML template (getStatusBadgeClass → getStatusClass) */
  getStatusBadgeClass(status: string): string {
    return this.getStatusClass(status);
  }

  getStatusLabel(status: CampaignStatus): string {
    const map: Record<CampaignStatus, string> = {
      ACTIVE: 'Active', PLANNED: 'Planifiée', LOCKED: 'Verrouillée',
      DISABLED: 'Désactivée', ARCHIVED: 'Archivée', FINISHED: 'Terminée', CANCELLED: 'Annulée',
    };
    return map[status] ?? status;
  }

  getStatusIcon(status: CampaignStatus): string {
    const map: Record<CampaignStatus, string> = {
      ACTIVE: 'play_circle', PLANNED: 'schedule', LOCKED: 'lock',
      DISABLED: 'block', ARCHIVED: 'archive', FINISHED: 'check_circle', CANCELLED: 'cancel',
    };
    return map[status] ?? 'help';
  }

  getEventStatusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'status-active', PLANNED: 'status-planned',
      FINISHED: 'status-finished', CANCELLED: 'status-cancelled',
    };
    return map[status] ?? 'status-planned';
  }

  getEventStatusLabel(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'Active', PLANNED: 'Planifié', FINISHED: 'Terminé', CANCELLED: 'Annulé',
    };
    return map[status] ?? status;
  }

  getCapacityPercent(c: Campaign): number {
    if (!c.maxParticipants) return 0;
    return Math.min(100, Math.round((c.currentParticipants / c.maxParticipants) * 100));
  }

  getEventCapacityPercent(evt: CampaignEvent): number {
    if (!evt.capacity) return 0;
    return Math.min(100, Math.round((evt.currentParticipants / evt.capacity) * 100));
  }

  getEngagementRate(c: Campaign): number {
    if (!c.maxParticipants) return 0;
    return Math.round((c.currentParticipants / c.maxParticipants) * 100);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getStatusBarWidth(status: string): number {
    if (!this.dashStats.totalCampaigns) return 0;
    return Math.round((this.dashStats.byStatus[status as CampaignStatus] / this.dashStats.totalCampaigns) * 100);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
      .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatDateTime(dateStr: string, timeStr: string): string {
    if (!dateStr) return '—';
    const time = timeStr || '00:00';
    return new Date(`${dateStr}T${time}`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      + ' à ' + time;
  }

  get previewCampaign(): Campaign {
    const v = this.campaignForm.value;
    let status: CampaignStatus = 'PLANNED';
    if (v.startDate && v.endDate) {
      const now = new Date();
      const s   = new Date(v.startDate + 'T00:00:00');
      const e   = new Date(v.endDate   + 'T00:00:00');
      if (e < now) status = 'FINISHED';
      else if (s <= now && e >= now) status = 'ACTIVE';
    }
    return {
      id: this.selectedCampaign?.id || 0, title: v.title || 'Campaign Title',
      description: v.description || 'Description…',
      startDate: v.startDate || new Date().toISOString().split('T')[0],
      endDate: v.endDate || new Date().toISOString().split('T')[0],
      imageUrl: v.imageUrl, targetAudience: v.targetAudience,
      visibility: v.visibility || 'SHARED', status,
      maxParticipants: v.maxParticipants,
      currentParticipants: this.selectedCampaign?.currentParticipants || 0,
      views: this.selectedCampaign?.views || 0,
      featured: v.featured || false, createdAt: this.selectedCampaign?.createdAt || new Date().toISOString(),
      events: this.selectedCampaign?.events || [],
    };
  }

  trackById(_: number, item: Campaign): number        { return item.id; }
  trackByStepId(_: number, s: WizardStep): number     { return s.id; }
  trackByValue(_: number, o: any): string             { return o.value; }
  trackByClubId(_: number, c: Club): number           { return c.id; }
  trackByEventId(_: number, e: CampaignEvent): number { return e.id; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRM DELETE DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-confirm-delete-campaign-dialog',
  template: `
    <div class="confirm-delete-wrapper">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon class="icon-warning">warning</mat-icon>Supprimer la campagne
      </h2>
      <mat-dialog-content class="dialog-content">
        <p class="campaign-title">"{{ data.campaign.title }}"</p>
        
        <div class="impact-section" *ngIf="data.campaign.eventsCount || data.campaign.currentParticipants">
          <div class="impact-header">
            <mat-icon>info</mat-icon>
            <span>Impact de cette suppression</span>
          </div>
          
          <div class="impact-item" *ngIf="data.campaign.eventsCount">
            <mat-icon>event</mat-icon>
            <span class="label">Événements liés:</span>
            <span class="value">{{ data.campaign.eventsCount }}</span>
          </div>
          
          <div class="impact-item" *ngIf="data.campaign.currentParticipants">
            <mat-icon>people</mat-icon>
            <span class="label">Participants inscrits:</span>
            <span class="value">{{ data.campaign.currentParticipants }}</span>
          </div>
        </div>

        <div class="warning-section" *ngIf="data.campaign.visibility === 'SHARED'">
          <mat-icon class="icon-shared">share</mat-icon>
          <div class="warning-content">
            <strong>Campagne SHARED</strong>
            <p>Tous les clubs avec des permissions perdront l'accès.</p>
          </div>
        </div>

        <div class="smart-delete-info">
          <mat-icon>smart_toy</mat-icon>
          <div class="info-content">
            <strong>Suppression intelligente</strong>
            <p>La suppression analysera automatiquement les dépendances et décidera de :</p>
            <ul>
              <li><strong>SUPPRIMER</strong> — Si aucune dépendance n'est détectée</li>
              <li><strong>ARCHIVER</strong> — Pour préserver l'historique</li>
              <li><strong>VERROUILLER</strong> — Si des participants actifs sont détectés</li>
            </ul>
          </div>
        </div>

        <p class="critical-warning">
          <mat-icon>error_outline</mat-icon>
          Cette action est irréversible.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Annuler</button>
        <button mat-raised-button color="warn" (click)="onConfirm()" class="delete-btn">
          <mat-icon>delete_outline</mat-icon>Confirmer la suppression
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-delete-wrapper {
      min-width: 420px;
    }

    .dialog-title {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #d32f2f;
      margin: 0;
    }

    .icon-warning {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #d32f2f;
    }

    .dialog-content {
      padding: 16px 0;
    }

    .campaign-title {
      font-size: 18px;
      font-weight: 500;
      margin: 0 0 16px 0;
      word-break: break-word;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
      border-left: 4px solid #1976d2;
    }

    .impact-section {
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .impact-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #e65100;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .impact-header mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .impact-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
      font-size: 14px;
    }

    .impact-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #555;
      flex-shrink: 0;
    }

    .impact-item .label {
      color: #666;
      font-weight: 500;
    }

    .impact-item .value {
      color: #333;
      font-weight: 600;
      margin-left: auto;
    }

    .warning-section {
      display: flex;
      gap: 12px;
      background: #ffebee;
      padding: 12px;
      border-left: 4px solid #d32f2f;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .icon-shared {
      color: #d32f2f;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .warning-content strong {
      display: block;
      margin-bottom: 4px;
      color: #d32f2f;
    }

    .warning-content p {
      margin: 0;
      font-size: 14px;
      color: #555;
    }

    .smart-delete-info {
      display: flex;
      gap: 12px;
      background: #e3f2fd;
      padding: 12px;
      border-left: 4px solid #1976d2;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .smart-delete-info mat-icon {
      color: #1976d2;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .info-content strong {
      display: block;
      margin-bottom: 6px;
      color: #1565c0;
    }

    .info-content p {
      margin: 6px 0;
      font-size: 13px;
      color: #555;
    }

    .info-content ul {
      margin: 6px 0 0 0;
      padding-left: 18px;
      font-size: 13px;
    }

    .info-content li {
      margin: 4px 0;
      color: #555;
    }

    .critical-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d32f2f;
      font-weight: 600;
      margin: 0;
      padding: 8px;
      background: #ffebee;
      border-radius: 4px;
    }

    .critical-warning mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

   mat-dialog-actions {
    gap: 8px;
    margin-top: 24px;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  `]
})
export class ConfirmDeleteCampaignDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { campaign: Campaign },
    public dialogRef: MatDialogRef<ConfirmDeleteCampaignDialog>
  ) {}

  onCancel(): void  { this.dialogRef.close(false); }
  onConfirm(): void { this.dialogRef.close(true);  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRM REVOKE ALL DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-confirm-revoke-all-dialog',
  template: `
    <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px;color:#d32f2f;">
      <mat-icon>person_remove</mat-icon>Révoquer tous les accès
    </h2>
    <mat-dialog-content>
      <p>Supprimer tous les accès pour <strong>{{ data.clubName }}</strong> ?</p>
      <p style="font-size:13px;color:#666;">Cette action révoquera toutes les permissions de ce club sur la campagne.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">Annuler</button>
      <button mat-raised-button color="warn" (click)="dialogRef.close(true)">
        <mat-icon>person_remove</mat-icon>Révoquer
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmRevokeAllDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { clubName: string },
    public dialogRef: MatDialogRef<ConfirmRevokeAllDialog>
  ) {}
}
