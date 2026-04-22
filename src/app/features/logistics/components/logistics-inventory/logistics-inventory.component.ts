import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import {
  InventoryTransactionItem,
  InventoryTransactionType,
  LogisticsApiService,
  ResourceCreatePayload,
  ResourceItem
} from '../../services/logistics-api.service';

type InventoryItem = {
  sku: number;
  name: string;
  category: string;
  availableQuantity: number;
  quantityTotal: number;
  unitCost: number;
  imageUrl: string;
  lastUpdated: string;
  description: string;
  notes: string;
  min: number;
};

@Component({
  selector: 'app-logistics-inventory',
  templateUrl: './logistics-inventory.component.html',
  styleUrls: ['./logistics-inventory.component.scss']
})
export class LogisticsInventoryComponent {
  readonly defaultCategoryOptions: string[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];
  categoryOptions: string[] = [...this.defaultCategoryOptions];
  isLoading = true;
  hasError = false;
  isCreateOpen = false;
  isSubmitting = false;
  isDeleting = false;
  isUploadingImage = false;
  editingId: number | null = null;
  submitError = '';
  submitSuccess = '';
  imageUploadError = '';
  selectedImageName = '';

  items: InventoryItem[] = [];
  readonly clubId: number;

  isTransactionsOpen = false;
  isTransactionsLoading = false;
  isTransactionSubmitting = false;
  transactionsError = '';
  selectedResource: InventoryItem | null = null;
  transactions: InventoryTransactionItem[] = [];
  readonly transactionTypeOptions: InventoryTransactionType[] = ['ADD', 'REMOVE', 'UPDATE'];

