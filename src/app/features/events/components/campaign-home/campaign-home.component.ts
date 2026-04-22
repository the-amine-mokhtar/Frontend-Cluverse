import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder, FormGroup, Validators,
  FormControl, AbstractControl, ValidationErrors
} from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { trigger, transition, style, animate } from '@angular/animations';
import { Router } from '@angular/router';
import { CampaignApiService, Participant } from '../../services/campaign-api.service';
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
  campaignPermissions: any[] = [];
  permissionsLoading = false;
  showPermissionsPanel = false;

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
    { label: 'Tous',      value: 'ALL'       },
    { label: 'Active',    value: 'ACTIVE'    },
    { label: 'Planifiée', value: 'PLANNED'   },
    { label: 'Terminée',  value: 'FINISHED'  },
    { label: 'Annulée',   value: 'CANCELLED' },
    { label: 'À la une',  value: 'FEATURED'  },
  ];

  // ── Wizard state ─────────────────────────────────────────────
  currentStep = 0;
  isSaving    = false;
  isEditMode  = false;
  imagePreviewUrl = '';
  imageError      = false;
  selectedFile: File | null = null;

  readonly wizardSteps: WizardStep[] = [
    { id: 0, name: 'Identité',        sub: 'Titre, description',  icon: 'badge'        },
    { id: 1, name: 'Visuel',          sub: 'Image',               icon: 'image'        },
    { id: 2, name: 'Dates & Options', sub: 'Planning, capacité',  icon: 'event'        },
    { id: 3, name: 'Récapitulatif',   sub: 'Vérification finale', icon: 'check_circle' },
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
    { value: 'ACTIVE',    label: 'Active',    sub: 'En cours', dotClass: 'dot-active'    },
    { value: 'PLANNED',   label: 'Planifiée', sub: 'À venir',  dotClass: 'dot-planned'   },
    { value: 'FINISHED',  label: 'Terminée',  sub: 'Passée',   dotClass: 'dot-finished'  },
    { value: 'CANCELLED', label: 'Annulée',   sub: 'Stoppée',  dotClass: 'dot-cancelled' },
  ];

  readonly visibilityOptions: Array<{
    value: CampaignVisibility; label: string; icon: string
  }> = [
    { value: 'PUBLIC',  label: 'Publique',  icon: 'public' },
    { value: 'SHARED',  label: 'Partagée',  icon: 'group'  },
    { value: 'PRIVATE', label: 'Privée',    icon: 'lock'   },
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

  readonly statusBreakdown: {
    label: string; key: CampaignStatus; cls: string; icon: string
  }[] = [
    { label: 'Active',    key: 'ACTIVE',    cls: 'bar-active',    icon: 'play_circle'  },
    { label: 'Planifiée', key: 'PLANNED',   cls: 'bar-planned',   icon: 'schedule'     },
    { label: 'Terminée',  key: 'FINISHED',  cls: 'bar-finished',  icon: 'check_circle' },
    { label: 'Annulée',   key: 'CANCELLED', cls: 'bar-cancelled', icon: 'cancel'       },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private campaignApi: CampaignApiService,
    private snackBar: MatSnackBar,
    private router: Router,
    private authHelper: AuthHelperService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────

  ngOnInit(): void {
    // FIX #7 — connecter au vrai service d'auth (remplacer isAdmin = true par la logique réelle)
    this.isAdmin = this.authHelper.getRole() === 'SUPER_ADMIN' || this.authHelper.getRole() === 'PRESIDENT';
    this.buildForm();
    this.loadCampaigns();
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilter());
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
        // FIX #2 — visibility ajouté avec valeur par défaut SHARED
        visibility:         ['SHARED', Validators.required],
        startDate:          ['', [Validators.required, this.minDateValidator()]],
        startTime:          ['09:00'],  // Heure par défaut 09:00
        endDate:            ['', Validators.required],
        endTime:            ['17:00'],  // Heure par défaut 17:00
        capacity:           [null, [Validators.min(1)]],
        featured:           [false],
        publicRegistration: [true],
      },
      { validators: this.dateRangeValidator },
    );

    // Image preview réactive sur le champ URL
    this.campaignForm.get('imageUrl')!.valueChanges
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(url => {
        if (url && !this.selectedFile) {
          this.imagePreviewUrl = url ?? '';
          this.imageError = false;
        }
      });
  }

  // FIX #1 — utiliser l'heure locale (pas UTC) pour éviter les décalages de timezone
  private minDateValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      try {
        // "YYYY-MM-DD" + T00:00:00 sans Z = heure locale
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
        // FIX #1 — heure locale ici aussi
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
      next: (data: any[]) => {
        this.campaigns = data.map(campaign => ({
          ...campaign,
          canAddEvent: this.canAddEventToCampaign(campaign),
        })) as Campaign[];
        this.applyFilter();
        // FIX #4 — recalculer les stats à chaque chargement
        this.computeDashStats();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement campagnes:', err);
        this.snackBar.open(
          'Erreur de chargement: ' + (err.status || 'Inconnu'),
          'Fermer',
          { duration: 3000 },
        );
        this.isLoading = false;
      },
    });
  }

  private canAddEventToCampaign(campaign: Campaign): boolean {
    return this.isAdmin
      || campaign.visibility === 'SHARED'
      || campaign.visibility === 'PUBLIC';
  }

  // ── Navigation views ─────────────────────────────────────────

  showList(): void {
    this.viewMode         = 'list';
    this.selectedCampaign = undefined;
    this.isEditMode       = false;
    this.currentStep      = 0;
    // Fermer le panel de permissions si ouvert
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
      // FIX #2 — visibility patchée depuis la campagne existante
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

  showDetail(campaign: Campaign): void {
    this.selectedCampaign = campaign;
    this.detailTab        = 'overview';
    // FIX #6 — reset systématique à chaque ouverture de détail
    this.participants     = [];
    this.isRegistered     = false;
    this.viewMode         = 'detail';
    this.checkRegistration(campaign.id);
  }

  showDashboard(): void {
    this.computeDashStats();
    this.viewMode = 'dashboard';
  }

  setDetailTab(tab: 'overview' | 'events' | 'participants'): void {
    this.detailTab = tab;
    // FIX #6 — recharger à chaque fois qu'on revient sur l'onglet participants
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

  isCurrentStepValidForUI(): boolean {
    return this.isCurrentStepValid();
  }
private draftData: any = null;

saveDraft(): void {
  try {
    this.draftData = {
      formValue:  this.campaignForm.value,
      editMode:   this.isEditMode,
      campaignId: this.selectedCampaign?.id ?? null,
      savedAt:    new Date().toISOString(),
    };
    this.snackBar.open('Brouillon sauvegardé (session)', 'Fermer', { duration: 2500 });
  } catch {
    this.snackBar.open('Impossible de sauvegarder le brouillon', 'Fermer', { duration: 3000 });
  }
}

restoreDraft(): void {
  if (!this.draftData) {
    this.snackBar.open('Aucun brouillon disponible', 'Fermer', { duration: 2500 });
    return;
  }
  this.campaignForm.patchValue(this.draftData.formValue);
  this.snackBar.open('Brouillon restauré', 'Fermer', { duration: 2500 });
}

clearDraft(): void {
  this.draftData = null;
}
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
        this.snackBar.open(`Complétez : ${invalidFields.join(', ')}`, 'Fermer', { duration: 3000 });
      }
      return;
    }
    this.currentStep++;
  }

  goBack(): void {
    if (this.currentStep > 0) this.currentStep--;
  }

  jumpToStep(idx: number): void {
    if (this.isStepClickable(idx)) this.currentStep = idx;
  }

  // FIX #3 — saveDraft() sauvegarde réellement dans localStorage
 

  // ── File upload ──────────────────────────────────────────────

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.snackBar.open('Image trop grande (max 5 MB)', 'Fermer', { duration: 3000 });
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Format non supporté', 'Fermer', { duration: 3000 });
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
    console.log('🔍 [Campaign] onSubmit() called');
    console.log('🔍 [Campaign] Form valid:', this.campaignForm.valid);
    console.log('🔍 [Campaign] Form value:', this.campaignForm.value);
    console.log('🔍 [Campaign] SelectedFile:', this.selectedFile?.name, 'Size:', this.selectedFile?.size);

    if (this.campaignForm.invalid) {
      this.campaignForm.markAllAsTouched();
      console.error('❌ [Campaign] Form invalid, errors:', this.campaignForm.errors);
      this.snackBar.open('Veuillez remplir tous les champs correctement', 'Fermer', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formData = this.campaignForm.value;

    // FIX #1 — normaliser les dates en "YYYY-MM-DD HH:mm:ss" string avec heures/minutes
    const startDateStr: string = formData.startDate instanceof Date
      ? formData.startDate.toISOString().split('T')[0]
      : formData.startDate;
    const endDateStr: string = formData.endDate instanceof Date
      ? formData.endDate.toISOString().split('T')[0]
      : formData.endDate;
    
    const startTime = formData.startTime || '09:00';
    const endTime = formData.endTime || '17:00';
    
    const startDateTimeStr = `${startDateStr}T${startTime}:00`;
    const endDateTimeStr = `${endDateStr}T${endTime}:00`;

    // Statut calculé côté frontend (le backend le recalcule aussi, double sécurité)
    const now       = new Date();
    const startDateTime = new Date(startDateStr + 'T' + startTime); // FIX #1 heure locale
    const endDateTime   = new Date(endDateStr   + 'T' + endTime);
    let status: CampaignStatus = 'PLANNED';
    if (endDateTime < now)                            status = 'FINISHED';
    else if (startDateTime <= now && endDateTime >= now)  status = 'ACTIVE';

    // FIX #2 — visibility incluse dans le payload
    const payload = {
      title:           formData.title,
      description:     formData.description,
      targetAudience:  formData.targetAudience || '',
      visibility:      formData.visibility || 'SHARED',
      startDate:       startDateTimeStr,
      endDate:         endDateTimeStr,
      maxParticipants: formData.capacity || null,
      featured:        formData.featured,
    };

    console.log('✅ [Campaign] Payload prepared:', payload);
    console.log('✅ [Campaign] Image file:', this.selectedFile ? `${this.selectedFile.name} (${this.selectedFile.size} bytes)` : 'NONE');

    const request$ = this.isEditMode && this.selectedCampaign
      ? this.campaignApi.updateCampaign(this.selectedCampaign.id, payload, this.selectedFile)
      : this.campaignApi.createCampaign(payload, this.selectedFile);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditMode ? 'Campagne mise à jour !' : 'Campagne créée !',
          'Fermer', { duration: 3000 },
        );
        // FIX #3 — effacer le brouillon après soumission réussie
        this.clearDraft();
        this.loadCampaigns();
        this.showList();
        this.isSaving = false;
      },
      error: (err) => {
        console.error('Erreur sauvegarde:', err);
        this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 3000 });
        this.isSaving = false;
      },
    });
  }

  deleteCampaign(event: MouseEvent, campaign: Campaign): void {
    event.stopPropagation();
    if (!confirm(`Supprimer "${campaign.title}" ?`)) return;
    this.campaignApi.deleteCampaign(campaign.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.campaigns = this.campaigns.filter(c => c.id !== campaign.id);
        this.applyFilter();
        // FIX #4 — recalculer stats après suppression
        this.computeDashStats();
        this.snackBar.open('Campagne supprimée', 'Fermer', { duration: 3000 });
      },
      error: () => this.snackBar.open('Erreur suppression', 'Fermer', { duration: 3000 }),
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
        this.isRegistered = !this.isRegistered;
        if (this.selectedCampaign) {
          this.selectedCampaign.currentParticipants += this.isRegistered ? 1 : -1;
        }
        this.snackBar.open(
          this.isRegistered ? 'Inscrit !' : 'Désinscrit',
          'Fermer', { duration: 3000 },
        );
        this.isRegistering = false;
      },
      error: () => {
        this.snackBar.open('Erreur', 'Fermer', { duration: 3000 });
        this.isRegistering = false;
      },
    });
  }

  // ── Event management ─────────────────────────────────────────

  addEventToCampaign(campaign: Campaign): void {
    this.router.navigate(['/events/create'], {
      queryParams: { campaignId: campaign.id },
    });
  }

  // ── Permissions management ───────────────────────────────────

  loadCampaignPermissions(campaignId: number): void {
    if (!this.isAdmin) return;
    this.permissionsLoading = true;
    this.campaignApi.getCampaignPermissions(campaignId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (permissions) => {
        this.campaignPermissions = permissions;
        this.permissionsLoading  = false;
      },
      error: () => {
        this.snackBar.open('Erreur de chargement des permissions', 'Fermer', { duration: 3000 });
        this.permissionsLoading = false;
      },
    });
  }

  // FIX #5 — reset immédiat des données avant d'afficher le nouveau panel
  togglePermissionsPanel(campaign: Campaign): void {
    // Fermer si déjà ouvert pour la même campagne
    if (this.showPermissionsPanel && this.selectedCampaign?.id === campaign.id) {
      this.showPermissionsPanel = false;
      return;
    }
    // Reset avant d'ouvrir (évite flash de données précédentes)
    this.showPermissionsPanel = false;
    this.campaignPermissions  = [];
    this.selectedCampaign     = campaign;

    // Ouvrir au prochain cycle de détection de changement
    setTimeout(() => {
      this.showPermissionsPanel = true;
      this.loadCampaignPermissions(campaign.id);
    }, 0);
  }

  grantPermissionToClub(campaignId: number, clubId: number, permission: string): void {
    this.campaignApi.grantPermission(campaignId, clubId, permission as any)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open(`Permission "${permission}" accordée`, 'Fermer', { duration: 2000 });
          this.loadCampaignPermissions(campaignId);
        },
        error: () =>
          this.snackBar.open('Erreur lors de l\'accordage de la permission', 'Fermer', { duration: 3000 }),
      });
  }

  revokePermissionFromClub(campaignId: number, clubId: number, permission: string): void {
    this.campaignApi.revokePermission(campaignId, clubId, permission as any)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open(`Permission "${permission}" révoquée`, 'Fermer', { duration: 2000 });
          this.loadCampaignPermissions(campaignId);
        },
        error: () =>
          this.snackBar.open('Erreur lors de la révocation de la permission', 'Fermer', { duration: 3000 }),
      });
  }

  hasPermission(access: any, permission: string): boolean {
    return Array.isArray(access.permissions) && access.permissions.includes(permission);
  }

  // ── Dashboard ────────────────────────────────────────────────

  // FIX #10 — méthode unique réutilisée partout
  computeDashStats(): void {
    if (!this.campaigns) return;
    this.dashStats.totalCampaigns    = this.campaigns.length;
    this.dashStats.activeCampaigns   = this.campaigns.filter(c => c.status === 'ACTIVE').length;
    this.dashStats.totalParticipants = this.campaigns.reduce((s, c) => s + (c.currentParticipants || 0), 0);
    this.dashStats.totalViews        = this.campaigns.reduce((s, c) => s + (c.views || 0), 0);
    (['PLANNED', 'ACTIVE', 'FINISHED', 'CANCELLED'] as CampaignStatus[]).forEach(s => {
      this.dashStats.byStatus[s] = this.campaigns.filter(c => c.status === s).length;
    });
    this.topCampaigns = [...this.campaigns]
      .sort((a, b) => b.currentParticipants - a.currentParticipants)
      .slice(0, 5);
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
      PRIVATE: 'Privée',
      SHARED:  'Partagée',
      PUBLIC:  'Publique',
    };
    return map[visibility] ?? 'Publique';
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
      PLANNED:   'Planifiée',
      FINISHED:  'Terminée',
      CANCELLED: 'Annulée',
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
    // FIX #1 — heure locale pour l'affichage aussi
    return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
      .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatDateTime(dateStr: string, timeStr: string): string {
    if (!dateStr) return '—';
    const time = timeStr || '00:00';
    const dateTime = `${dateStr}T${time}`;
    const date = new Date(dateTime);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) 
      + ' à ' + time;
  }

  /** Données de prévisualisation de la carte dans l'étape récapitulatif */
  get previewCampaign(): Campaign {
    const v = this.campaignForm.value;

    let status: CampaignStatus = 'PLANNED';
    if (v.startDate && v.endDate) {
      const now       = new Date();
      // FIX #1 — heure locale
      const startDate = new Date(v.startDate + 'T00:00:00');
      const endDate   = new Date(v.endDate   + 'T00:00:00');
      if (endDate < now)                           status = 'FINISHED';
      else if (startDate <= now && endDate >= now) status = 'ACTIVE';
    }

    return {
      id:                  this.selectedCampaign?.id || 0,
      title:               v.title       || 'Titre de la campagne',
      description:         v.description || 'Description…',
      startDate:           v.startDate   || new Date().toISOString().split('T')[0],
      endDate:             v.endDate     || new Date().toISOString().split('T')[0],
      imageUrl:            v.imageUrl,
      targetAudience:      v.targetAudience,
      // FIX #2 — visibility du formulaire dans la preview
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
}