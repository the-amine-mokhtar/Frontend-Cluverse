import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { defaultIfEmpty } from 'rxjs/operators';

import { Resource } from '../models/resource.model';
import {
  InventoryTransaction,
  InventoryTransactionCreatePayload,
  InventoryTransactionType
} from '../models/inventory-transaction.model';

import { ResourceService } from '../services/resource.service';
import { InventoryService } from '../services/inventory.service';

import {
  RESOURCE_STATUS_LABELS,
  INVENTORY_TYPE_LABELS,
  getStatusBadgeClasses
} from '../utils/status-labels';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html'
})
export class InventoryComponent implements OnInit {
  resourceId = 0;

  loadingResource = false;
  loadingTransactions = false;
  isSubmitting = false;

  errorMessage: string | null = null;
  formError: string | null = null;

  resource: Resource | null = null;
  transactions: InventoryTransaction[] = [];

  readonly resourceStatusLabels = RESOURCE_STATUS_LABELS;
  readonly inventoryTypeLabels = INVENTORY_TYPE_LABELS;
  readonly getStatusBadgeClasses = getStatusBadgeClasses;
  readonly typeOptions: InventoryTransactionType[] = ['ADD', 'REMOVE', 'UPDATE'];

  form = this.fb.group({
    type: ['ADD' as InventoryTransactionType, [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    reason: ['', [Validators.required, Validators.minLength(3)]]
  });

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private location: Location,
    private resourceService: ResourceService,
    private inventoryService: InventoryService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('resourceId');
    this.resourceId = Number(idParam ?? 0);

    if (!this.resourceId) {
      this.errorMessage = 'Ressource introuvable.';
      return;
    }

    this.load();
  }

  load(): void {
    this.errorMessage = null;

    this.loadingResource = true;
    this.loadingTransactions = true;

    forkJoin({
      resource: this.resourceService.getById(this.resourceId).pipe(defaultIfEmpty(null)),
      transactions: this.inventoryService.getByResource(this.resourceId)
    }).subscribe({
      next: ({ resource, transactions }) => {
        this.resource = resource;
        this.transactions = this.sortTransactions(transactions);

        if (!this.resource) {
          this.errorMessage = 'Impossible de charger la ressource.';
        }

        this.loadingResource = false;
        this.loadingTransactions = false;
      },
      error: (error) => {
        console.error('[InventoryComponent] load failed', error);
        this.errorMessage = 'Impossible de charger l\'inventaire.';
        this.resource = null;
        this.transactions = [];
        this.loadingResource = false;
        this.loadingTransactions = false;
      }
    });
  }

  isLowStock(resource: Resource): boolean {
    return Number(resource.availableQuantity) <= Number(resource.lowStockThreshold);
  }

  quantityLabel(tx: InventoryTransaction): { text: string; classes: string } {
    const qty = Number(tx.quantity);

    if (tx.type === 'ADD') {
      return { text: `+${qty}`, classes: 'text-green-700 font-medium' };
    }

    if (tx.type === 'REMOVE') {
      return { text: `-${qty}`, classes: 'text-red-700 font-medium' };
    }

    return { text: `~${qty}`, classes: 'text-orange-700 font-medium' };
  }

  submit(): void {
    this.formError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.value;

    const payload: InventoryTransactionCreatePayload = {
      type: value.type as InventoryTransactionType,
      quantity: Number(value.quantity),
      reason: String(value.reason ?? '').trim(),
      resourceId: this.resourceId,
      // LocalDateTime friendly ISO without timezone
      date: new Date().toISOString().slice(0, 19)
    };

    this.isSubmitting = true;

    this.inventoryService.create(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.form.reset({ type: 'ADD', quantity: 1, reason: '' });
        this.refresh();
      },
      error: (error) => {
        console.error('[InventoryComponent] create failed', error);
        this.formError = 'Impossible d\'enregistrer la transaction.';
        this.isSubmitting = false;
      }
    });
  }

  refresh(): void {
    // Refresh both summary + transactions after create.
    this.loadingResource = true;
    this.loadingTransactions = true;

    forkJoin({
      resource: this.resourceService.getById(this.resourceId).pipe(defaultIfEmpty(null)),
      transactions: this.inventoryService.getByResource(this.resourceId)
    }).subscribe({
      next: ({ resource, transactions }) => {
        this.resource = resource;
        this.transactions = this.sortTransactions(transactions);
        this.loadingResource = false;
        this.loadingTransactions = false;
      },
      error: (error) => {
        console.error('[InventoryComponent] refresh failed', error);
        this.loadingResource = false;
        this.loadingTransactions = false;
      }
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return Boolean(control && control.invalid && control.touched);
  }

  private sortTransactions(items: InventoryTransaction[]): InventoryTransaction[] {
    const list = Array.isArray(items) ? [...items] : [];
    return list.sort((a, b) => this.toTime(b.date) - this.toTime(a.date));
  }

  private toTime(value: unknown): number {
    if (!value) {
      return 0;
    }

    const text = String(value).trim();
    if (!text) {
      return 0;
    }

    const time = new Date(text).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  goBack(): void {
    this.location.back();
  }
}
