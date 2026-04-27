import { ResourceStatus } from '../models/resource.model';
import { InventoryTransactionType } from '../models/inventory-transaction.model';
import { TransportStatus } from '../models/transport.model';

export const RESOURCE_STATUS_LABELS: Record<ResourceStatus, { label: string; color: string }> = {
  AVAILABLE: { label: 'Disponible', color: 'bg-green-100 text-green-800' },
  IN_USE: { label: 'En utilisation', color: 'bg-blue-100 text-blue-800' },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-orange-100 text-orange-800' },
  RETIRED: { label: 'Retiré', color: 'bg-gray-100 text-gray-500' }
};

export const INVENTORY_TYPE_LABELS: Record<
  InventoryTransactionType,
  { label: string; color: string }
> = {
  ADD: { label: 'Entrée', color: 'bg-green-100 text-green-800' },
  REMOVE: { label: 'Sortie', color: 'bg-red-100 text-red-800' },
  UPDATE: { label: 'Ajustement', color: 'bg-orange-100 text-orange-800' }
};

export const TRANSPORT_STATUS_LABELS: Record<TransportStatus, { label: string; color: string }> = {
  PLANNED: { label: 'Planifié', color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-orange-100 text-orange-800' },
  COMPLETED: { label: 'Terminé', color: 'bg-green-100 text-green-800' },
  CANCELED: { label: 'Annulé', color: 'bg-gray-100 text-gray-500' }
};

export function getStatusBadgeClasses(color: string): string {
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`;
}
