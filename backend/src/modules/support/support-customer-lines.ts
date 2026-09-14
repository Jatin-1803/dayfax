export type SupportLang = 'en' | 'hi';

export function supportLang(value: string | null | undefined): SupportLang {
  return value === 'hi' ? 'hi' : 'en';
}

export function pickerPromptLine(lang: SupportLang): string {
  if (lang === 'hi') {
    return 'नीचे खराब, खराब हुए, लीक या टूटे आइटम चुनें और खराब प्रोडक्ट की फोटो जोड़ें। मैं इसे टीम को भेज दूँगी। नाम लिखने की ज़रूरत नहीं।';
  }
  return 'Please select the damaged, spoiled, leaked, or broken items below and add a photo of the damaged product. I will send that to the team. You do not need to type the names.';
}

export function returnRaisedLine(lang: SupportLang): string {
  if (lang === 'hi') {
    return 'धन्यवाद। मैं चुने हुए आइटम और फोटो टीम को भेज चुकी हूँ। मंजूरी के बाद डिलीवरी पार्टनर पिकअप करेगा, फिर रिफंड भेजा जाएगा। डिलीवरी फीस रिफंड नहीं होती।';
  }
  return 'Thanks. I have sent the selected items and photo to the team. If they approve, a delivery partner will pick the items up, and then the refund will be sent. The delivery fee is not refunded.';
}

export function returnApprovedLine(lang: SupportLang): string {
  if (lang === 'hi') {
    return 'आपकी रिटर्न रिक्वेस्ट मंजूर हो गई है। डिलीवरी पार्टनर आइटम पिकअप करेगा। पिकअप कोड तभी बताएं जब वे आइटम लें। पिकअप के बाद रिफंड भेजा जाएगा। डिलीवरी फीस रिफंड नहीं होती।';
  }
  return 'Your return request is approved. A delivery partner will pick the items up. Share the pickup code only when they collect them. After pickup, the refund will be sent. The delivery fee is not refunded.';
}

export function pickupAcceptedLine(lang: SupportLang): string {
  if (lang === 'hi') {
    return 'डिलीवरी पार्टनर आइटम लेने आ रहा है। पिकअप कोड तभी बताएं जब वे आइटम लें। उसके बाद रिफंड भेजा जाएगा।';
  }
  return 'A delivery partner is on the way to pick up the items. Share the pickup code only when they collect them. After that, the refund will be sent.';
}

export function itemsPickedUpLine(lang: SupportLang): string {
  if (lang === 'hi') {
    return 'आइटम पिकअप हो गए हैं। रिफंड जल्द भेजा जाएगा। डिलीवरी फीस रिफंड नहीं होती।';
  }
  return 'The items have been picked up. The refund will be sent shortly. The delivery fee is not refunded.';
}

export function refundSentLine(lang: SupportLang): string {
  if (lang === 'hi') {
    return 'रिफंड भेज दिया गया है। यह आपके पहले वाले पेमेंट तरीके पर जल्द दिखेगा। डिलीवरी फीस रिफंड नहीं होती।';
  }
  return 'The refund has been sent. It should show on your original payment method shortly. The delivery fee is not refunded.';
}

export function customerWantsItemPicker(text: string): boolean {
  return /damag|spoil|leak|broken|return|wapis|kharb|toot|खराब|टूट|वापस|रिटर्न|लीक/i.test(text);
}
