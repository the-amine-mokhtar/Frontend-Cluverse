export type InventoryTransactionType = 'ADD' | 'REMOVE' | 'UPDATE';

export interface InventoryTransaction {
  id: number;
  type: InventoryTransactionType;
  quantity: number;
  date: string;
  reason: string;
  applied: boolean;
}

export interface InventoryTransactionCreatePayload {
  type: InventoryTransactionType;
  quantity: number;
  date: string;
  reason: string;
  resourceId: number;
}
