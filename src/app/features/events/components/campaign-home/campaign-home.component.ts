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
import { CampaignApiService, Participant, Club, CampaignAccess, CampaignPermission } from '../../services/campaign-api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
// ─── Types ───────────────────────────────────────────────────────────────────

export type CampaignStatus     = 'PLANNED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
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

  // Existing permissions on selected campaign
  campaignPermissions: CampaignAccess[] = [];
  permissionsLoading = false;
  showPermissionsPanel = false;
  permissionsOptions: CampaignPermission[] = ['VIEW', 'ADD_EVENT', 'MANAGE'];

  // All clubs for the "add club" selector
  allClubs: Club[] = [];
  allClubsLoading = false;
  clubSearchControl = new FormControl('');
  filteredClubs: Club[] = [];
  selectedClubForPermission: Club | null = null;
  pendingPermissions: Set<CampaignPermission> = new Set(['VIEW']);

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
    { value: 'ACTIVE',    label: 'Active',    sub: 'Ongoing', dotClass: 'dot-active'    },
    { value: 'PLANNED',   label: 'Planned',   sub: 'Upcoming', dotClass: 'dot-planned'  },
    { value: 'FINISHED',  label: 'Finished',  sub: 'Past',    dotClass: 'dot-finished'  },
    { value: 'CANCELLED', label: 'Cancelled', sub: 'Stopped', dotClass: 'dot-cancelled' },
  ];

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

    // Filter clubs in the permission search box
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
      } catch {
        return null;
      }
    };
  }

  private dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const start = group.get('startDate')?.value;
    const end   = group.get('endDate')?.value;
    if (start && end) {
      try {
        const startDate = new Date(start + 'T00:00:00');
        const endDate   = new Date(end   + 'T00:00:00');
        if (endDate <= startDate) return { dateRange: true };
      } catch {
        return null;
      }
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
        console.error('Error loading campaigns:', err);
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
  }

  showCreate(): void {
    this.isEditMode         = false;
    this.selectedCampaign   = undefined;
    this.currentStep        = 0;
    this.imagePreviewUrl    = '';
    this.imageError         = false;
    this.selectedFile       = null;
    this.campaignForm.reset({
      featured: false,
      publicRegistration: true,
      visibility: 'SHARED',
      capacity: null,
      startTime: '09:00',
      endTime: '17:00'
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
      title:              campaign.title,
      description:        campaign.description,
      targetAudience:     campaign.targetAudience ?? '',
      imageUrl:           campaign.imageUrl ?? '',
      visibility:         campaign.visibility ?? 'SHARED',
      startDate:          campaign.startDate?.slice(0, 10) ?? '',
      startTime:          campaign.startDate?.slice(11, 16) ?? '09:00',
      endDate:            campaign.endDate?.slice(0, 10) ?? '',
      endTime:            campaign.endDate?.slice(11, 16) ?? '17:00',
      capacity:           campaign.maxParticipants ?? null,
      featured:           campaign.featured,
      publicRegistration: true,
    });
    this.viewMode = 'form';
  }

  // ── FIX: recordCampaignView called when opening detail ──────
  showDetail(campaign: Campaign): void {
    this.selectedCampaign = campaign;
    this.detailTab        = 'overview';
    this.participants     = [];
    this.isRegistered     = false;
    this.viewMode         = 'detail';
    this.checkRegistration(campaign.id);

    // Record view — backend deduplicates per user
    this.campaignApi.recordCampaignView(campaign.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          // Update views count locally
          this.selectedCampaign = { ...this.selectedCampaign!, views: updated.views };
          const idx = this.campaigns.findIndex(c => c.id === campaign.id);
          if (idx !== -1) this.campaigns[idx] = { ...this.campaigns[idx], views: updated.views };
          this.applyFilter();
        },
        error: () => { /* silently ignore view recording errors */ }
      });
  }

  // ── FIX: Top 5 loaded from backend endpoint ─────────────────
  showDashboard(): void {
    this.computeDashStats();
    this.viewMode = 'dashboard';
    this.loadTop5FromBackend();
  }

  private loadTop5FromBackend(): void {
    this.topCampaignsLoading = true;
    this.campaignApi.getTop5Campaigns()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (top5) => {
          this.topCampaigns = top5;
          this.topCampaignsLoading = false;
        },
        error: () => {
          // Fallback to local sort
          this.topCampaigns = [...this.campaigns]
            .sort((a, b) => {
              const fa = Boolean(a.featured), fb = Boolean(b.featured);
              if (fa !== fb) return fb ? 1 : -1;
              const va = a.views ?? 0, vb = b.views ?? 0;
              if (va !== vb) return vb - va;
              return (b.startDate ?? '').localeCompare(a.startDate ?? '');
            })
            .slice(0, 5);
          this.topCampaignsLoading = false;
        }
      });
  }

  setDetailTab(tab: 'overview' | 'events' | 'participants'): void {
    this.detailTab = tab;
    if (tab === 'participants' && this.selectedCampaign) {
      this.loadParticipants(this.selectedCampaign.id);
    }
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
        formValue:  this.campaignForm.value,
        editMode:   this.isEditMode,
        campaignId: this.selectedCampaign?.id ?? null,
        savedAt:    new Date().toISOString(),
      };
      this.snackBar.open('Draft saved (session)', 'Close', { duration: 2500 });
    } catch {
      this.snackBar.open('Could not save draft', 'Close', { duration: 3000 });
    }
  }

  restoreDraft(): void {
    if (!this.draftData) {
      this.snackBar.open('No draft available', 'Close', { duration: 2500 });
      return;
    }
    this.campaignForm.patchValue(this.draftData.formValue);
    this.snackBar.open('Draft restored', 'Close', { duration: 2500 });
  }

  clearDraft(): void { this.draftData = null; }

  private markCurrentStepTouched(): void {
    this.stepFields[this.currentStep].forEach(name =>
      this.campaignForm.get(name)?.markAsTouched(),
    );
  }

  goNext(): void {
    if (this.currentStep === this.wizardSteps.length - 1) {
      this.onSubmit();
      return;
    }
    this.markCurrentStepTouched();
    if (!this.isCurrentStepValid()) {
      const invalidFields = this.stepFields[this.currentStep].filter(name =>
        this.campaignForm.get(name)?.invalid,
      );
      if (invalidFields.length > 0) {
        this.snackBar.open(`Please fill in: ${invalidFields.join(', ')}`, 'Close', { duration: 3000 });
      }
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
    if (file.size > 5 * 1024 * 1024) {
      this.snackBar.open('Image too large (max 5 MB)', 'Close', { duration: 3000 });
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Unsupported format', 'Close', { duration: 3000 });
      return;
    }
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

  setFilter(value: CampaignStatus | 'ALL' | 'FEATURED'): void {
    this.activeFilter = value;
    this.applyFilter();
  }

  applyFilter(): void {
    const query = (this.searchControl.value ?? '').toLowerCase();
    this.filteredCampaigns = this.campaigns.filter(c => {
      const matchSearch =
        !query ||
        c.title.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query));
      const matchFilter =
        this.activeFilter === 'ALL' ||
        (this.activeFilter === 'FEATURED' ? c.featured : c.status === this.activeFilter);
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
      ? formData.startDate.toISOString().split('T')[0]
      : formData.startDate;
    const endDateStr: string = formData.endDate instanceof Date
      ? formData.endDate.toISOString().split('T')[0]
      : formData.endDate;

    const startTime = formData.startTime || '09:00';
    const endTime = formData.endTime || '17:00';

    const payload = {
      title:           formData.title,
      description:     formData.description,
      targetAudience:  formData.targetAudience || '',
      visibility:      formData.visibility || 'SHARED',
      startDate:       `${startDateStr}T${startTime}:00`,
      endDate:         `${endDateStr}T${endTime}:00`,
      maxParticipants: formData.capacity || null,
      featured:        formData.featured,
    };

    const request$ = this.isEditMode && this.selectedCampaign
      ? this.campaignApi.updateCampaign(this.selectedCampaign.id, payload, this.selectedFile)
      : this.campaignApi.createCampaign(payload, this.selectedFile);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditMode ? 'Campaign updated!' : 'Campaign created!',
          'Close', { duration: 3000 },
        );
        this.clearDraft();
        this.loadCampaigns();
        this.showList();
        this.isSaving = false;
      },
      error: (err) => {
        console.error('Save error:', err);
        this.snackBar.open('Error saving campaign', 'Close', { duration: 3000 });
        this.isSaving = false;
      },
    });
  }

  

  // ── Detail ───────────────────────────────────────────────────

  checkRegistration(id: number): void {
    this.campaignApi.isUserRegistered(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  val => (this.isRegistered = val),
        error: ()  => (this.isRegistered = false),
      });
  }

  loadParticipants(id: number): void {
    this.isParticipantsLoading = true;
    this.campaignApi.getCampaignParticipants(id).pipe(takeUntil(this.destroy$)).subscribe({
      next:  data => { this.participants = data; this.isParticipantsLoading = false; },
      error: ()   => { this.participants = []; this.isParticipantsLoading = false; },
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
      error: () => {
        this.snackBar.open('Error', 'Close', { duration: 3000 });
        this.isRegistering = false;
      }
    });
  }
