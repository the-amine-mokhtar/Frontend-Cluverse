import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { MaintenanceService, VehicleMaintenanceRecord, MaintenancePredictionResponse } from '../services/maintenance.service';
import { VehicleService } from '../services/vehicle.service';
import { Vehicle } from '../models/vehicle.model';
import { forkJoin } from 'rxjs';
import { defaultIfEmpty } from 'rxjs/operators';

@Component({
  selector: 'app-vehicle-maintenance',
  templateUrl: './vehicle-maintenance.component.html'
})
export class VehicleMaintenanceComponent implements OnInit {
  vehicleId = 0;
  vehicle: Vehicle | null = null;

  loadingVehicle = false;
  loadingHistory = false;
  submitting = false;
  predictingRisk = false;

  errorMessage: string | null = null;

  // Form data
  recordDate = new Date().toISOString().split('T')[0];
  fuelLevel = 80;
  engineCondition = 85;
  tireCondition = 80;
  brakeCondition = 85;
  oilLevel = 75;
  mileage = 0;
  kmSinceLastService = 0;
  daysSinceLastService = 0;
  totalTransports = 0;
  notes = '';
  
  // Store initial values to prevent recalculation
  initialDaysSinceLastService = 0;
  initialTotalTransports = 0;

  /**
   * Initialize all vehicle condition fields from last maintenance record
   * These are the baseline to compare against for new maintenance entry
   */
  initializeConditionFields(lastRecord?: VehicleMaintenanceRecord): void {
    if (lastRecord) {
      // Load from last maintenance record
      this.engineCondition = lastRecord.engineCondition || 85;
      this.tireCondition = lastRecord.tireCondition || 80;
      this.brakeCondition = lastRecord.brakeCondition || 85;
      this.oilLevel = lastRecord.oilLevel || 75;
      console.log('[VehicleMaintenanceComponent] Loaded condition fields from last record:', {
        engineCondition: this.engineCondition,
        tireCondition: this.tireCondition,
        brakeCondition: this.brakeCondition,
        oilLevel: this.oilLevel
      });
    } else {
      // Reset to defaults if no previous record
      this.engineCondition = 85;
      this.tireCondition = 80;
      this.brakeCondition = 85;
      this.oilLevel = 75;
      console.log('[VehicleMaintenanceComponent] No previous record - using default condition values');
    }
  }

  /**
   * Synchronize fuel level from current vehicle state
   * This reflects the actual fuel in the tank after all transports
   */
  updateFuelLevelFromVehicle(): void {
    if (this.vehicle) {
      this.fuelLevel = Math.round(this.vehicle.fuelLevel || 0);
      console.log('[VehicleMaintenanceComponent] Updated fuel level from vehicle:', this.fuelLevel + '%');
    }
  }

  /**
   * Convert recordDate to full ISO DateTime string for backend
   * Frontend stores only date (YYYY-MM-DD), but backend needs LocalDateTime (YYYY-MM-DDTHH:mm:ss)
   */
  getRecordDateAsDateTime(): string {
    if (this.recordDate.includes('T')) {
      return this.recordDate; // Already full datetime
    }
    // Convert YYYY-MM-DD to YYYY-MM-DDTHH:mm:ss
    return `${this.recordDate}T${new Date().toTimeString().slice(0, 8)}`;
  }

