import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JsBarcode from 'jsbarcode';

import { Resource, ResourceStatus } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { ToastService } from '../../../core/services/toast.service';
import { RESOURCE_STATUS_LABELS } from '../utils/status-labels';
import { AuthHelperService } from '../../../core/services/auth-helper.service';

@Component({
  selector: 'app-resource-form',
  templateUrl: './resource-form.component.html'
})
export class ResourceFormComponent implements OnInit {
  pageTitle = 'Nouvelle ressource';

  loading = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  imageErrorMessage: string | null = null;
  isUploadingImage = false;
  
  // Barcode de la ressource créée
  generatedBarcode: string | null = null;
  showBarcodeSuccess = false;

  @ViewChild('imageInput') imageInput?: ElementRef<HTMLInputElement>;

  clubId = 0;
  isEditMode = false;
  resourceId: number | null = null;

  readonly statusLabels = RESOURCE_STATUS_LABELS;
  readonly statusOptions: ResourceStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(5), this.startsWithCapitalValidator()]],
    description: ['', [Validators.required, Validators.minLength(30)]],
    unitCost: [0, [Validators.required, Validators.min(0)]],
    status: ['AVAILABLE' as ResourceStatus, [Validators.required]],
    imageUrl: ['', [Validators.required]],
    quantityTotal: [0, [Validators.required, Validators.min(0)]],
    availableQuantity: [0, [Validators.required, Validators.min(0)]],
    lastUpdated: ['', [Validators.required, this.futureOrTodayValidator()]],
    lowStockThreshold: [0, [Validators.required, Validators.min(0)]],
    notes: ['', [Validators.required, Validators.minLength(30)]]
  }, { validators: this.quantityValidator() });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private resourceService: ResourceService,
    private toastService: ToastService,
    private authHelper: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.clubId = Number(this.authHelper.getClubId() ?? 0);

    const idParam = this.route.snapshot.paramMap.get('id');
    this.isEditMode = Boolean(idParam);
    this.resourceId = idParam ? Number(idParam) : null;

    if (this.isEditMode && this.resourceId) {
      this.pageTitle = 'Modifier la ressource';
      this.loadForEdit(this.resourceId);
    } else {
      this.pageTitle = 'Nouvelle ressource';
      this.form.patchValue({ lastUpdated: this.nowDatetimeLocal() });
      this.prefillFromVoiceQueryParams();
    }
  }

  private prefillFromVoiceQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('voicePrefill') !== '1') {
      return;
    }

    const toNumber = (value: string | null, fallback: number): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const name = String(qp.get('name') ?? '').trim();
    const description = String(qp.get('description') ?? '').trim();
    const notes = String(qp.get('notes') ?? '').trim();
    const statusRaw = String(qp.get('status') ?? 'AVAILABLE').trim().toUpperCase();
    const status: ResourceStatus = this.statusOptions.includes(statusRaw as ResourceStatus)
      ? (statusRaw as ResourceStatus)
      : 'AVAILABLE';

    const quantityTotal = toNumber(qp.get('quantityTotal'), 1);
    const availableQuantity = toNumber(qp.get('availableQuantity'), quantityTotal);
    const lowStockThreshold = toNumber(qp.get('lowStockThreshold'), Math.max(1, Math.ceil(quantityTotal * 0.2)));
    const unitCost = toNumber(qp.get('unitCost'), 0);

    this.form.patchValue({
      name: name || this.form.value.name || '',
      description: description || this.form.value.description || '',
      notes: notes || this.form.value.notes || '',
      status,
      quantityTotal,
      availableQuantity,
      lowStockThreshold,
      unitCost,
      lastUpdated: this.nowDatetimeLocal()
    });
  }

  get imageUrlValue(): string {
    return String(this.form.get('imageUrl')?.value ?? '').trim();
  }

  onImageSelected(event: Event): void {
    this.imageErrorMessage = null;

    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.imageErrorMessage = 'Veuillez sélectionner un fichier image.';
      this.clearImageInput();
      return;
    }

    // Keep it reasonable: base64 can get big quickly.
    const maxBytes = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxBytes) {
      this.imageErrorMessage = 'Image trop volumineuse (max 2 Mo).';
      this.clearImageInput();
      return;
    }

    this.isUploadingImage = true;
    this.resourceService.uploadImage(file).subscribe({
      next: (url) => {
        this.form.patchValue({ imageUrl: String(url ?? '').trim() });
        this.isUploadingImage = false;
      },
      error: (error) => {
        console.error('[ResourceFormComponent] uploadImage failed', error);
        this.imageErrorMessage = 'Upload impossible. Veuillez réessayer.';
        this.isUploadingImage = false;
        this.clearImageInput();
      }
    });
  }

  removeImage(): void {
    this.imageErrorMessage = null;
    this.form.patchValue({ imageUrl: '' });
    this.clearImageInput();
  }

  private clearImageInput(): void {
    const native = this.imageInput?.nativeElement;
    if (native) {
      native.value = '';
    }
  }

  private loadForEdit(id: number): void {
    this.loading = true;
    this.errorMessage = null;
    this.imageErrorMessage = null;

    this.resourceService.getById(id).subscribe({
      next: (resource: Resource) => {
        this.form.patchValue({
          name: resource.name,
          description: resource.description,
          unitCost: resource.unitCost,
          status: resource.status,
          imageUrl: resource.imageUrl,
          quantityTotal: resource.quantityTotal,
          availableQuantity: resource.availableQuantity,
          lastUpdated: this.toDatetimeLocalInput((resource as any)?.lastUpdated ?? (resource as any)?.last_updated),
          lowStockThreshold: resource.lowStockThreshold,
          notes: resource.notes
        });

        this.loading = false;
      },
      error: (error) => {
        console.error('[ResourceFormComponent] loadForEdit failed', error);
        this.errorMessage = 'Impossible de charger la ressource.';
        this.loading = false;
      }
    });
  }

  submit(): void {
    this.errorMessage = null;
    console.log('[ResourceFormComponent] submit() called', {
      isUploadingImage: this.isUploadingImage,
      formValid: this.form.valid,
      formInvalid: this.form.invalid,
      clubId: this.clubId
    });

    if (this.isUploadingImage) {
      this.errorMessage = 'Veuillez attendre la fin de l\'upload de l\'image.';
      return;
    }

    if (this.form.invalid) {
      const errors = this.buildDetailedErrorMessage();
      this.errorMessage = errors;
      console.warn('[ResourceFormComponent] Form is invalid:', errors);
      this.form.markAllAsTouched();
      return;
    }

    if (!this.clubId) {
      this.errorMessage = 'Club introuvable (token invalide). Veuillez vous reconnecter.';
      return;
    }

    const rawValue: any = this.form.value as any;
    const payload: any = {
      ...rawValue,
      clubId: this.clubId
    };

    const lastUpdatedInput = String(rawValue?.lastUpdated ?? '').trim();
    if (lastUpdatedInput) {
      payload.lastUpdated = this.toBackendLocalDateTime(lastUpdatedInput);
    } else {
      delete payload.lastUpdated;
    }

    console.log('[ResourceFormComponent] Submitting payload:', payload);
    this.isSubmitting = true;

    if (this.isEditMode && this.resourceId) {
      this.resourceService.update(this.resourceId, payload).subscribe({
        next: () => {
          console.log('[ResourceFormComponent] update succeeded');
          this.toastService.success('Ressource mise à jour avec succès');
          this.isSubmitting = false;
          this.router.navigate(['/logistics/resources']);
        },
        error: (error) => {
          console.error('[ResourceFormComponent] update failed', error);
          this.errorMessage = this.toUserMessage(error, 'Impossible d\'enregistrer la ressource.');
          this.toastService.error('Erreur lors de la mise à jour');
          this.isSubmitting = false;
        }
      });
      return;
    }

    this.resourceService.create(payload).subscribe({
      next: (resource: Resource) => {
        console.log('[ResourceFormComponent] create succeeded', resource);
        this.toastService.success('Ressource créée avec succès');
        this.isSubmitting = false;
        // Afficher le code-barres généré
        this.generatedBarcode = resource.barcode || null;
        this.showBarcodeSuccess = true;
        // Ne pas naviguer automatiquement - laisser l'utilisateur fermer la modale
      },
      error: (error) => {
        console.error('[ResourceFormComponent] create failed', error);
        this.errorMessage = this.toUserMessage(error, 'Impossible de créer la ressource.');
        this.toastService.error('Erreur lors de la création');
        this.isSubmitting = false;
      }
    });
  }

  private buildDetailedErrorMessage(): string {
    const errors: string[] = [];

    const nameCtrl = this.form.get('name');
    if (nameCtrl?.invalid) {
      if (nameCtrl.hasError('required')) {
        errors.push('• Nom: champ obligatoire');
      } else if (nameCtrl.hasError('minlength')) {
        errors.push('• Nom: minimum 5 caractères');
      } else if (nameCtrl.hasError('startsWithCapital')) {
        errors.push('• Nom: doit commencer par une majuscule');
      }
    }

    const descCtrl = this.form.get('description');
    if (descCtrl?.invalid) {
      if (descCtrl.hasError('required')) {
        errors.push('• Description: champ obligatoire');
      } else if (descCtrl.hasError('minlength')) {
        errors.push('• Description: minimum 30 caractères');
      }
    }

    const imageCtrl = this.form.get('imageUrl');
    if (imageCtrl?.invalid) {
      if (imageCtrl.hasError('required')) {
        errors.push('• Image: obligatoire (veuillez uploader une image)');
      }
    }

    const notesCtrl = this.form.get('notes');
    if (notesCtrl?.invalid) {
      if (notesCtrl.hasError('required')) {
        errors.push('• Notes: champ obligatoire');
      } else if (notesCtrl.hasError('minlength')) {
        errors.push('• Notes: minimum 30 caractères');
      }
    }

    const costCtrl = this.form.get('unitCost');
    if (costCtrl?.invalid) {
      if (costCtrl.hasError('required')) {
        errors.push('• Coût unitaire: champ obligatoire');
      } else if (costCtrl.hasError('min')) {
        errors.push('• Coût unitaire: doit être positif');
      }
    }

    const dateCtrl = this.form.get('lastUpdated');
    if (dateCtrl?.invalid) {
      if (dateCtrl.hasError('required')) {
        errors.push('• Date: champ obligatoire');
      } else if (dateCtrl.hasError('futureOrToday')) {
        errors.push('• Date: doit être aujourd\'hui ou dans le futur');
      }
    }

    const qtyTotalCtrl = this.form.get('quantityTotal');
    if (qtyTotalCtrl?.invalid) {
      if (qtyTotalCtrl.hasError('required')) {
        errors.push('• Quantité totale: champ obligatoire');
      } else if (qtyTotalCtrl.hasError('min')) {
        errors.push('• Quantité totale: doit être positive');
      }
    }

    const qtyAvailCtrl = this.form.get('availableQuantity');
    if (qtyAvailCtrl?.invalid) {
      if (qtyAvailCtrl.hasError('required')) {
        errors.push('• Quantité disponible: champ obligatoire');
      } else if (qtyAvailCtrl.hasError('min')) {
        errors.push('• Quantité disponible: doit être positive');
      }
    }

    const thresholdCtrl = this.form.get('lowStockThreshold');
    if (thresholdCtrl?.invalid) {
      if (thresholdCtrl.hasError('required')) {
        errors.push('• Seuil stock bas: champ obligatoire');
      } else if (thresholdCtrl.hasError('min')) {
        errors.push('• Seuil stock bas: doit être positif');
      }
    }

    if (this.form.hasError('quantityMismatch')) {
      errors.push('• Quantité disponible ne peut pas dépasser la quantité totale');
    }

    if (errors.length === 0) {
      return 'Erreur dans le formulaire.';
    }

    return 'Veuillez corriger les erreurs:\n' + errors.join('\n');
  }

  private toUserMessage(error: unknown, fallback: string): string {
    const err = error as HttpErrorResponse | any;
    const status = Number(err?.status ?? 0);
    const backend = err?.error;

    if (typeof backend === 'string' && backend.trim()) {
      return backend;
    }

    const message = String(err?.message ?? '').trim();
    if (status) {
      return `${fallback} (HTTP ${status})`;
    }
    if (message) {
      return `${fallback} (${message})`;
    }
    return fallback;
  }

  cancel(): void {
    if (this.isEditMode && this.resourceId) {
      this.router.navigate(['/logistics/resources', this.resourceId]);
      return;
    }

    this.router.navigate(['/logistics/resources']);
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return Boolean(control && control.invalid && control.touched);
  }

  errorForName(): string {
    const control = this.form.get('name');
    if (!control) {
      return '';
    }
    if (control.hasError('required')) {
      return 'Le nom est obligatoire';
    }
    if (control.hasError('minlength')) {
      return 'Minimum 2 caractères';
    }
    return 'Champ invalide';
  }

  errorForPositiveNumber(): string {
    return 'Valeur invalide';
  }

  errorForUnitCost(): string {
    const control = this.form.get('unitCost');
    if (control?.hasError('min')) {
      return 'Le coût doit être positif';
    }
    if (control?.hasError('required')) {
      return 'Le coût doit être positif';
    }
    return 'Le coût doit être positif';
  }

  private nowDatetimeLocal(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  private toDatetimeLocalInput(value: unknown): string {
    if (!value) {
      return '';
    }

    const s = String(value).trim();
    if (!s) {
      return '';
    }

    const normalized = s.includes('T') ? s : s.replace(' ', 'T');
    const match = normalized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return match ? match[1] : '';
  }

  private toBackendLocalDateTime(input: string): string {
    const s = (input ?? '').trim();
    if (!s) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
      return `${s}:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) {
      return s;
    }

    const normalized = s.replace(' ', 'T');
    const match = normalized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?/);
    if (!match) {
      return s;
    }
    const base = match[1];
    const sec = match[2] ?? '00';
    return `${base}:${sec}`;
  }

  goBack(): void {
    this.location.back();
  }

  continueToDashboard(): void {
    this.router.navigate(['/logistics/resources']);
  }

  /**
   * Télécharge le code-barres en tant que PDF
   */
  async downloadBarcodeAsPDF(): Promise<void> {
    if (!this.generatedBarcode) {
      this.toastService.error('Aucun code-barres à télécharger');
      return;
    }

    try {
      // Créer un conteneur temporaire pour le code-barres
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.padding = '20px';
      container.style.backgroundColor = 'white';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.gap = '20px';
      document.body.appendChild(container);

      // Créer le conteneur du code-barres
      const barcodeDiv = document.createElement('div');
      container.appendChild(barcodeDiv);

      // Générer le code-barres avec JsBarcode
      JsBarcode(barcodeDiv, this.generatedBarcode, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: false,
        margin: 10
      });

      // Capturer le conteneur avec html2canvas
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false
      });

      // Créer le PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'A4'
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 100;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageWidth = (pdf as any).internal.pageSize.getWidth();
      const pageHeight = (pdf as any).internal.pageSize.getHeight();
      const x = (pageWidth - imgWidth) / 2;
      const y = 40;

      // Ajouter titre
      pdf.setFontSize(16);
      pdf.setTextColor(40, 40, 40);
      pdf.text('Code-barres Ressource', pageWidth / 2, 20, { align: 'center' });

      // Ajouter l'image du code-barres
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

      // Ajouter le numéro du code-barres
      pdf.setFontSize(11);
      pdf.setFont('courier');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${this.generatedBarcode}`, pageWidth / 2, y + imgHeight + 15, { align: 'center' });

      // Ajouter la date
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Date: ${new Date().toLocaleDateString('fr-TN')} à ${new Date().toLocaleTimeString('fr-TN')}`, pageWidth / 2, pageHeight - 12, { align: 'center' });

      // Télécharger le PDF
      pdf.save(`barcode-${this.generatedBarcode}.pdf`);

      // Nettoyer
      document.body.removeChild(container);
      this.toastService.success('PDF téléchargé avec succès');
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      this.toastService.error('Erreur lors du téléchargement du PDF');
    }
  }

  // Validation helpers
  hasError(fieldName: string, errorType: string): boolean {
    const control = this.form.get(fieldName);
    return Boolean(control && control.hasError(errorType));
  }

  getFieldError(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control || !control.invalid) {
      return '';
    }

    if (fieldName === 'name') {
      if (control.hasError('required')) return 'Le nom est obligatoire';
      if (control.hasError('minlength')) return 'Minimum 5 caractères';
      if (control.hasError('startsWithCapital')) return 'Le nom doit commencer par une majuscule';
    }

    if (fieldName === 'description') {
      if (control.hasError('required')) return 'La description est obligatoire';
      if (control.hasError('minlength')) return 'Minimum 30 caractères';
    }

    if (fieldName === 'imageUrl') {
      if (control.hasError('required')) return 'L\'image est obligatoire (veuillez uploader une image)';
    }

    if (fieldName === 'notes') {
      if (control.hasError('required')) return 'Les notes sont obligatoires';
      if (control.hasError('minlength')) return 'Minimum 30 caractères';
    }

    if (fieldName === 'unitCost') {
      if (control.hasError('required')) return 'Le coût est obligatoire';
      if (control.hasError('min')) return 'Le coût doit être positif';
    }

    if (fieldName === 'quantityTotal') {
      if (control.hasError('required')) return 'La quantité totale est obligatoire';
      if (control.hasError('min')) return 'La quantité doit être positive';
    }

    if (fieldName === 'availableQuantity') {
      if (control.hasError('required')) return 'La quantité disponible est obligatoire';
      if (control.hasError('min')) return 'La quantité doit être positive';
    }

    if (fieldName === 'lowStockThreshold') {
      if (control.hasError('required')) return 'Le seuil est obligatoire';
      if (control.hasError('min')) return 'Le seuil doit être positif';
    }

    if (fieldName === 'lastUpdated') {
      if (control.hasError('required')) return 'La date est obligatoire';
      if (control.hasError('futureOrToday')) return 'La date doit être aujourd\'hui ou dans le futur';
    }

    if (fieldName === 'status') {
      if (control.hasError('required')) return 'Le statut est obligatoire';
    }

    if (this.form.hasError('quantityMismatch')) {
      if (fieldName === 'availableQuantity') {
        return 'La quantité disponible ne peut pas dépasser la quantité totale';
      }
    }

    return '';
  }

  private startsWithCapitalValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) return null; // required validator handles this
      return /^[A-Z]/.test(value) ? null : { startsWithCapital: true };
    };
  }

  private futureOrTodayValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) return null; // required validator handles this

      // Parse datetime-local string (YYYY-MM-DDTHH:mm) correctly
      // datetime-local values are interpreted as local time, not UTC
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!match) return null; // Invalid format, let other validator handle

      const [, yyyy, mm, dd] = match;
      const parsedDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      parsedDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return parsedDate.getTime() >= today.getTime() ? null : { futureOrToday: true };
    };
  }

  private quantityValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const group = control as any;
      const availableQty = Number(group.get?.('availableQuantity')?.value ?? 0);
      const totalQty = Number(group.get?.('quantityTotal')?.value ?? 0);

      return availableQty > totalQty ? { quantityMismatch: true } : null;
    };
  }
}