// ── Delete campaign ──────────────────────────────────────────
deleteCampaign(event: Event, campaign: Campaign): void {
  event.stopPropagation();

  // 🎨 FIX: Use Material Dialog instead of browser confirm()
  const dialogRef = this.dialog.open(ConfirmDeleteCampaignDialog, {
    width: '400px',
    data: { campaign }
  });

  dialogRef.afterClosed().subscribe(confirmed => {
    if (!confirmed) return;

    this.campaignApi.deleteCampaign(campaign.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const message = campaign.visibility === 'SHARED' 
            ? `SHARED campaign "${campaign.title}" deleted. All club permissions revoked.`
            : `Campaign "${campaign.title}" deleted`;
          this.snackBar.open(message, 'Close', { duration: 4000 });
          this.campaigns = this.campaigns.filter(c => c.id !== campaign.id);
          this.applyFilter();
          this.computeDashStats();
        },
        error: (err) => {
          console.error('Delete error:', err);
          this.snackBar.open('Error deleting campaign: ' + (err?.error?.message || 'Unknown error'), 'Close', { duration: 4000 });
        },
      });
  });
}

// ── Close permissions panel ──────────────────────────────────
closePanel(): void {
  this.showPermissionsPanel      = false;
  this.selectedClubForPermission = null;
  this.clubSearchControl.setValue('');
  this.filteredClubs             = [];
  this.pendingPermissions        = new Set(['VIEW']);
}
  private refreshCampaign(id: number): void {
    this.campaignApi.getCampaignById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.selectedCampaign = updated;
        const index = this.campaigns.findIndex(c => c.id === id);
        if (index !== -1) {
          this.campaigns[index] = { ...this.campaigns[index], currentParticipants: updated.currentParticipants };
        }
        this.applyFilter();
        this.computeDashStats();
      }
    });
  }

  // ── Event management ─────────────────────────────────────────

  addEventToCampaign(campaign: Campaign): void {
    this.router.navigate(['/events/create'], { queryParams: { campaignId: campaign.id } });
  }

  // ══════════════════════════════════════════════════════════════════
  // PERMISSIONS MANAGEMENT — FIX: Club selection for SHARED campaigns
  // ══════════════════════════════════════════════════════════════════

  togglePermissionsPanel(campaign: Campaign): void {
    // ✅ FIX: Only show permissions panel for SHARED campaigns
    if (campaign.visibility !== 'SHARED') {
      this.snackBar.open('Permissions panel is only available for SHARED campaigns', 'Close', { duration: 3000 });
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
      // Load all clubs so admin can add new club permissions
      this.loadAllClubs();
    }, 0);
  }

  // Check if permissions panel can be shown
  canShowPermissionsPanel(campaign: Campaign): boolean {
    return this.isAdmin && campaign.visibility === 'SHARED';
  }

  loadCampaignPermissions(campaignId: number): void {
    if (!this.isAdmin) return;
    this.permissionsLoading = true;
    this.campaignApi.getCampaignPermissions(campaignId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (permissions) => {
        this.campaignPermissions = permissions;
        this.permissionsLoading  = false;
      },
      error: () => {
        this.snackBar.open('Error loading permissions', 'Close', { duration: 3000 });
        this.permissionsLoading = false;
      },
    });
  }

  // Load all clubs from backend
  private loadAllClubs(): void {
    this.allClubsLoading = true;
    this.campaignApi.getAllClubs().pipe(takeUntil(this.destroy$)).subscribe({
      next: (clubs) => {
        this.allClubs = clubs;
        this.filteredClubs = clubs;
        this.allClubsLoading = false;
      },
      error: () => {
        this.allClubsLoading = false;
      }
    });
  }

  // Filter clubs by search query — excludes clubs that already have access
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
    // Hide dropdown
    this.filteredClubs = [];
  }

  // Clubs without an access entry yet (for the "Add Club" dropdown)
  get clubsWithoutAccess(): Club[] {
    const alreadyGranted = new Set(this.campaignPermissions.map(a => a.clubId));
    return this.allClubs.filter(c => !alreadyGranted.has(c.id));
  }

  togglePendingPermission(perm: string | CampaignPermission): void {
    const permission = perm as CampaignPermission;
    if (this.pendingPermissions.has(permission)) {
      this.pendingPermissions.delete(permission);
    } else {
      this.pendingPermissions.add(permission);
    }
  }

  isPendingPermission(perm: CampaignPermission): boolean {
    return this.pendingPermissions.has(perm);
  }

  // Grant all selected permissions to the chosen club
  grantAccessToClub(): void {
    if (!this.selectedClubForPermission || !this.selectedCampaign) {
      this.snackBar.open('Select a club and campaign first', 'Close', { duration: 2500 });
      return;
    }
    if (!this.selectedCampaign.id) {
      this.snackBar.open('Campaign ID is missing', 'Close', { duration: 2500 });
      return;
    }
    if (!this.selectedClubForPermission.id) {
      this.snackBar.open('Club ID is missing', 'Close', { duration: 2500 });
      return;
    }
    if (this.pendingPermissions.size === 0) {
      this.snackBar.open('Select at least one permission', 'Close', { duration: 2500 });
      return;
    }

    const clubId     = this.selectedClubForPermission.id;
    const campaignId = this.selectedCampaign.id;
    const perms      = Array.from(this.pendingPermissions) as CampaignPermission[];

    // Grant each permission sequentially
    const grantNext = (index: number) => {
      if (index >= perms.length) {
        this.snackBar.open(`Access granted to ${this.selectedClubForPermission!.name}`, 'Close', { duration: 2500 });
        this.selectedClubForPermission = null;
        this.clubSearchControl.setValue('');
        this.pendingPermissions = new Set(['VIEW']);
        this.loadCampaignPermissions(campaignId);
        this.filterClubs('');
        return;
      }
      this.campaignApi.grantPermission(campaignId, clubId, perms[index])
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => grantNext(index + 1),
          error: (err) => {
            console.error(`Error granting ${perms[index]}:`, err);
            this.snackBar.open(`Error granting ${perms[index]}: ${err?.error?.message || err?.message || 'Unknown error'}`, 'Close', { duration: 5000 });
          }
        });
    };
    grantNext(0);
  }

  grantPermissionToClub(campaignId: number, clubId: number, permission: string): void {
    this.campaignApi.grantPermission(campaignId, clubId, permission as CampaignPermission)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open(`Permission "${permission}" granted`, 'Close', { duration: 2000 });
          this.loadCampaignPermissions(campaignId);
        },
        error: () => this.snackBar.open('Error granting permission', 'Close', { duration: 3000 }),
      });
  }

  revokePermissionFromClub(campaignId: number, clubId: number, permission: string): void {
    this.campaignApi.revokePermission(campaignId, clubId, permission as CampaignPermission)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open(`Permission "${permission}" revoked`, 'Close', { duration: 2000 });
          this.loadCampaignPermissions(campaignId);
          this.filterClubs(this.clubSearchControl.value ?? '');
        },
        error: () => this.snackBar.open('Error revoking permission', 'Close', { duration: 3000 }),
      });
  }

  // Remove ALL permissions for a club (full revoke)
  revokeAllFromClub(campaignId: number, access: CampaignAccess): void {
    if (!confirm(`Remove all access for ${access.clubName || 'this club'}?`)) return;
    const perms = [...access.permissions] as CampaignPermission[];
    const revokeNext = (index: number) => {
      if (index >= perms.length) {
        this.snackBar.open('All permissions revoked', 'Close', { duration: 2500 });
        this.loadCampaignPermissions(campaignId);
        this.filterClubs(this.clubSearchControl.value ?? '');
        return;
      }
      this.campaignApi.revokePermission(campaignId, access.clubId, perms[index])
        .pipe(takeUntil(this.destroy$))
        .subscribe({ next: () => revokeNext(index + 1), error: () => revokeNext(index + 1) });
    };
    revokeNext(0);
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

  // ── Visibility helpers ───────────────────────────────────────

  getVisibilityClass(visibility: string): string {
    const map: Record<string, string> = {
      PRIVATE: 'status-cancelled',
      SHARED:  'status-active',
      PUBLIC:  'status-planned',
    };
    return map[visibility] ?? 'status-planned';
  }

  getVisibilityIcon(visibility: string): string {
    const map: Record<string, string> = {
      PRIVATE: 'lock',
      SHARED:  'group',
      PUBLIC:  'public',
    };
    return map[visibility] ?? 'public';
  }

  getVisibilityLabel(visibility: string): string {
    const map: Record<string, string> = {
      PRIVATE: 'Private',
      SHARED:  'Shared',
      PUBLIC:  'Public',
    };
    return map[visibility] ?? 'Public';
  }

  // ── Template helpers ─────────────────────────────────────────

  getStatusClass(status: CampaignStatus): string {
    const map: Record<CampaignStatus, string> = {
      ACTIVE:    'status-active',
      PLANNED:   'status-planned',
      FINISHED:  'status-finished',
      CANCELLED: 'status-cancelled',
    };
    return map[status] ?? '';
  }

  getStatusLabel(status: CampaignStatus): string {
    const map: Record<CampaignStatus, string> = {
      ACTIVE:    'Active',
      PLANNED:   'Planned',
      FINISHED:  'Finished',
      CANCELLED: 'Cancelled',
    };
    return map[status] ?? status;
  }

  getStatusIcon(status: CampaignStatus): string {
    const map: Record<CampaignStatus, string> = {
      ACTIVE:    'play_circle',
      PLANNED:   'schedule',
      FINISHED:  'check_circle',
      CANCELLED: 'cancel',
    };
    return map[status] ?? 'help';
  }

  getCapacityPercent(c: Campaign): number {
    if (!c.maxParticipants) return 0;
    return Math.min(100, Math.round((c.currentParticipants / c.maxParticipants) * 100));
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
    return Math.round(
      (this.dashStats.byStatus[status as CampaignStatus] / this.dashStats.totalCampaigns) * 100,
    );
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatDateTime(dateStr: string, timeStr: string): string {
    if (!dateStr) return '—';
    const time = timeStr || '00:00';
    const date = new Date(`${dateStr}T${time}`);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
      + ' at ' + time;
  }

  get previewCampaign(): Campaign {
    const v = this.campaignForm.value;
    let status: CampaignStatus = 'PLANNED';
    if (v.startDate && v.endDate) {
      const now       = new Date();
      const startDate = new Date(v.startDate + 'T00:00:00');
      const endDate   = new Date(v.endDate   + 'T00:00:00');
      if (endDate < now)                           status = 'FINISHED';
      else if (startDate <= now && endDate >= now) status = 'ACTIVE';
    }
    return {
      id:                  this.selectedCampaign?.id || 0,
      title:               v.title       || 'Campaign Title',
      description:         v.description || 'Description…',
      startDate:           v.startDate   || new Date().toISOString().split('T')[0],
      endDate:             v.endDate     || new Date().toISOString().split('T')[0],
      imageUrl:            v.imageUrl,
      targetAudience:      v.targetAudience,
      visibility:          v.visibility  || 'SHARED',
      status,
      maxParticipants:     v.maxParticipants,
      currentParticipants: this.selectedCampaign?.currentParticipants || 0,
      views:               this.selectedCampaign?.views || 0,
      featured:            v.featured    || false,
      createdAt:           this.selectedCampaign?.createdAt || new Date().toISOString(),
      events:              this.selectedCampaign?.events    || [],
    };
  }

  trackById(_: number, item: Campaign): number    { return item.id; }
  trackByStepId(_: number, s: WizardStep): number { return s.id; }
  trackByValue(_: number, o: any): string         { return o.value; }
  trackByClubId(_: number, c: Club): number       { return c.id; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRM DELETE DIALOG COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-confirm-delete-campaign-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="icon-warning">warning</mat-icon>
      Delete Campaign
    </h2>

    <mat-dialog-content class="dialog-content">
      <p class="campaign-title">
        "{{ data.campaign.title }}"
      </p>

      <div class="warning-section" *ngIf="data.campaign.visibility === 'SHARED'">
        <mat-icon class="icon-shared">info</mat-icon>
        <div>
          <strong>This is a SHARED campaign</strong>
          <p>All clubs with permissions will lose access to this campaign.</p>
        </div>
      </div>

      <p class="warning-text">
        <mat-icon>error_outline</mat-icon>
        This action cannot be undone.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="warn" (click)="onConfirm()">
        <mat-icon>delete_outline</mat-icon>
        Delete Campaign
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #d32f2f;
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
      margin-bottom: 16px;
      word-break: break-word;
    }

    .warning-section {
      display: flex;
      gap: 12px;
      background: #fff3e0;
      padding: 12px;
      border-left: 4px solid #ff9800;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .icon-shared {
      color: #ff9800;
      flex-shrink: 0;
    }

    .warning-section strong {
      display: block;
      margin-bottom: 4px;
    }

    .warning-section p {
      margin: 0;
      font-size: 14px;
      color: #555;
    }

    .warning-text {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d32f2f;
      font-weight: 500;
      margin: 0;
    }

    .warning-text mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    mat-dialog-actions {
      gap: 8px;
      margin-top: 24px;
    }

    button mat-icon {
      margin-right: 8px;
    }
  `]
})
export class ConfirmDeleteCampaignDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { campaign: Campaign },
    private dialogRef: MatDialogRef<ConfirmDeleteCampaignDialog>
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}