  /**
   * Apply degradation to vehicle components based on kilometers since last service
   * Simulates realistic wear and tear
   * - Engine: -5 points per 10,000 km
   * - Tires: -4 points per 10,000 km
   * - Brakes: -3 points per 10,000 km
   * - Oil: -8 points per 10,000 km (degrades faster)
   */
  applyKilometrageDegradation(): void {
    const kmInterval = 10000; // Degradation interval
    const intervals = Math.floor(this.kmSinceLastService / kmInterval);

    if (intervals > 0) {
      // Engine: -5 points per 10000 km
      const engineDegradation = intervals * 5;
      this.engineCondition = Math.max(20, this.engineCondition - engineDegradation);

      // Tires: -4 points per 10000 km
      const tireDegradation = intervals * 4;
      this.tireCondition = Math.max(20, this.tireCondition - tireDegradation);

      // Brakes: -3 points per 10000 km
      const brakeDegradation = intervals * 3;
      this.brakeCondition = Math.max(20, this.brakeCondition - brakeDegradation);

      // Oil: -8 points per 10000 km (degrades faster, needs more frequent changes)
      const oilDegradation = intervals * 8;
      this.oilLevel = Math.max(15, this.oilLevel - oilDegradation);

      console.log(`[VehicleMaintenanceComponent] Applied degradation (${this.kmSinceLastService} km = ${intervals} intervals):`, {
        engineCondition: this.engineCondition,
        tireCondition: this.tireCondition,
        brakeCondition: this.brakeCondition,
        oilLevel: this.oilLevel
      });
    }
  }

  // History and predictions
  maintenanceHistory: VehicleMaintenanceRecord[] = [];
  predictionResult: MaintenancePredictionResponse | null = null;
  showPredictionResult = false;

  // Slider colors
  sliderColors = {
    good: 'from-green-400 to-green-500',
    warning: 'from-amber-400 to-amber-500',
    critical: 'from-red-400 to-red-500',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private maintenanceService: MaintenanceService,
    private vehicleService: VehicleService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.vehicleId = Number(idParam ?? 0);

    if (!this.vehicleId) {
      this.errorMessage = 'Véhicule introuvable.';
      return;
    }

    this.load();
  }

  load(): void {
    this.errorMessage = null;
    this.loadingVehicle = true;
    this.loadingHistory = true;

    forkJoin({
      vehicle: this.vehicleService.getById(this.vehicleId).pipe(defaultIfEmpty(null)),
      history: this.maintenanceService.getByVehicleId(this.vehicleId).pipe(defaultIfEmpty([] as VehicleMaintenanceRecord[]))
    }).subscribe({
      next: ({ vehicle, history }) => {
        this.vehicle = vehicle;
        this.maintenanceHistory = history;

        if (!this.vehicle) {
          this.errorMessage = 'Impossible de charger le véhicule.';
        } else {
          // Synchronize fuel level from current vehicle (after all transports)
          this.updateFuelLevelFromVehicle();
          
          // Synchronize mileage from vehicle
          this.mileage = this.vehicle.totalKilometers || 0;
          
          // Synchronize total transports from vehicle (not from maintenance history)
          this.totalTransports = this.vehicle.totalTransports || 0;
          this.initialTotalTransports = this.totalTransports;
          console.log(`[VehicleMaintenanceComponent] Synchronized - mileage: ${this.mileage} km, fuelLevel: ${this.fuelLevel}%, totalTransports: ${this.totalTransports}`);
          
          // Load condition fields from last maintenance record
          const lastRecord = this.maintenanceHistory && this.maintenanceHistory.length > 0 
            ? this.maintenanceHistory[0] 
            : undefined;
          this.initializeConditionFields(lastRecord);
          
          // Pre-fill maintenance indicators from last record (if exists)
          if (lastRecord) {
            console.log('[VehicleMaintenanceComponent] Last maintenance record:', lastRecord);
            
            // Calculate km since last service = current mileage - last mileage
            this.kmSinceLastService = Math.max(0, (this.mileage || 0) - (lastRecord.mileage || 0));
            
            // Apply realistic degradation based on kilometers driven
            this.applyKilometrageDegradation();
            
            // Calculate days since last service
            if (lastRecord.recordDate) {
              const lastDate = new Date(lastRecord.recordDate);
              const today = new Date();
              const diffTime = Math.abs(today.getTime() - lastDate.getTime());
              this.daysSinceLastService = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              this.initialDaysSinceLastService = this.daysSinceLastService;
            } else {
              this.daysSinceLastService = 0;
              this.initialDaysSinceLastService = 0;
            }
            
            // Set total transports = number of maintenance records (rough estimate)
            this.totalTransports = this.maintenanceHistory.length;
            this.initialTotalTransports = this.totalTransports;
            
            console.log(`[VehicleMaintenanceComponent] Pre-filled: kmSince=${this.kmSinceLastService}, daysSince=${this.daysSinceLastService}, totalTransports=${this.totalTransports}`);
          } else {
            // No previous record - reset to 0
            this.kmSinceLastService = 0;
            this.daysSinceLastService = 0;
            this.initialDaysSinceLastService = 0;
            this.totalTransports = 0;
            this.initialTotalTransports = 0;
            console.log('[VehicleMaintenanceComponent] No previous maintenance record - values set to 0');
          }
        }

        this.loadingVehicle = false;
        this.loadingHistory = false;
      },
      error: (error) => {
        console.error('[VehicleMaintenanceComponent] load failed', error);
        this.errorMessage = 'Impossible de charger les données.';
        this.loadingVehicle = false;
        this.loadingHistory = false;
      }
    });
  }

