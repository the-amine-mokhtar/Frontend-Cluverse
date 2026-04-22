export type TransportStatus = 'PLANNED' | 'IN_PROGRESS' | 'CANCELED' | 'COMPLETED';

export interface Transport {
  id: number;
  /**
   * Backend uses `LocalDateTime`. In Spring Boot this is typically serialized as an ISO string
   * like `2026-04-06T10:30:00` (no explicit jackson timestamp config found).
   */
  scheduledDate: string;
  departureLocationId: number | null;
  arrivalLocationId: number | null;
  distance?: number;  // Distance in km
  status: TransportStatus;
  vehicleId: number;
  userId: number;
  eventId: number | null;
}

export interface TransportUpsertPayload {
  scheduledDate: string;
  departureLocationId: number;
  arrivalLocationId: number;
  distance?: number;  // Distance in km
  status: TransportStatus;
  vehicleId: number;
  userId: number;
  eventId?: number | null;
}
