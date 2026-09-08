export type RoleCode = 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN';

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiFailure {
  success: false;
  message: string;
  error?: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  roles: RoleCode[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AdminStore {
  id: string;
  serviceAreaId: string | null;
  name: string;
  slug: string;
  storeType: string;
  imageUrl: string | null;
  description: string | null;
  phoneCountryCode: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  landmark: string | null;
  city: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  isPopular: boolean;
  isActive: boolean;
  addressSummary: string | null;
}

export interface StoreProduct {
  id: string;
  name: string;
  nameHi?: string | null;
  slug: string;
  description?: string | null;
  descriptionHi?: string | null;
  brand?: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isAvailable: boolean;
  categoryId?: string | null;
  variantId: string | null;
  unitLabel: string | null;
  pricePaise: number;
  mrpPaise: number | null;
  quantityAvailable: number;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  nameHi?: string | null;
  slug: string;
  iconKey: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  imageUrl: string | null;
  category: { id: string; name: string };
  store: { id: string; name: string };
  defaultVariant: {
    id: string;
    unitLabel: string;
    pricePaise: number;
    mrpPaise: number | null;
    quantityAvailable: number;
    inStock: boolean;
  } | null;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  grandTotalPaise: number;
  currency: string;
  placedAt: string;
  store: { id: string; name: string };
  customer: {
    id: string;
    phoneCountryCode: string;
    phone: string;
    fullName: string | null;
  };
  payment: { method: string | null; status: string | null } | null;
  assignment: {
    id: string;
    status: string;
    partnerId: string | null;
    partnerPhone: string | null;
    partnerName: string | null;
  } | null;
}

export interface AdminUser {
  id: string;
  phoneCountryCode: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  status: string;
  roles: RoleCode[];
  createdAt: string | null;
  lastLoginAt: string | null;
}

export interface LocationRow {
  id: string;
  name: string;
  state: string | null;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ServiceAreaRow {
  id: string;
  locationId: string;
  name: string;
  slug: string;
  isActive: boolean;
  locationName?: string | null;
}

export interface DeliveryZoneRow {
  id: string;
  serviceAreaId: string;
  name: string;
  deliveryFeePaise: number;
  minOrderPaise: number;
  freeDeliveryAbovePaise: number | null;
  etaMinutes: number;
  isActive: boolean;
  serviceAreaName?: string | null;
}

export interface AdminBanner {
  id: string;
  title: string;
  titleHi: string | null;
  imageUrl: string;
  linkPath: string | null;
  priority: number;
  isActive: boolean;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryFeeSlabRow {
  id: string;
  deliveryZoneId: string;
  fromKm: number;
  toKm: number | null;
  feePaise: number;
}