  getSliderGradient(value: number): string {
    if (value >= 70) {
      return this.sliderColors.good;
    } else if (value >= 40) {
      return this.sliderColors.warning;
    } else {
      return this.sliderColors.critical;
    }
  }

  getRiskLevelBadgeClasses(riskLevel: string): string {
    switch (riskLevel) {
      case 'GOOD':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'WARNING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  getRiskPercentageColor(risk: number): string {
    if (risk < 30) {
      return 'text-green-600';
    } else if (risk < 65) {
      return 'text-amber-600';
    } else {
      return 'text-red-600';
    }
  }

  analyzeMaintenance(): void {
    if (!this.vehicle) {
      this.errorMessage = 'Véhicule non chargé';
      return;
    }

    console.log('[VehicleMaintenanceComponent] Starting analysis...');
    this.predictingRisk = true;
    this.errorMessage = null;

    const maintenanceData: VehicleMaintenanceRecord = {
      vehicleId: this.vehicleId,
      recordDate: this.getRecordDateAsDateTime(),
      fuelLevel: this.fuelLevel,
      engineCondition: this.engineCondition,
      tireCondition: this.tireCondition,
      brakeCondition: this.brakeCondition,
      oilLevel: this.oilLevel,
      mileage: this.mileage,
      kmSinceLastService: this.kmSinceLastService,
      daysSinceLastService: this.daysSinceLastService,
      totalTransports: this.totalTransports,
      status: 'GOOD',
      notes: this.notes,
      resolved: false
    };

    console.log('[VehicleMaintenanceComponent] Sending data:', maintenanceData);

    this.maintenanceService.analyzeMaintenanceData(this.vehicleId, maintenanceData).subscribe({
      next: (prediction) => {
        console.log('[VehicleMaintenanceComponent] Prediction received:', prediction);
        this.predictionResult = prediction;
        this.showPredictionResult = true;
        this.predictingRisk = false;
      },
      error: (error) => {
        console.error('[VehicleMaintenanceComponent] analyzeMaintenance failed', error);
        this.errorMessage = 'Erreur lors de l\'analyse. Le backend n\'est peut-être pas disponible. ' + (error?.message || '');
        this.predictingRisk = false;
      }
    });
  }

  submitMaintenance(): void {
    if (!this.vehicle) return;

    this.submitting = true;
    this.errorMessage = null;

    const maintenanceData: VehicleMaintenanceRecord = {
      vehicleId: this.vehicleId,
      recordDate: this.getRecordDateAsDateTime(),
      fuelLevel: this.fuelLevel,
      engineCondition: this.engineCondition,
      tireCondition: this.tireCondition,
      brakeCondition: this.brakeCondition,
      oilLevel: this.oilLevel,
      mileage: this.mileage,
      kmSinceLastService: this.kmSinceLastService,
      daysSinceLastService: this.daysSinceLastService,
      totalTransports: this.totalTransports,
      status: this.predictionResult?.riskLevel === 'CRITICAL' ? 'CRITICAL' :
               this.predictionResult?.riskLevel === 'WARNING' ? 'WARNING' : 'GOOD',
      notes: this.notes,
      resolved: false
    };

    this.maintenanceService.create(maintenanceData).subscribe({
      next: (saved) => {
        this.maintenanceHistory.unshift(saved);
        this.resetForm();
        this.showPredictionResult = false;
        this.submitting = false;
      },
      error: (error) => {
        console.error('[VehicleMaintenanceComponent] submitMaintenance failed', error);
        this.errorMessage = 'Erreur lors de l\'enregistrement de la maintenance.';
        this.submitting = false;
      }
    });
  }

  resetForm(): void {
    this.recordDate = new Date().toISOString().split('T')[0];
    
    // Reload fuel level from current vehicle state (reflects transports)
    this.updateFuelLevelFromVehicle();
    
    // Reload mileage from vehicle
    this.mileage = this.vehicle?.totalKilometers || 0;
    
    // Use STORED initial values (don't recalculate)
    this.daysSinceLastService = this.initialDaysSinceLastService;
    this.totalTransports = this.initialTotalTransports;
    
    // Reload condition fields from last maintenance record
    const lastRecord = this.maintenanceHistory && this.maintenanceHistory.length > 0 
      ? this.maintenanceHistory[0] 
      : undefined;
    this.initializeConditionFields(lastRecord);
    
    // Recalculate maintenance indicators
    if (lastRecord) {
      // Calculate km since last service = current mileage - last mileage
      this.kmSinceLastService = Math.max(0, (this.mileage || 0) - (lastRecord.mileage || 0));
      
      // Reapply degradation based on kms
      this.applyKilometrageDegradation();
    } else {
      // No previous record - reset to 0
      this.kmSinceLastService = 0;
    }
    
    this.notes = '';
    this.predictionResult = null;
    
    console.log('[VehicleMaintenanceComponent] Form reset with current vehicle values and degradation applied');
  }

  resolveAlert(recordId: number | undefined): void {
    if (!recordId) return;

    this.maintenanceService.resolve(recordId).subscribe({
      next: (updated) => {
        const index = this.maintenanceHistory.findIndex(r => r.id === recordId);
        if (index >= 0) {
          this.maintenanceHistory[index] = updated;
        }
      },
      error: (error) => {
        console.error('[VehicleMaintenanceComponent] resolveAlert failed', error);
      }
    });
  }

  /**
   * Repair engine and auto-update maintenance
   */
  repairEngine(): void {
    this.engineCondition = 85;
    this.notes = (this.notes || '') + ' [Moteur réparé automatiquement]';
    console.log('[VehicleMaintenanceComponent] Engine repaired - condition set to 85');
  }

  /**
   * Replace tires and auto-update maintenance
   */
  replaceTires(): void {
    this.tireCondition = 90;
    this.notes = (this.notes || '') + ' [Pneus remplacés automatiquement]';
    console.log('[VehicleMaintenanceComponent] Tires replaced - condition set to 90');
  }

  /**
   * Repair brakes and auto-update maintenance
   */
  repairBrakes(): void {
    this.brakeCondition = 85;
    this.notes = (this.notes || '') + ' [Freins réparés automatiquement]';
    console.log('[VehicleMaintenanceComponent] Brakes repaired - condition set to 85');
  }

  /**
   * Change oil and auto-update maintenance
   */
  changeOil(): void {
    this.oilLevel = 95;
    this.notes = (this.notes || '') + ' [Huile changée automatiquement]';
    console.log('[VehicleMaintenanceComponent] Oil changed - level set to 95');
  }

  goBack(): void {
    this.location.back();
  }
}
