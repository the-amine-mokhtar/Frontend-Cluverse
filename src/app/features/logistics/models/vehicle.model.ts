export interface Vehicle {
  id: number;
  plateNumber: string;
  model: string;
  /**
   * Backend field is `isAvailable` (boolean). In JSON it is typically serialized as `available`.
   */
  available: boolean;
  /**
   * Total cumulative kilometers from all transports assigned to this vehicle
   */
  totalKilometers?: number;
  /**
   * Current fuel level as percentage (0-100%)
   */
  fuelLevel?: number;
  /**
   * Fuel tank capacity in liters
   */
  fuelTankCapacity?: number;
  /**
   * Total number of transports assigned to this vehicle
   */
  totalTransports?: number;
}

export interface VehicleUpsertPayload {
  plateNumber: string;
  model: string;
  available: boolean;
}
