export type FulfillmentType = 'DELIVERY' | 'PICKUP' | 'IN_STORE';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING_EXTERNAL' | 'PAID_AT_STORE' | 'PAID_EXTERNAL_CONFIRMED';

export interface Store {
  id: string;
  name: string;
  slug: string;
  category: string;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  accepts_in_store: boolean;
  delivery_radius_km: number;
  base_delivery_fee: number;
  settings: Record<string, unknown>;
  is_active: boolean;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  price: number;
  barcode: string | null;
  sku: string | null;
  current_stock: number;
  safety_stock: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  updated_at: string;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export interface AuthenticatedStoreStaff {
  id: string;
  tenant_id: string;
  role: string;
}

// Extensão do Request do Express para carregar o tenant resolvido pelo middleware
declare global {
  namespace Express {
    interface Request {
      tenant?: Store;
      userId?: string; // customer autenticado (users.id)
      storeStaff?: AuthenticatedStoreStaff; // funcionário/lojista autenticado
    }
  }
}
