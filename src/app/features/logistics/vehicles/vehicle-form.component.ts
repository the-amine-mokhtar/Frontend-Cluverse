import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { defaultIfEmpty } from 'rxjs/operators';

import { Vehicle } from '../models/vehicle.model';
import { VehicleService } from '../services/vehicle.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-vehicle-form',
  templateUrl: './vehicle-form.component.html'
})
export class VehicleFormComponent implements OnInit {
  pageTitle = 'Nouveau véhicule';

  loading = false;
  isSubmitting = false;
  errorMessage: string | null = null;

  isEditMode = false;
  vehicleId: number | null = null;

  form = this.fb.group({
    plateNumber: ['', [Validators.required, this.tunisianPlateValidator()]],
    model: ['', [Validators.required, Validators.minLength(3)]],
    available: [true, [Validators.required]]
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private vehicleService: VehicleService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.isEditMode = Boolean(idParam);
    this.vehicleId = idParam ? Number(idParam) : null;

    if (this.isEditMode && this.vehicleId) {
      this.pageTitle = 'Modifier le véhicule';
      this.loadForEdit(this.vehicleId);
      return;
    }

    this.pageTitle = 'Nouveau véhicule';
  }

  get availableValue(): boolean {
    return Boolean(this.form.get('available')?.value);
  }

  toggleAvailable(): void {
    const control = this.form.get('available');
    if (!control) {
      return;
    }

    control.setValue(!Boolean(control.value));
    control.markAsDirty();
    control.markAsTouched();
  }

  private loadForEdit(id: number): void {
    this.loading = true;
    this.errorMessage = null;

    this.vehicleService
      .getById(id)
      .pipe(defaultIfEmpty(null))
      .subscribe({
        next: (vehicle: Vehicle | null) => {
          if (!vehicle) {
            this.errorMessage = 'Impossible de charger le véhicule.';
            this.loading = false;
            return;
          }

          this.form.patchValue({
            plateNumber: vehicle.plateNumber,
            model: vehicle.model,
            available: Boolean(vehicle.available)
          });

          this.loading = false;
        },
        error: (error) => {
          console.error('[VehicleFormComponent] loadForEdit failed', error);
          this.errorMessage = 'Impossible de charger le véhicule.';
          this.loading = false;
        }
      });
  }

  submit(): void {
    this.errorMessage = null;
    console.log('[VehicleFormComponent] submit() called', {
      formValid: this.form.valid,
      formInvalid: this.form.invalid,
      platformNumber: this.form.get('plateNumber')?.value,
      model: this.form.get('model')?.value,
      available: this.form.get('available')?.value
    });

    if (this.form.invalid) {
      const errors = this.buildDetailedErrorMessage();
      this.errorMessage = errors;
      console.warn('[VehicleFormComponent] Form is invalid:', errors);
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      plateNumber: String(this.form.value.plateNumber ?? '').trim(),
      model: String(this.form.value.model ?? '').trim(),
      available: Boolean(this.form.value.available)
    } as Partial<Vehicle>;

    console.log('[VehicleFormComponent] Submitting payload:', payload);
    this.isSubmitting = true;

    if (this.isEditMode && this.vehicleId) {
      let didEmit = false;

      this.vehicleService.update(this.vehicleId, payload).subscribe({
        next: () => {
          didEmit = true;
          console.log('[VehicleFormComponent] update succeeded');
          this.toastService.success('Véhicule mis à jour avec succès');
          this.isSubmitting = false;
          this.router.navigate(['/logistics/vehicles', this.vehicleId]);
        },
        error: (error) => {
          didEmit = true;
          console.error('[VehicleFormComponent] update failed', error);
          this.errorMessage = 'Impossible d\'enregistrer les modifications.';
          this.toastService.error('Erreur lors de la mise à jour');
          this.isSubmitting = false;
        },
        complete: () => {
          if (!didEmit) {
            this.errorMessage = 'Impossible d\'enregistrer les modifications.';
            this.isSubmitting = false;
          }
        }
      });

      return;
    }

    let didEmit = false;

    this.vehicleService.create(payload).subscribe({
      next: () => {
        didEmit = true;
        console.log('[VehicleFormComponent] create succeeded');
        this.toastService.success('Véhicule créé avec succès');
        this.isSubmitting = false;
        this.router.navigate(['/logistics/vehicles']);
      },
      error: (error) => {
        didEmit = true;
        console.error('[VehicleFormComponent] create failed', error);
        this.errorMessage = 'Impossible de créer le véhicule.';
        this.toastService.error('Erreur lors de la création');
        this.isSubmitting = false;
      },
      complete: () => {
        if (!didEmit) {
          this.errorMessage = 'Impossible de créer le véhicule.';
          this.isSubmitting = false;
        }
      }
    });
  }

  private buildDetailedErrorMessage(): string {
    const errors: string[] = [];

    const plateCtrl = this.form.get('plateNumber');
    if (plateCtrl?.invalid) {
      if (plateCtrl.hasError('required')) {
        errors.push('• Immatriculation: champ obligatoire');
      } else if (plateCtrl.hasError('invalidPlate')) {
        errors.push('• Immatriculation: format invalide (XXX TU XXXX)');
      }
    }

    const modelCtrl = this.form.get('model');
    if (modelCtrl?.invalid) {
      if (modelCtrl.hasError('required')) {
        errors.push('• Modèle: champ obligatoire');
      } else if (modelCtrl.hasError('minlength')) {
        errors.push('• Modèle: minimum 3 caractères');
      }
    }

    const availableCtrl = this.form.get('available');
    if (availableCtrl?.invalid) {
      if (availableCtrl.hasError('required')) {
        errors.push('• Disponibilité: champ obligatoire');
      }
    }

    if (errors.length === 0) {
      return 'Erreur dans le formulaire.';
    }

    return 'Veuillez corriger les erreurs:\n' + errors.join('\n');
  }

  cancel(): void {
    if (this.isEditMode && this.vehicleId) {
      this.router.navigate(['/logistics/vehicles', this.vehicleId]);
      return;
    }

    this.router.navigate(['/logistics/vehicles']);
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return Boolean(control && control.invalid && control.touched);
  }

  getFieldError(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control || !control.invalid) {
      return '';
    }

    if (fieldName === 'plateNumber') {
      if (control.hasError('required')) return 'L\'immatriculation est obligatoire';
      if (control.hasError('invalidPlate')) return 'Format invalide: XXX TU XXXX (ex: 123 TU 1234)';
    }

    if (fieldName === 'model') {
      if (control.hasError('required')) return 'Le modèle est obligatoire';
      if (control.hasError('minlength')) return 'Minimum 3 caractères';
    }

    if (fieldName === 'available') {
      if (control.hasError('required')) return 'La disponibilité est obligatoire';
    }

    return '';
  }

  private tunisianPlateValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) return null; // required validator handles this

      // Format: XXX TU XXXX (3 digits, space, 2 letters, space, 4 digits)
      const pattern = /^\d{3}\s[A-Z]{2}\s\d{4}$/;
      return pattern.test(value) ? null : { invalidPlate: true };
    };
  }

  errorForPlateNumber(): string {
    const control = this.form.get('plateNumber');
    if (!control) {
      return '';
    }
    if (control.hasError('required')) {
      return "L'immatriculation est obligatoire";
    }
    if (control.hasError('invalidPlate')) {
      return 'Format invalide: XXX TU XXXX';
    }
    return 'Champ invalide';
  }

  errorForModel(): string {
    const control = this.form.get('model');
    if (!control) {
      return '';
    }
    if (control.hasError('required')) {
      return 'Le modèle est obligatoire';
    }
    if (control.hasError('minlength')) {
      return 'Minimum 3 caractères';
    }
    return 'Champ invalide';
  }

  goBack(): void {
    this.location.back();
  }
}
