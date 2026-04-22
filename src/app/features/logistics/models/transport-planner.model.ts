export interface TransportSuggestion {
  rank: number;
  suggestedDate: string;
  vehicleId: number;
  vehicleModel: string;
  vehiclePlate: string;
  resourceId: number;
  resourceName: string;
  totalQuantity: number;
  reservationCount: number;
  reason: string;
  predictedDuration: string;
  congestionRisk: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface TransportPlannerResponse {
  weekStart: string;
  weekEnd: string;
  totalReservations: number;
  availableVehicles: number;
  suggestions: TransportSuggestion[];
  plannerNote: string;
}
