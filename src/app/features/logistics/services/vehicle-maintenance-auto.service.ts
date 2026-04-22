import { Injectable } from '@angular/core';
import { VehicleService } from './vehicle.service';
import { MaintenanceService, VehicleMaintenanceRecord } from './maintenance.service';
import { TransportService } from './transport.service';
import { forkJoin, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class VehicleMaintenanceAutoService {

  constructor(
    private maintenanceService: MaintenanceService,
    private vehicleService: VehicleService,
    private transportService: TransportService
  ) {}

  /**
   * Crée automatiquement une maintenance initiale quand on ajoute un véhicule
   */
  createInitialMaintenanceForVehicle(vehicleId: number): void {
    console.log(`[VehicleMaintenanceAutoService] Creating initial maintenance for vehicle ${vehicleId}`);

    // First load the vehicle to get current fuel and mileage
    this.vehicleService.getById(vehicleId).subscribe({
      next: (vehicle) => {
        const initialMaintenance: VehicleMaintenanceRecord = {
          vehicleId: vehicleId,
          recordDate: new Date().toISOString(),
          // SYNC: Use vehicle's actual fuel level and mileage
          fuelLevel: Math.round(vehicle.fuelLevel || 100),
          mileage: vehicle.totalKilometers || 0,
          engineCondition: 95,   // Excellent
          tireCondition: 95,     // Excellent
          brakeCondition: 95,    // Excellent
          oilLevel: 100,         // Complet
          kmSinceLastService: 0,
          daysSinceLastService: 0,
          totalTransports: 0,
          status: 'GOOD',
          notes: 'Maintenance initiale - Véhicule neuf',
          resolved: false
        };

        this.maintenanceService.create(initialMaintenance).subscribe({
          next: () => {
            console.log(`[VehicleMaintenanceAutoService] Initial maintenance created for vehicle ${vehicleId}`);
          },
          error: (error) => {
            console.error(`[VehicleMaintenanceAutoService] Failed to create initial maintenance`, error);
          }
        });
      },
      error: (error) => {
        console.error(`[VehicleMaintenanceAutoService] Failed to load vehicle`, error);
        // Fallback: create with default values if vehicle load fails
        const fallbackMaintenance: VehicleMaintenanceRecord = {
          vehicleId: vehicleId,
          recordDate: new Date().toISOString(),
          fuelLevel: 100,
          mileage: 0,
          engineCondition: 95,
          tireCondition: 95,
          brakeCondition: 95,
          oilLevel: 100,
          kmSinceLastService: 0,
          daysSinceLastService: 0,
          totalTransports: 0,
          status: 'GOOD',
          notes: 'Maintenance initiale - Véhicule neuf',
          resolved: false
        };
        this.maintenanceService.create(fallbackMaintenance).subscribe();
      }
    });
  }

  /**
   * Met à jour automatiquement le kilométrage d'un véhicule selon ses transports
   */
  updateVehicleKilometrage(vehicleId: number): void {
    console.log(`[VehicleMaintenanceAutoService] Updating kilometrage for vehicle ${vehicleId}`);

    this.transportService.getAll().pipe(
      switchMap((allTransports) => {
        const vehicleTransports = allTransports.filter(t => Number(t.vehicleId) === Number(vehicleId));
        
        // Calcul du kilométrage total
        const totalKm = vehicleTransports.reduce((sum, t) => {
          // Suppose que le transport a une propriété "distance" ou "km"
          const distance = (t as any).distance || (t as any).km || 0;
          return sum + distance;
        }, 0);

        console.log(`[VehicleMaintenanceAutoService] Total KM for vehicle ${vehicleId}: ${totalKm}`);

        // Récupère le dernier enregistrement de maintenance
        return this.maintenanceService.getByVehicleId(vehicleId).pipe(
          switchMap((maintenances) => {
            if (maintenances.length === 0) {
              console.log('No maintenance record found, skipping update');
              return of(null);
            }

            const latest = maintenances[0];
            latest.mileage = totalKm;
            
            // Si on a au moins une maintenance antérieure documentée, calculer depuis combien de km
            if (maintenances.length > 1) {
              const previousMaintenance = maintenances[maintenances.length - 1];
              latest.kmSinceLastService = totalKm - (previousMaintenance.mileage || 0);
            } else {
              latest.kmSinceLastService = totalKm;
            }

            return this.maintenanceService.update(latest.id!, latest);
          })
        );
      })
    ).subscribe({
      next: () => {
        console.log(`[VehicleMaintenanceAutoService] Kilometrage updated for vehicle ${vehicleId}`);
      },
      error: (error) => {
        console.error(`[VehicleMaintenanceAutoService] Failed to update kilometrage`, error);
      }
    });
  }

  /**
   * Enregistre un transport et met à jour automatiquement la maintenance
   */
  recordTransportAndUpdateMaintenance(vehicleId: number, transportDistance: number): void {
    console.log(`[VehicleMaintenanceAutoService] Transport recorded: ${transportDistance}km for vehicle ${vehicleId}`);
    
    // Après un petit délai pour que le transport soit sauvegardé
    setTimeout(() => {
      this.updateVehicleKilometrage(vehicleId);
    }, 500);
  }
}
