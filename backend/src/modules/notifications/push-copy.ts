export type PushCopyKey =
  | 'order_placed'
  | 'payment_waiting'
  | 'payment_successful'
  | 'order_cancelled'
  | 'cash_collected'
  | 'payment_received'
  | 'order_accepted'
  | 'out_for_delivery'
  | 'order_delivered'
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'return_picked_up'
  | 'refund_sent'
  | 'partner_new_order'
  | 'partner_order_taken'
  | 'partner_job_assigned'
  | 'partner_order_cancelled'
  | 'partner_order_delivered'
  | 'partner_return_pickup';

export type PushLocale = 'en' | 'hi';

export type PushCopyExtras = {
  storeName?: string;
  area?: string;
  paymentLabel?: string;
  amountLabel?: string;
};

type Copy = { title: string; body: string };

const COPY: Record<PushCopyKey, Record<PushLocale, Copy>> = {
  order_placed: {
    en: {
      title: 'Order placed',
      body: 'Order {orderNumber} placed. A delivery partner will accept it shortly.',
    },
    hi: {
      title: 'ऑर्डर हो गया',
      body: 'ऑर्डर {orderNumber} हो गया। डिलीवरी पार्टनर जल्द स्वीकार करेगा।',
    },
  },
  payment_waiting: {
    en: {
      title: 'Complete your payment',
      body: 'Order {orderNumber} is waiting for payment.',
    },
    hi: {
      title: 'भुगतान पूरा करें',
      body: 'ऑर्डर {orderNumber} भुगतान का इंतजार कर रहा है।',
    },
  },
  payment_successful: {
    en: {
      title: 'Payment successful',
      body: 'Payment received for order {orderNumber}. A delivery partner will accept it shortly.',
    },
    hi: {
      title: 'भुगतान सफल',
      body: 'ऑर्डर {orderNumber} का भुगतान मिल गया। डिलीवरी पार्टनर जल्द स्वीकार करेगा।',
    },
  },
  order_cancelled: {
    en: {
      title: 'Order cancelled',
      body: 'Order {orderNumber} was cancelled.',
    },
    hi: {
      title: 'ऑर्डर रद्द',
      body: 'ऑर्डर {orderNumber} रद्द हो गया।',
    },
  },
  cash_collected: {
    en: {
      title: 'Cash collected',
      body: 'Cash received for order {orderNumber}. Share the delivery OTP with your partner.',
    },
    hi: {
      title: 'नकद मिल गया',
      body: 'ऑर्डर {orderNumber} का नकद मिल गया। डिलीवरी OTP पार्टनर को बताएं।',
    },
  },
  payment_received: {
    en: {
      title: 'Payment received',
      body: 'Payment received for order {orderNumber}. Share the delivery OTP with your partner.',
    },
    hi: {
      title: 'भुगतान मिल गया',
      body: 'ऑर्डर {orderNumber} का भुगतान मिल गया। डिलीवरी OTP पार्टनर को बताएं।',
    },
  },
  order_accepted: {
    en: {
      title: 'Order accepted',
      body: 'A delivery partner accepted order {orderNumber}.',
    },
    hi: {
      title: 'ऑर्डर स्वीकार',
      body: 'डिलीवरी पार्टनर ने ऑर्डर {orderNumber} स्वीकार कर लिया।',
    },
  },
  out_for_delivery: {
    en: {
      title: 'Out for delivery',
      body: 'Order {orderNumber} is on the way.',
    },
    hi: {
      title: 'डिलीवरी के लिए निकला',
      body: 'ऑर्डर {orderNumber} रास्ते में है।',
    },
  },
  order_delivered: {
    en: {
      title: 'Order delivered',
      body: 'Order {orderNumber} has been delivered.',
    },
    hi: {
      title: 'ऑर्डर डिलीवर',
      body: 'ऑर्डर {orderNumber} डिलीवर हो गया।',
    },
  },
  return_requested: {
    en: {
      title: 'Return request received',
      body: 'We have your request for order {orderNumber}. The team will review it shortly.',
    },
    hi: {
      title: 'रिटर्न अनुरोध मिला',
      body: 'ऑर्डर {orderNumber} का अनुरोध मिल गया। टीम जल्द देखेगी।',
    },
  },
  return_approved: {
    en: {
      title: 'Return approved',
      body: 'Your return for order {orderNumber} is approved. A partner will pick the items up.',
    },
    hi: {
      title: 'रिटर्न स्वीकृत',
      body: 'ऑर्डर {orderNumber} का रिटर्न स्वीकृत है। पार्टनर सामान लेने आएगा।',
    },
  },
  return_rejected: {
    en: {
      title: 'Return not approved',
      body: 'Your return for order {orderNumber} was not approved.',
    },
    hi: {
      title: 'रिटर्न स्वीकृत नहीं',
      body: 'ऑर्डर {orderNumber} का रिटर्न स्वीकृत नहीं हुआ।',
    },
  },
  return_picked_up: {
    en: {
      title: 'Items picked up',
      body: 'We collected the items from order {orderNumber}. We will send the money shortly.',
    },
    hi: {
      title: 'सामान उठा लिया',
      body: 'ऑर्डर {orderNumber} का सामान उठा लिया गया। पैसे जल्द भेजे जाएंगे।',
    },
  },
  refund_sent: {
    en: {
      title: 'Refund sent',
      body: 'We have sent the refund for order {orderNumber}.',
    },
    hi: {
      title: 'रिफंड भेज दिया',
      body: 'ऑर्डर {orderNumber} का रिफंड भेज दिया गया है।',
    },
  },
  partner_new_order: {
    en: {
      title: '🚨 New Order Available!',
      body: 'New order {orderNumber} is waiting for pickup. Tap to view and accept.',
    },
    hi: {
      title: '🚨 नया ऑर्डर उपलब्ध!',
      body: 'नया ऑर्डर {orderNumber} पिकअप का इंतजार कर रहा है। देखने और स्वीकार करने के लिए टैप करें।',
    },
  },
  partner_order_taken: {
    en: {
      title: 'Order taken',
      body: 'Order {orderNumber} was accepted by another partner.',
    },
    hi: {
      title: 'ऑर्डर ले लिया गया',
      body: 'ऑर्डर {orderNumber} किसी अन्य पार्टनर ने स्वीकार कर लिया।',
    },
  },
  partner_job_assigned: {
    en: {
      title: 'Job assigned',
      body: 'Order {orderNumber} has been assigned to you.',
    },
    hi: {
      title: 'काम मिला',
      body: 'ऑर्डर {orderNumber} आपको सौंपा गया है।',
    },
  },
  partner_order_cancelled: {
    en: {
      title: 'Order cancelled',
      body: 'Order {orderNumber} was cancelled.',
    },
    hi: {
      title: 'ऑर्डर रद्द',
      body: 'ऑर्डर {orderNumber} रद्द हो गया।',
    },
  },
  partner_order_delivered: {
    en: {
      title: 'Order delivered',
      body: 'Order {orderNumber} was marked delivered.',
    },
    hi: {
      title: 'ऑर्डर डिलीवर',
      body: 'ऑर्डर {orderNumber} डिलीवर मार्क हो गया।',
    },
  },
  partner_return_pickup: {
    en: {
      title: 'Return pickup',
      body: 'Pick up damaged items for order {orderNumber}.',
    },
    hi: {
      title: 'रिटर्न पिकअप',
      body: 'ऑर्डर {orderNumber} का खराब सामान उठाएं।',
    },
  },
};

export function pushCopy(
  key: PushCopyKey,
  locale: PushLocale,
  orderNumber: string,
  extras: PushCopyExtras = {},
): Copy {
  const lang = locale === 'hi' ? 'hi' : 'en';
  const template = COPY[key][lang];
  let body = template.body.replaceAll('{orderNumber}', orderNumber);

  if (key === 'partner_new_order') {
    const bits: string[] = [];
    if (extras.storeName) bits.push(extras.storeName);
    if (extras.area) bits.push(extras.area);
    if (extras.paymentLabel) bits.push(extras.paymentLabel);
    if (extras.amountLabel) bits.push(extras.amountLabel);
    if (bits.length > 0) {
      body =
        lang === 'hi'
          ? `ऑर्डर ${orderNumber} · ${bits.join(' · ')}. स्वीकार करने के लिए टैप करें।`
          : `New order ${orderNumber} · ${bits.join(' · ')}. Tap to view and accept.`;
    }
  }

  return {
    title: template.title,
    body,
  };
}
