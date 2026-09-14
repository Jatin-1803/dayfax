export const LOCAL_SHOP_STORE_TYPE = 'FOOD';

export function isLocalShopStoreType(storeType: string | null | undefined): boolean {
  return storeType === LOCAL_SHOP_STORE_TYPE;
}

/** Admin flag: when true, this store's items cannot use COD. Independent of FOOD. */
export function requiresOnlinePayment(onlinePaymentOnly: boolean | number | null | undefined): boolean {
  return Boolean(onlinePaymentOnly);
}
