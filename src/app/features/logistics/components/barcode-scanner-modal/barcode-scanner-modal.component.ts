import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import Quagga from 'quagga';
import { Resource } from '../../models/resource.model';
import { ResourceService } from '../../services/resource.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-barcode-scanner-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './barcode-scanner-modal.component.html',
  styleUrl: './barcode-scanner-modal.component.scss'
})
export class BarcodeScannerModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scannerContainer') scannerContainer!: ElementRef<HTMLDivElement>;
  @Output() resourceFound = new EventEmitter<Resource>();
  @Output() closed = new EventEmitter<void>();

  isScanning = false;
  isInitializing = true;
  isSearching = false;
  scannedResource: Resource | null = null;
  errorMessage: string | null = null;
  resourceNotFound = false;
  lastScannedCode: string = '';

  constructor(
    private resourceService: ResourceService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.isInitializing = true;
  }

  ngAfterViewInit(): void {
    // Attendre que le DOM soit complètement prêt
    setTimeout(() => {
      this.startScanning();
    }, 100);
  }

  async startScanning(): Promise<void> {
    try {
      this.errorMessage = null;
      this.resourceNotFound = false;
      this.isInitializing = true;
      this.isScanning = false;

      // Vérifier que le container existe
      if (!this.scannerContainer?.nativeElement) {
        this.errorMessage = 'Container du scanner non trouvé. Veuillez recharger la page.';
        this.isInitializing = false;
        this.toastService.error(this.errorMessage || 'Erreur inconnue');
        return;
      }

      // Vérifier la disponibilité de la caméra
      if (!navigator.mediaDevices?.getUserMedia) {
        this.errorMessage = 'Votre navigateur ne supporte pas l\'accès à la caméra.';
        this.isInitializing = false;
        this.toastService.error(this.errorMessage || 'Erreur inconnue');
        return;
      }

      console.log('Initialisation Quagga...');
      Quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            constraints: {
              width: { min: 640, ideal: 1920 },
              height: { min: 480, ideal: 1080 },
              facingMode: 'environment'
            },
            target: this.scannerContainer.nativeElement
          },
          decoder: {
            // ✅ CORRIGÉ: Ne lire que CODE128 pour éviter les faux positifs
            readers: ['code_128_reader'],
            debug: {
              showCanvas: false,
              showPatternLabel: false,
              showLines: false,
              showDecoders: false
            }
          },
          locate: true,
          orientation: 'landscape',
          frequency: 30,
          numOfWorkers: 8,
          willReadFrequently: true
        },
        (error: any) => {
          if (error) {
            console.error('Erreur Quagga init:', error);
            this.errorMessage = 'Impossible d\'accéder à la caméra';
            if (error.name === 'NotAllowedError') {
              this.errorMessage = 'Permission refusée. Veuillez autoriser l\'accès à la caméra.';
            } else if (error.name === 'NotFoundError') {
              this.errorMessage = 'Aucune caméra détectée sur cet appareil.';
            }
            this.isInitializing = false;
            this.toastService.error(this.errorMessage || 'Erreur de caméra');
          } else {
            console.log('Quagga initialisé avec succès');
            Quagga.start();
            this.isInitializing = false;
            this.isScanning = true;
            this.attachDetectionListeners();
          }
        }
      );
    } catch (error: any) {
      console.error('Exception lors du démarrage du scanner:', error);
      this.errorMessage = error?.message || 'Erreur lors du démarrage du scanner.';
      this.isInitializing = false;
      this.toastService.error(this.errorMessage || 'Erreur inconnue');
    }
  }

  private attachDetectionListeners(): void {
    Quagga.onDetected((result: any) => {
      if (result && result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;

        // ✅ VALIDATION: Vérifier que le barcode est au bon format (RES-*)
        if (!this.isValidBarcode(code)) {
          console.warn('⚠️ Barcode invalide rejeté:', code);
          this.toastService.error(`Code-barres invalide: ${code}. Scannez un code valide (RES-*)`);
          this.lastScannedCode = ''; // Reset pour permettre un nouveau scan
          return;
        }

        // Éviter les scans en doublon rapides
        if (code !== this.lastScannedCode) {
          this.lastScannedCode = code;
          this.searchByBarcode(code);
        }
      }
    });
  }

  /**
   * ✅ NOUVEAU: Valide que le barcode a le bon format
   * Format attendu: RES-XXXXXXXXXXXXXXX (commence par RES-)
   */
  private isValidBarcode(barcode: string): boolean {
    if (!barcode || barcode.length < 4) {
      console.warn('Barcode trop court:', barcode);
      return false;
    }
    
    // Le barcode doit commencer par "RES-"
    const isValid = barcode.startsWith('RES-');
    console.log(`Validation barcode '${barcode}': ${isValid ? '✅ OK' : '❌ INVALIDE'}`);
    return isValid;
  }

  private searchByBarcode(barcode: string): void {
    this.isScanning = false;
    this.isSearching = true;
    this.resourceNotFound = false;
    console.log('🔍 Recherche du code-barres:', barcode);
    
    this.resourceService.getByBarcode(barcode).subscribe({
      next: (resource: Resource) => {
        console.log('✅ Ressource trouvée:', resource);
        this.resourceFound.emit(resource);
        this.toastService.success(`Ressource trouvée : ${resource.name}`);
        // ✅ FERMER LE MODAL IMMÉDIATEMENT (sans afficher le résultat dans le modal)
        setTimeout(() => {
          this.closeModal();
        }, 50);
      },
      error: (error) => {
        console.error('❌ Ressource non trouvée pour barcode:', barcode, error);
        this.resourceNotFound = true;
        this.scannedResource = null;
        this.isSearching = false;
        this.errorMessage = `Barcode '${barcode}' non trouvé`;
        // ✅ Au lieu de fermer, on réessaye le scanning
        this.toastService.error('Code-barres non trouvé. Réessayez.');
        this.resumeScanning();
      }
    });
  }

  private resumeScanning(): void {
    setTimeout(() => {
      this.isScanning = true;
      this.resourceNotFound = false;
      this.lastScannedCode = '';
    }, 2000);
  }

  retryScanning(): void {
    this.errorMessage = null;
    this.resourceNotFound = false;
    this.scannedResource = null;
    this.isScanning = true;
    this.lastScannedCode = '';
  }

  ngOnDestroy(): void {
    this.stopScanning();
  }

  stopScanning(): void {
    this.isScanning = false;
    try {
      Quagga.stop();
    } catch (error) {
      console.error('Erreur lors de l\'arrêt du scanner:', error);
    }
  }

  closeModal(): void {
    this.stopScanning();
    this.closed.emit();
  }

  resetScan(): void {
    this.scannedResource = null;
    this.errorMessage = null;
    this.resourceNotFound = false;
    this.isSearching = false;
    this.lastScannedCode = '';
    this.isScanning = true;
  }
}
