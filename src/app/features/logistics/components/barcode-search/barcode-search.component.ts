import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarcodeScannerModalComponent } from '../barcode-scanner-modal/barcode-scanner-modal.component';
import { BackButtonComponent } from '../../shared/back-button.component';
import { Resource } from '../../models/resource.model';

@Component({
  selector: 'app-barcode-search',
  standalone: true,
  imports: [CommonModule, BarcodeScannerModalComponent, BackButtonComponent],
  templateUrl: './barcode-search.component.html',
  styleUrl: './barcode-search.component.scss'
})
export class BarcodeSearchComponent implements OnInit {
  showScanner = true; // ✅ OUVERT PAR DÉFAUT
  foundResource: Resource | null = null;

  ngOnInit(): void {
    // Scanner lance directement sans page d'instructions
  }

  onOpenScanner(): void {
    this.showScanner = true;
  }

  onResourceFound(resource: Resource): void {
    this.foundResource = resource;
  }

  onScannerClosed(): void {
    this.showScanner = false;
  }

  resetSearch(): void {
    this.foundResource = null;
    this.showScanner = false;
  }
}
