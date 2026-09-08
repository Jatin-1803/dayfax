import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import { CartRepository } from './cart.repository.js';
import type { AddCartItemInput, UpdateCartItemInput } from './cart.schema.js';
import type { CartItemRow, CartRow } from './cart.repository.js';

function mapItem(row: CartItemRow) {
  const available = row.quantity_available ?? 0;
  const currentPrice = row.current_price_paise;
  return {
    id: row.id,
    variantId: row.variant_id,
    quantity: row.quantity,
    unitPricePaise: row.unit_price_paise,
    lineTotalPaise: row.unit_price_paise * row.quantity,
    product: {
      id: row.product_id,
      name: row.product_name,
      slug: row.product_slug,
      imageUrl: toPublicAssetUrl(row.product_image_url),
    },
    unitLabel: row.unit_label,
    mrpPaise: row.mrp_paise,
    currentPricePaise: currentPrice,
    priceChanged: currentPrice !== row.unit_price_paise,
    quantityAvailable: available,
    inStock: available > 0,
    exceedsStock: row.quantity > available,
  };
}

function emptyCart() {
  return {
    id: null as string | null,
    storeId: null as string | null,
    serviceAreaId: null as string | null,
    items: [] as ReturnType<typeof mapItem>[],
    itemCount: 0,
    subtotalPaise: 0,
    currency: 'INR',
  };
}

function summarize(cart: CartRow, items: CartItemRow[]) {
  const mapped = items.map(mapItem);
  return {
    id: cart.id,
    storeId: cart.store_id,
    serviceAreaId: cart.service_area_id,
    items: mapped,
    itemCount: mapped.reduce((sum, item) => sum + item.quantity, 0),
    subtotalPaise: mapped.reduce((sum, item) => sum + item.lineTotalPaise, 0),
    currency: 'INR',
  };
}

export class CartService {
  constructor(private readonly repo = new CartRepository()) {}

  async getCart(userId: string) {
    const cart = await this.repo.findActiveCart(userId);
    if (!cart) return emptyCart();
    const items = await this.repo.listItems(cart.id);
    return summarize(cart, items);
  }

  async addItem(userId: string, input: AddCartItemInput) {
    const sellable = await this.repo.resolveSellableVariant({
      variantId: input.variantId,
      storeId: input.storeId,
    });
    if (!sellable) {
      throw new NotFoundError('Product variant not available');
    }
    if (!sellable.product_active || !sellable.variant_active || !sellable.is_available) {
      throw new ValidationError('This product is currently unavailable');
    }
    if (sellable.quantity_available < 1) {
      throw new ValidationError('This product is out of stock');
    }

    await withTransaction(async (conn) => {
      let cart = await this.repo.findActiveCart(userId, conn);

      if (cart && cart.store_id !== sellable.store_id) {
        await this.repo.deleteAllItems(cart.id, conn);
        await this.repo.abandonCart(cart.id, conn);
        cart = null;
      }

      if (!cart) {
        const cartId = await this.repo.createCart(
          {
            userId,
            storeId: sellable.store_id,
            serviceAreaId: sellable.service_area_id,
          },
          conn,
        );
        cart = {
          id: cartId,
          user_id: userId,
          store_id: sellable.store_id,
          service_area_id: sellable.service_area_id,
          status: 'ACTIVE',
        };
      }

      const existing = await this.repo.findItemByVariant(cart.id, input.variantId, conn);
      const nextQty = (existing?.quantity ?? 0) + input.quantity;
      if (nextQty > sellable.quantity_available) {
        throw new ConflictError(
          `Only ${sellable.quantity_available} available for this item`,
        );
      }

      if (existing) {
        await this.repo.updateItem(
          existing.id,
          { quantity: nextQty, unitPricePaise: sellable.price_paise },
          conn,
        );
      } else {
        await this.repo.insertItem(
          {
            cartId: cart.id,
            variantId: input.variantId,
            quantity: input.quantity,
            unitPricePaise: sellable.price_paise,
          },
          conn,
        );
      }

      await this.repo.touchCart(cart.id, conn);
    });

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, input: UpdateCartItemInput) {
    const cart = await this.repo.findActiveCart(userId);
    if (!cart) throw new NotFoundError('Cart not found');

    const item = await this.repo.findItem(cart.id, itemId);
    if (!item) throw new NotFoundError('Cart item not found');

    if (input.quantity === 0) {
      await withTransaction(async (conn) => {
        await this.repo.deleteItem(itemId, cart.id, conn);
        const remaining = await this.repo.listItems(cart.id, conn);
        if (remaining.length === 0) {
          await this.repo.abandonCart(cart.id, conn);
        } else {
          await this.repo.touchCart(cart.id, conn);
        }
      });
      return this.getCart(userId);
    }

    const sellable = await this.repo.resolveSellableVariant({
      variantId: item.variant_id,
      storeId: cart.store_id,
    });
    if (!sellable) {
      throw new ValidationError('This product is no longer available');
    }
    if (input.quantity > sellable.quantity_available) {
      throw new ConflictError(`Only ${sellable.quantity_available} available for this item`);
    }

    await withTransaction(async (conn) => {
      await this.repo.updateItem(
        itemId,
        { quantity: input.quantity, unitPricePaise: sellable.price_paise },
        conn,
      );
      await this.repo.touchCart(cart.id, conn);
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    return this.updateItem(userId, itemId, { quantity: 0 });
  }

  async clear(userId: string) {
    const cart = await this.repo.findActiveCart(userId);
    if (!cart) return emptyCart();

    await withTransaction(async (conn) => {
      await this.repo.deleteAllItems(cart.id, conn);
      await this.repo.abandonCart(cart.id, conn);
    });

    return emptyCart();
  }
}
