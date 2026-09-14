import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import { logger } from '../../common/logger/logger.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { isGeminiConfigured, replyAsSupport } from './gemini.client.js';
import {
  customerWantsItemPicker,
  pickerPromptLine,
  returnRaisedLine,
  supportLang,
} from './support-customer-lines.js';
import {
  aliasOrderItems,
  buildSupportSystemPrompt,
  scrubAgentReply,
} from './support-agent-policy.js';
import { SupportRepository, type SupportMessageRow } from './support.repository.js';
import { mapReturnForCustomer, ReturnsService } from './returns.service.js';
import type { ReportDamagedItemsInput, SendSupportMessageInput } from './support.schema.js';

function openingLine(lang: 'en' | 'hi' | undefined, orderNumber: string): string {
  if (lang === 'hi') {
    return `नमस्ते, मैं Dayfax Support से अनन्या हूँ। मैं आपका ऑर्डर ${orderNumber} देख रही हूँ। बताइए, क्या मदद चाहिए?`;
  }
  return `Hi, I'm Ananya from Dayfax Support. I can see your order ${orderNumber}. How can I help?`;
}

function tiedUpLine(lang: 'en' | 'hi' | undefined): string {
  if (lang === 'hi') {
    return 'मैं अभी थोड़ी व्यस्त हूँ। नीचे खराब आइटम चुनें और फोटो जोड़ें — मैं टीम को रिक्वेस्ट भेज दूँगी।';
  }
  return "I'm a little tied up right now. Select the damaged items below and add a photo, and I'll send that to the team.";
}

function mapMessage(row: SupportMessageRow) {
  return {
    id: row.id,
    sender: row.sender,
    body: row.body,
    at: row.created_at,
  };
}

export function mapSupportOrderIdentity(order: {
  order_number: string;
  store_name?: string | null;
  placed_at: Date;
}) {
  return {
    orderNumber: order.order_number,
    storeName: order.store_name ?? '',
    placedAt: order.placed_at,
  };
}

export class SupportService {
  constructor(
    private readonly support = new SupportRepository(),
    private readonly orders = new OrdersRepository(),
    private readonly returns = new ReturnsService(),
  ) {}

  async open(userId: string, idOrNumber: string, lang?: 'en' | 'hi') {
    const order = await this.orders.findByIdOrNumberForUser(userId, idOrNumber);
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'DELIVERED') {
      throw new ValidationError('Support chat is available after delivery');
    }