  readonly resourceForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    category: ['AVAILABLE', [Validators.required]],
    quantityTotal: [0, [Validators.required, Validators.min(0)]],
    availableQuantity: [0, [Validators.required, Validators.min(0)]],
    minStock: [0, [Validators.required, Validators.min(0)]],
    unitCost: [0, [Validators.required, Validators.min(0)]],
    imageUrl: [''],
    lastUpdated: [''],
    description: [''],
    notes: ['']
  });

  readonly transactionForm = this.fb.group({
    type: ['ADD' as InventoryTransactionType, [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    date: ['', [Validators.required]],
    reason: ['']
  });

  constructor(
    private router: Router,
    private location: Location,
    private fb: FormBuilder,
    private authHelper: AuthHelperService,
    private logisticsApi: LogisticsApiService
  ) {
    this.clubId = this.authHelper.getClubId();
    this.load();
  }

  private toDateTimeLocalNow(): string {
    const now = new Date();
    const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }

  private load(): void {
    this.isLoading = true;
    this.hasError = false;
    this.logisticsApi.getResources().subscribe({
      next: (items: ResourceItem[]) => {
        this.items = items.map(i => ({
          sku: i.id,
          name: i.name,
          category: String(i.status || 'AVAILABLE'),
          availableQuantity: Number(i.availableQuantity ?? 0),
          quantityTotal: Number(i.quantityTotal ?? 0),
          unitCost: Number(i.unitCost ?? 0),
          imageUrl: i.imageUrl,
          lastUpdated: i.lastUpdated,
          description: i.description,
          notes: i.notes,
          min: i.lowStockThreshold
        }));
      },
      error: () => {
        this.hasError = true;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  openTransactions(item: InventoryItem): void {
    this.selectedResource = item;
    this.isTransactionsOpen = true;
    this.transactionsError = '';
    this.transactions = [];

    this.transactionForm.reset({
      type: 'ADD',
      quantity: 1,
      date: this.toDateTimeLocalNow(),
      reason: ''
    });

    this.loadTransactions(item.sku);
  }

  closeTransactions(): void {
    this.isTransactionsOpen = false;
    this.selectedResource = null;
    this.transactions = [];
    this.transactionsError = '';
  }

  private loadTransactions(resourceId: number): void {
    this.isTransactionsLoading = true;
    this.transactionsError = '';

    this.logisticsApi.getInventoryTransactionsByResource(resourceId).subscribe({
      next: (items) => {
        this.transactions = items;
      },
      error: (error) => {
        const backendMessage =
          error?.error?.message ||
          error?.error?.error ||
          error?.message ||
          '';
        this.transactionsError = backendMessage
          ? `Echec chargement transactions: ${backendMessage}`
          : 'Echec chargement transactions.';
      },
      complete: () => {
        this.isTransactionsLoading = false;
      }
    });
  }

  createTransaction(): void {
    if (!this.selectedResource) {
      this.transactionsError = 'Ressource non selectionnee.';
      return;
    }

    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    this.isTransactionSubmitting = true;
    this.transactionsError = '';

    const value = this.transactionForm.getRawValue();
    const payload = {
      type: value.type as InventoryTransactionType,
      quantity: Number(value.quantity),
      date: `${value.date}:00`,
      reason: String(value.reason || '').trim(),
      resourceId: Number(this.selectedResource.sku)
    };

    this.logisticsApi.createInventoryTransaction(payload).subscribe({
      next: () => {
        this.loadTransactions(this.selectedResource!.sku);
        this.load();
      },
      error: (error) => {
        const backendMessage =
          error?.error?.message ||
          error?.error?.error ||
          error?.message ||
          '';
        this.transactionsError = backendMessage
          ? `Echec creation transaction: ${backendMessage}`
          : 'Echec creation transaction.';
      },
      complete: () => {
        this.isTransactionSubmitting = false;
      }
    });
  }

  toggleCreate(): void {
    this.isCreateOpen = !this.isCreateOpen;
    this.submitError = '';
    this.submitSuccess = '';
    this.imageUploadError = '';

    if (!this.isCreateOpen) {
      this.resetFormState();
    }
  }

  private toDateTimeLocal(value?: string | null): string {
    if (!value) {
      return '';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    const offsetDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }

  private resetFormState(): void {
    this.editingId = null;
    this.categoryOptions = [...this.defaultCategoryOptions];
    this.selectedImageName = '';
    this.imageUploadError = '';
    this.resourceForm.reset({
      name: '',
      category: 'AVAILABLE',
      quantityTotal: 0,
      availableQuantity: 0,
      minStock: 0,
      unitCost: 0,
      imageUrl: '',
      lastUpdated: '',
      description: '',
      notes: ''
    });
  }

  private ensureCategoryOption(value: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return 'AVAILABLE';
    }

    if (!this.categoryOptions.includes(normalized)) {
      this.categoryOptions = [...this.categoryOptions, normalized];
    }

    return normalized;
  }

  editResource(item: InventoryItem): void {
    this.editingId = item.sku;
    this.submitError = '';
    this.submitSuccess = '';
    this.imageUploadError = '';
    this.selectedImageName = '';
    this.isCreateOpen = true;

    const categoryValue = this.ensureCategoryOption(item.category);

    this.resourceForm.patchValue({
      name: item.name,
      category: categoryValue,
      quantityTotal: item.quantityTotal,
      availableQuantity: item.availableQuantity,
      minStock: item.min,
      unitCost: item.unitCost,
      imageUrl: item.imageUrl || '',
      lastUpdated: this.toDateTimeLocal(item.lastUpdated),
      description: item.description || '',
      notes: item.notes || ''
    });
  }

  deleteResource(item: InventoryItem): void {
    const ok = window.confirm(`Supprimer la ressource "${item.name}" ?`);
    if (!ok) {
      return;
    }

    this.isDeleting = true;
    this.submitError = '';
    this.submitSuccess = '';

    this.logisticsApi.deleteResource(item.sku).subscribe({
      next: () => {
        this.submitSuccess = 'Ressource supprimee avec succes.';
        if (this.editingId === item.sku) {
          this.isCreateOpen = false;
          this.resetFormState();
        }
        this.load();
      },
      error: (error) => {
        const backendMessage =
          error?.error?.message ||
          error?.error?.error ||
          error?.message ||
          '';
        this.submitError = backendMessage
          ? `Echec suppression ressource: ${backendMessage}`
          : 'Echec suppression ressource.';
      },
      complete: () => {
        this.isDeleting = false;
      }
    });
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.imageUploadError = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.imageUploadError = 'Choisis un fichier image valide (png, jpg, webp...).';
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file, file.name);

    this.isUploadingImage = true;
    this.selectedImageName = file.name;

    this.logisticsApi.uploadResourceImage(formData).subscribe({
      next: (url: string) => {
        this.resourceForm.patchValue({ imageUrl: url });
      },
      error: (error) => {
        const backendMessage =
          error?.error?.message ||
          error?.error ||
          error?.message ||
          '';
        this.imageUploadError = backendMessage
          ? `Echec upload image: ${backendMessage}`
          : 'Echec upload image.';
      },
      complete: () => {
        this.isUploadingImage = false;
      }
    });
  }

  createResource(): void {
    if (this.resourceForm.invalid) {
      this.resourceForm.markAllAsTouched();
      return;
    }

    this.submitError = '';
    this.isSubmitting = true;
    const value = this.resourceForm.getRawValue();

    if (!this.clubId) {
      this.submitError = 'Club introuvable dans le token. Reconnecte-toi puis reessaie.';
      this.isSubmitting = false;
      return;
    }

    // Extract and normalize form values - NO id field
    const quantityTotal = Number(value.quantityTotal) || 0;
    const availableQuantity = Number(value.availableQuantity) || 0;
    const name = String(value.name).trim();
    const description = String(value.description).trim();
    const notes = String(value.notes).trim();
    const unitCost = Number(value.unitCost) || 0;
    const lowStockThreshold = Number(value.minStock) || 0;
    const imageUrl = String(value.imageUrl || '').trim();
    const lastUpdatedRaw = String(value.lastUpdated || '').trim();
    const lastUpdated = lastUpdatedRaw ? lastUpdatedRaw : null;
    const status = (value.category as ResourceCreatePayload['status']) || 'AVAILABLE';

    // Backend entity doesn't have `quantity`, but API may still expect it.
    // Keep it consistent by deriving it from `quantity_total`.
    const quantity = quantityTotal;

    // Build strict ResourceCreatePayload - only fields that service expects
    const payload: ResourceCreatePayload = {
      name,
      description,
      notes,
      status,
      quantity,
      quantityTotal,
      availableQuantity,
      lowStockThreshold,
      unitCost,
      clubId: this.clubId,
      imageUrl,
      lastUpdated
    };

    const request$ = this.editingId
      ? this.logisticsApi.updateResource(this.editingId, payload)
      : this.logisticsApi.createResource(payload);

    request$.subscribe({
      next: () => {
        this.submitSuccess = this.editingId
          ? 'Ressource modifiee avec succes.'
          : 'Ressource ajoutee avec succes.';
        this.isCreateOpen = false;
        this.resetFormState();
        this.load();
      },
      error: (error) => {
        const backendMessage =
          error?.error?.message ||
          error?.error?.error ||
          error?.message ||
          '';
        this.submitError = backendMessage
          ? `${this.editingId ? 'Echec modification ressource' : 'Echec creation ressource'}: ${backendMessage}`
          : `Echec ${this.editingId ? 'de modification' : 'de creation'} de la ressource.`;
      },
      complete: () => {
        this.isSubmitting = false;
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

  isLowStock(i: InventoryItem): boolean {
    return i.availableQuantity < i.min;
  }
}

