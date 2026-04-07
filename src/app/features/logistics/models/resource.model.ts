export type ResourceStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';

export interface Resource {
  id: number;
  name: string;
  description: string;
  unitCost: number;
  status: ResourceStatus;
  imageUrl: string;
  quantityTotal: number;
  availableQuantity: number;
  lastUpdated: string;
  lowStockThreshold: number;
  notes: string;
  clubId?: number;
}

export interface ResourceUpsertPayload {
  name: string;
  description: string;
  unitCost: number;
  status: ResourceStatus;
  imageUrl?: string;
  quantityTotal: number;
  availableQuantity: number;
  lowStockThreshold: number;
  notes: string;
  lastUpdated?: string | null;
  clubId: number;
}