    let conversation = await this.support.findConversationByOrderId(order.id);
    if (!conversation) {
      await withTransaction(async (conn) => {
        const existing = await this.support.findConversationByOrderId(order.id, conn);
        if (existing) return;
        const id = await this.support.createConversation(
          { userId, orderId: order.id, lang },
          conn,
        );
        await this.support.addMessage(
          {
            conversationId: id,
            sender: 'AGENT',
            body: openingLine(lang, order.order_number),
          },
          conn,
        );
      });
      conversation = await this.support.findConversationByOrderId(order.id);
    }
    if (!conversation || conversation.user_id !== userId) {
      throw new NotFoundError('Conversation not found');
    }
    if (lang) {
      await this.support.updateConversationPrefs(conversation.id, { lang });
    }
    return this.payload(userId, conversation.id, order);
  }

  async get(userId: string, idOrNumber: string) {
    const order = await this.orders.findByIdOrNumberForUser(userId, idOrNumber);
    if (!order) throw new NotFoundError('Order not found');
    const conversation = await this.support.findConversationByOrderId(order.id);
    if (!conversation || conversation.user_id !== userId) {
      throw new NotFoundError('Conversation not found');
    }
    return this.payload(userId, conversation.id, order);
  }

  async sendMessage(
    userId: string,
    idOrNumber: string,
    input: SendSupportMessageInput,
  ) {
    const order = await this.orders.findByIdOrNumberForUser(userId, idOrNumber);
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'DELIVERED') {
      throw new ValidationError('Support chat is available after delivery');
    }

    const conversation = await this.support.findConversationByOrderId(order.id);
    if (!conversation || conversation.user_id !== userId) {
      throw new NotFoundError('Conversation not found');
    }

    const lang = supportLang(input.lang ?? conversation.lang);
    await this.support.updateConversationPrefs(conversation.id, { lang });
    await this.support.addMessage({
      conversationId: conversation.id,
      sender: 'CUSTOMER',
      body: input.body,
    });

    const items = await this.orders.listItems(order.id);
    const returnableItems = items.filter((item) => !item.is_local_shop);
    const latestReturn = await this.support.findLatestReturnForOrder(order.id);
    const history = await this.support.listMessages(conversation.id);
    const returnAllowed = !latestReturn || latestReturn.status === 'REJECTED';
    const canPickItems = returnAllowed && returnableItems.length > 0;

    let showItemPicker = false;
    let agentBody = '';

    if (!isGeminiConfigured()) {
      agentBody = tiedUpLine(lang);
      showItemPicker = canPickItems;
    } else {
      const catalog = aliasOrderItems(
        returnableItems.map((item) => ({
          id: item.id,
          productName: item.product_name,
          variantLabel: item.variant_label,
          quantity: item.quantity,
        })),
      );
      const system = buildSupportSystemPrompt({
        orderNumber: order.order_number,
        itemLines: catalog.lines,
        returnStatus: latestReturn?.status ?? null,
        hasLocalShopItems: items.some((item) => Boolean(item.is_local_shop)),
        hasReturnableItems: returnableItems.length > 0,
      });

      try {
        const reply = await replyAsSupport({
          system,
          orderNumber: order.order_number,
          history: history.slice(-20).map((message) => ({
            role: message.sender === 'CUSTOMER' ? 'user' : 'model',
            text: message.body.slice(0, 2000),
          })),
          onRequestItemSelection: () =>
            canPickItems
              ? {
                  ok: true,
                  message:
                    'The item list is now shown. Tell the customer to select items and add a photo. Do not ask them to type names. Do not say a return was created.',
                }
              : {
                  ok: false,
                  message: 'No returnable items, or a return is already open. Do not ask for item names.',
                },
        });
        agentBody = reply.text;
        showItemPicker = reply.showItemPicker;
      } catch (error) {
        logger.warn('Support reply failed', {
          error: error instanceof Error ? error.message : 'unknown',
        });
        agentBody = tiedUpLine(lang);
        showItemPicker = canPickItems;
      }
    }

    if (!showItemPicker && canPickItems && customerWantsItemPicker(input.body)) {
      showItemPicker = true;
      if (!agentBody.trim()) agentBody = pickerPromptLine(lang);
    }

    agentBody = scrubAgentReply(agentBody || pickerPromptLine(lang), order.order_number);
    await this.support.updateConversationPrefs(conversation.id, { lang, itemPickerOpen: showItemPicker });

    await this.support.addMessage({
      conversationId: conversation.id,
      sender: 'AGENT',
      body: agentBody,
    });

    return this.payload(userId, conversation.id, order);
  }

  async reportDamaged(
    userId: string,
    idOrNumber: string,
    input: ReportDamagedItemsInput,
  ) {
    const order = await this.orders.findByIdOrNumberForUser(userId, idOrNumber);
    if (!order) throw new NotFoundError('Order not found');
    const conversation = await this.support.findConversationByOrderId(order.id);
    if (!conversation || conversation.user_id !== userId) {
      throw new NotFoundError('Conversation not found');
    }

    await this.returns.createDamagedReturn({
      orderId: order.id,
      userId,
      conversationId: conversation.id,
      customerNote: input.customerNote,
      items: input.items,
      photoUrls: input.photoUrls,
    });

    await this.support.addMessage({
      conversationId: conversation.id,
      sender: 'AGENT',
      body: returnRaisedLine(supportLang(conversation.lang)),
    });

    return this.payload(userId, conversation.id, order);
  }

  private async payload(
    userId: string,
    conversationId: string,
    order: { id: string; order_number: string; store_name?: string | null; placed_at: Date },
  ) {
    const orderId = order.id;
    const conversation = await this.support.findConversationByOrderId(orderId);
    if (!conversation || conversation.user_id !== userId || conversation.id !== conversationId) {
      throw new NotFoundError('Conversation not found');
    }
    const [messages, latest, items] = await Promise.all([
      this.support.listMessages(conversationId),
      this.support.findLatestReturnForOrder(orderId),
      this.orders.listItems(orderId),
    ]);
    const returnItems = latest ? await this.support.listReturnItems(latest.id) : [];
    const returnAllowed = !latest || latest.status === 'REJECTED';
    const showItemPicker =
      Boolean(conversation.item_picker_open) &&
      returnAllowed &&
      items.some((item) => !item.is_local_shop);
    return {
      order: mapSupportOrderIdentity(order),
      conversation: conversation
        ? {
            id: conversation.id,
            agentName: conversation.agent_display_name,
            status: conversation.status,
          }
        : null,
      messages: messages.map(mapMessage),
      returnRequest: latest
        ? {
            ...mapReturnForCustomer(latest),
            items: returnItems.map((item) => ({
              orderItemId: item.order_item_id,
              productName: item.product_name,
              variantLabel: item.variant_label,
              quantity: item.quantity,
              lineRefundPaise: item.line_refund_paise,
            })),
          }
        : null,
      orderItems: items.map((item) => ({
        id: item.id,
        productName: item.product_name,
        variantLabel: item.variant_label,
        quantity: item.quantity,
        isLocalShop: Boolean(item.is_local_shop),
      })),
      showItemPicker,
      canReportDamage: showItemPicker,
    };
  }
}
