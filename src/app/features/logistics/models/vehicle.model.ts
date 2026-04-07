export interface Vehicle {
  id: number;
  plateNumber: string;
  model: string;
  /**
   * Backend field is `isAvailable` (boolean). In JSON it is typically serialized as `available`.
   */
  available: boolean;
}

export interface VehicleUpsertPayload {
  plateNumber: string;
  model: string;
  available: boolean;
}
