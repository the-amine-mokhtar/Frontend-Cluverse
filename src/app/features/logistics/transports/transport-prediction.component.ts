import { Component, Input } from '@angular/core';
import { TransportService } from '../services/transport.service';
import { TransportPrediction } from '../models/transport-prediction.model';

@Component({
  selector: 'app-transport-prediction',
  templateUrl: './transport-prediction.component.html',
  styleUrls: ['./transport-prediction.component.scss']
})
export class TransportPredictionComponent {
  @Input() departureLocationId: number | string | null = null;
  @Input() arrivalLocationId: number | string | null = null;
  @Input() scheduledDate: string = '';
  @Input() departureCityName: string = '';
  @Input() arrivalCityName: string = '';

  prediction: TransportPrediction | null = null;
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private transportService: TransportService) {}

  analyze(): void {
    // Guard: return if any input is null/empty
    const depId = this._getDepartureLocationId();
    const arrId = this._getArrivalLocationId();
    if (!depId || !arrId || !this.scheduledDate) {
      return;
    }

    this.isLoading = true;
    this.prediction = null;
    this.errorMessage = null;

    this.transportService
      .getPrediction(
        depId, 
        arrId, 
        this.scheduledDate,
        this.departureCityName || undefined,
        this.arrivalCityName || undefined
      )
      .subscribe({
        next: (result: TransportPrediction) => {
          this.prediction = result;
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('Prediction error:', error);
          this.errorMessage = "Impossible d'analyser ce trajet.";
          this.isLoading = false;
        }
      });
  }

  getRiskColor(): string {
    if (!this.prediction) return 'bg-gray-500';
    switch (this.prediction.riskLevel) {
      case 'LOW':
        return 'bg-green-500';
      case 'MEDIUM':
        return 'bg-orange-500';
      case 'HIGH':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  }

  getRiskBgClass(): string {
    if (!this.prediction) return 'bg-gray-50 border-gray-200';
    switch (this.prediction.riskLevel) {
      case 'LOW':
        return 'bg-green-50 border-green-200';
      case 'MEDIUM':
        return 'bg-orange-50 border-orange-200';
      case 'HIGH':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  }

  getConfidenceLabel(): string {
    if (!this.prediction) return '';
    if (this.prediction.modelType === 'LINEAR_REGRESSION') {
      return 'IA — GTFS Tunisie';
    }
    switch (this.prediction.confidence) {
      case 'low':
        return 'Données insuffisantes';
      case 'medium':
        return 'Confiance moyenne';
      case 'high':
        return 'Haute confiance';
      default:
        return '';
    }
  }

  getConfidenceBadgeClass(): string {
    if (!this.prediction) return 'bg-gray-100 text-gray-600';
    if (this.prediction.modelType === 'LINEAR_REGRESSION') {
      return 'bg-indigo-100 text-indigo-700';
    }
    switch (this.prediction.confidence) {
      case 'low':
        return 'bg-gray-100 text-gray-600';
      case 'medium':
        return 'bg-blue-100 text-blue-700';
      case 'high':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  getTimeSlotLabel(): string {
    if (!this.prediction) return '';
    switch (this.prediction.timeSlot) {
      case 'MORNING':
        return 'Matin';
      case 'AFTERNOON':
        return 'Après-midi';
      case 'EVENING':
        return 'Soir';
      default:
        return this.prediction.timeSlot;
    }
  }

  getDayLabel(): string {
    if (!this.prediction) return '';
    const dayMap: { [key: string]: string } = {
      MONDAY: 'Lundi',
      TUESDAY: 'Mardi',
      WEDNESDAY: 'Mercredi',
      THURSDAY: 'Jeudi',
      FRIDAY: 'Vendredi',
      SATURDAY: 'Samedi',
      SUNDAY: 'Dimanche'
    };
    return dayMap[this.prediction.dayOfWeek] || this.prediction.dayOfWeek;
  }

  _getDepartureLocationId(): number | null {
    const val = this.departureLocationId;
    return val ? Number(val) : null;
  }

  _getArrivalLocationId(): number | null {
    const val = this.arrivalLocationId;
    return val ? Number(val) : null;
  }
}
