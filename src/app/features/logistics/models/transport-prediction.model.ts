export interface TransportPrediction {
  departureLocationId: number;
  arrivalLocationId: number;
  scheduledDate: string;
  predictedDurationMinutes: number;
  congestionRisk: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'low' | 'medium' | 'high';
  recommendation: string;
  historicalTripsAnalyzed: number;
  dayOfWeek: string;
  timeSlot: string;
  modelType: 'LINEAR_REGRESSION' | 'RULE_BASED';
  trainingDataSize: number;
  distanceKm?: number;
  departureCity?: string;
  arrivalCity?: string;
}
