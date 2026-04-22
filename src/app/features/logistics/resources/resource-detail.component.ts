import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';

import { Resource } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { RESOURCE_STATUS_LABELS, getStatusBadgeClasses } from '../utils/status-labels';

@Component({
  selector: 'app-resource-detail',
  templateUrl: './resource-detail.component.html'
})
export class ResourceDetailComponent implements OnInit {
  loading = false;
  isDeleting = false;
  errorMessage: string | null = null;

  resourceId = 0;
  resource: Resource | null = null;

  readonly statusLabels = RESOURCE_STATUS_LABELS;
  readonly getStatusBadgeClasses = getStatusBadgeClasses;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private resourceService: ResourceService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.resourceId = Number(idParam ?? 0);

    if (!this.resourceId) {
      this.errorMessage = 'Ressource introuvable.';
      return;
    }

    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    this.resource = null;

    this.resourceService.getById(this.resourceId).subscribe({
      next: (resource) => {
        this.resource = resource;
        this.loading = false;
        // Générer le code-barres après que la ressource soit chargée
        setTimeout(() => this.generateBarcode(), 100);
      },
      error: (error) => {
        console.error('[ResourceDetailComponent] load failed', error);
        this.errorMessage = 'Impossible de charger la ressource.';
        this.loading = false;
      }
    });
  }

  isLowStock(resource: Resource): boolean {
    return Number(resource.availableQuantity) <= Number(resource.lowStockThreshold);
  }

  getInitials(name: string): string {
    const cleaned = (name ?? '').trim();
    if (!cleaned) {
      return '?';
    }

    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1]?.[0] ?? '' : (parts[0]?.[1] ?? '');
    return (first + second).toUpperCase();
  }

  progressPercent(resource: Resource): number {
    const total = Number(resource.quantityTotal);
    const available = Number(resource.availableQuantity);

    if (!Number.isFinite(total) || total <= 0) {
      return 0;
    }

    const ratio = (Number.isFinite(available) ? available : 0) / total;
    const percent = Math.max(0, Math.min(100, ratio * 100));
    return percent;
  }

  progressBarColor(resource: Resource): string {
    const available = Number(resource.availableQuantity);
    if (!Number.isFinite(available) || available <= 0) {
      return 'bg-red-500';
    }

    return this.isLowStock(resource) ? 'bg-orange-500' : 'bg-green-500';
  }

  unitCostValue(resource: Resource): number | null {
    const raw: any = resource as any;
    const value = raw?.unitCost ?? raw?.unit_cost ?? raw?.unitcost;
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
      const n = Number(normalized);
      return Number.isFinite(n) ? n : null;
    }

    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  unitCostText(resource: Resource): string {
    const raw: any = resource as any;
    const value = raw?.unitCost ?? raw?.unit_cost ?? raw?.unitcost;
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    const n = this.unitCostValue(resource);
    if (n === null) {
      return String(value);
    }

    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  lastUpdatedValue(resource: Resource): Date | null {
    const raw: any = resource as any;
    const value = raw?.lastUpdated ?? raw?.last_updated ?? raw?.lastupdated;
    if (!value) {
      return null;
    }

    // Accept ISO string, timestamp, or Date.
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value : null;
    }

    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isFinite(d.getTime()) ? d : null;
    }

    const s = String(value).trim();
    if (!s) {
      return null;
    }

    // Backend uses LocalDateTime (no timezone). Parse as local time to avoid UTC shift.
    const localMatch = s.match(
      /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (localMatch) {
      const year = Number(localMatch[1]);
      const month = Number(localMatch[2]);
      const day = Number(localMatch[3]);
      const hour = Number(localMatch[4]);
      const minute = Number(localMatch[5]);
      const second = Number(localMatch[6] ?? 0);
      const dLocal = new Date(year, month - 1, day, hour, minute, second);
      return Number.isFinite(dLocal.getTime()) ? dLocal : null;
    }

    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  delete(): void {
    if (!this.resource) {
      return;
    }

    const ok = confirm(`Supprimer la ressource "${this.resource.name}" ?`);
    if (!ok) {
      return;
    }

    this.isDeleting = true;
    this.errorMessage = null;

    this.resourceService.delete(this.resourceId).subscribe({
      next: () => {
        this.router.navigate(['/logistics/resources']);
      },
      error: (error) => {
        console.error('[ResourceDetailComponent] delete failed', error);
        this.errorMessage = 'Impossible de supprimer la ressource.';
        this.isDeleting = false;
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  /**
   * Génère visuellement le code-barres pour la ressource
   */
  private generateBarcode(): void {
    if (!this.resource || !this.resource.barcode) {
      return;
    }

    try {
      const elementId = `barcode-${this.resource.id}`;
      const element = document.getElementById(elementId);
      
      if (element) {
        JsBarcode(`#${elementId}`, this.resource.barcode, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: false,
          margin: 10
        });
      }
    } catch (error) {
      console.error('Erreur lors de la génération du code-barres:', error);
    }
  }

  /**
   * Télécharge le code-barres en tant que PDF
   */
  downloadBarcode(): void {
    if (!this.resource || !this.resource.barcode) {
      return;
    }

    try {
      const resource = this.resource;
      const canvas = document.createElement('canvas');

      // Générer un code-barres directement sur canvas
      JsBarcode(canvas, resource.barcode, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: false,
        margin: 10,
        background: '#ffffff'
      });

      const imgDataUrl = canvas.toDataURL('image/png');

      // Créer le PDF
      const pdf = new jsPDF('p', 'mm', 'A4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Ajouter le titre
      pdf.setFontSize(18);
      pdf.setTextColor(40, 40, 40);
      pdf.text('Code-barres Ressource', pageWidth / 2, 20, { align: 'center' });

      // Ajouter le nom
      pdf.setFontSize(12);
      pdf.setTextColor(60, 60, 60);
      pdf.text(`${resource.name}`, pageWidth / 2, 32, { align: 'center' });

      // Ajouter le code-barres image
      const barcodeWidth = 100;
      const barcodeHeight = (canvas.height * barcodeWidth) / canvas.width;
      const barcodeX = (pageWidth - barcodeWidth) / 2;
      const barcodeY = 45;

      pdf.addImage(imgDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);

      // Ajouter le numéro de code en texte
      pdf.setFontSize(11);
      pdf.setFont('courier');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${resource.barcode}`, pageWidth / 2, barcodeY + barcodeHeight + 15, { align: 'center' });

      // Ajouter les infos supplémentaires
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Date: ${new Date().toLocaleDateString('fr-TN')} à ${new Date().toLocaleTimeString('fr-TN')}`, pageWidth / 2, pageHeight - 12, { align: 'center' });

      // Sauvegarder le PDF
      const safeName = resource.name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
      const filename = `code-barres-${safeName}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Erreur lors du téléchargement du code-barres:', error);
      alert('Erreur: impossible de générer le PDF. Vérifiez la console pour plus de détails.');
    }
  }
}
