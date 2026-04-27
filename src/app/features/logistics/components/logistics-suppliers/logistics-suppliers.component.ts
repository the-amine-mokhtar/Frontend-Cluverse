import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LogisticsApiService, VehicleCreatePayload, VehicleItem } from '../../services/logistics-api.service';

type VehicleView = {
  id: number;
  plateNumber: string;
  model: string;
  available: boolean;
};

@Component({
  selector: 'app-logistics-suppliers',
  templateUrl: './logistics-suppliers.component.html',
  styleUrls: ['./logistics-suppliers.component.scss']
})
export class LogisticsSuppliersComponent {
  isLoading = true;
  hasError = false;
  isCreateOpen = false;
  isSubmitting = false;
  isDeleting = false;
  editingId: number | null = null;
  submitError = '';
  submitSuccess = '';

  vehicles: VehicleView[] = [];

  readonly vehicleForm = this.fb.group({
    model: ['', [Validators.required, Validators.minLength(2)]],
    plateNumber: ['', [Validators.required, Validators.minLength(2)]],
    available: [true]
  });

  constructor(
    private router: Router,
    private location: Location,
    private fb: FormBuilder,
    private logisticsApi: LogisticsApiService
  ) {
    this.loadVehicles();
  }

  private loadVehicles(): void {
    this.isLoading = true;
    this.hasError = false;

    this.logisticsApi.getVehicles().subscribe({
      next: (items: VehicleItem[]) => {
        this.vehicles = items;
      },
      error: () => {
        this.hasError = true;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  toggleCreate(): void {
    this.isCreateOpen = !this.isCreateOpen;
    if (!this.isCreateOpen) {
      this.resetFormState();
    }
    this.submitError = '';
  }

  private resetFormState(): void {
    this.vehicleForm.reset({ model: '', plateNumber: '', available: true });
    this.editingId = null;
    this.submitError = '';
  }

  editVehicle(vehicle: VehicleView): void {
    this.editingId = vehicle.id;
    this.isCreateOpen = true;
    this.submitError = '';
    this.submitSuccess = '';
    this.vehicleForm.patchValue({
      model: vehicle.model,
      plateNumber: vehicle.plateNumber,
      available: vehicle.available
    });
  }

  cancelForm(): void {
    this.isCreateOpen = false;
    this.resetFormState();
  }

  saveVehicle(): void {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }

    this.submitError = '';
    this.submitSuccess = '';
    this.isSubmitting = true;

    const value = this.vehicleForm.getRawValue();
    const payload: VehicleCreatePayload = {
      model: String(value.model || '').trim(),
      plateNumber: String(value.plateNumber || '').trim(),
      available: Boolean(value.available)
    };

    const request = this.editingId
      ? this.logisticsApi.updateVehicle(this.editingId, payload)
      : this.logisticsApi.createVehicle(payload);

    request.subscribe({
      next: () => {
        const action = this.editingId ? 'modifie' : 'ajoute';
        this.submitSuccess = `Vehicule ${action} avec succes.`;
        this.isCreateOpen = false;
        this.resetFormState();
        this.loadVehicles();
      },
      error: () => {
        this.submitError = this.editingId
          ? 'Echec de modification du vehicule. Verifie les champs ou le backend.'
          : 'Echec de creation du vehicule. Verifie les champs ou le backend.';
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  deleteVehicle(vehicle: VehicleView): void {
    const confirmed = window.confirm(
      `Supprimer le vehicule \"${vehicle.model}\" (ID ${vehicle.id}) ?\n\nCette action est irreversible.`
    );
    if (!confirmed) {
      return;
    }

    this.isDeleting = true;
    this.submitError = '';
    this.submitSuccess = '';

    this.logisticsApi.deleteVehicle(vehicle.id).subscribe({
      next: () => {
        this.submitSuccess = 'Vehicule supprime avec succes.';
        if (this.editingId === vehicle.id) {
          this.cancelForm();
        }
        this.loadVehicles();
      },
      error: () => {
        this.submitError = 'Echec de suppression du vehicule. Verifie les dependances ou le backend.';
      },
      complete: () => {
        this.isDeleting = false;
      }
    });
  }

  back(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    const fallback = this.router.url.startsWith('/logistics')
      ? '/logistics'
      : '/dashboard/logistics';
    void this.router.navigateByUrl(fallback);
  }
}

