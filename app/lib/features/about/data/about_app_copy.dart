import '../data/legal_models.dart';

/// Localized copy for the “About the App” screen body.
abstract final class AboutAppCopy {
  static const overview = L10nText(
    en:
        'DayFax is a local quick-commerce app that connects customers with nearby stores and delivery partners in supported service areas. Browse groceries, vegetables, food, and daily essentials, add items to your cart, choose a delivery address, and place orders with online payment or cash on delivery where enabled.',
    hi:
        'डेफैक्स एक लोकल क्विक-कॉमर्स ऐप है जो समर्थित क्षेत्रों में ग्राहकों को नज़दीकी स्टोर और डिलीवरी पार्टनर से जोड़ता है। आप किराना, सब्ज़ी, खाना और रोज़मर्रा की ज़रूरतें ब्राउज़ कर सकते हैं, कार्ट में जोड़ सकते हैं, पता चुन सकते हैं, और ऑनलाइन या जहाँ उपलब्ध हो कैश ऑन डिलीवरी से ऑर्डर कर सकते हैं।',
  );

  static const intendedFor = L10nText(
    en:
        'DayFax is intended for customers who want everyday essentials delivered in supported areas, and for delivery partner roles where enabled.',
    hi:
        'डेफैक्स उन ग्राहकों के लिए है जो समर्थित क्षेत्रों में रोज़मर्रा की ज़रूरतें मँगवाना चाहते हैं, और डिलीवरी पार्टनर भूमिकाओं के लिए (जहाँ सक्षम हो)।',
  );

  static const features = <L10nText>[
    L10nText(
      en: 'Catalogue browsing, search, cart, and checkout',
      hi: 'कैटलॉग ब्राउज़िंग, खोज, कार्ट और चेकआउट',
    ),
    L10nText(
      en: 'Saved delivery addresses and location assistance',
      hi: 'सहेजे गए डिलीवरी पते और स्थान सहायता',
    ),
    L10nText(
      en: 'Order tracking and push notifications',
      hi: 'ऑर्डर ट्रैकिंग और पुश नोटिफ़िकेशन',
    ),
    L10nText(
      en: 'Phone OTP, password, and Google Sign-In',
      hi: 'फ़ोन OTP, पासवर्ड और Google साइन-इन',
    ),
    L10nText(
      en: 'Order support chat and damage returns for delivered orders',
      hi: 'डिलीवर ऑर्डर के लिए सहायता चैट और क्षति रिटर्न',
    ),
    L10nText(
      en: 'English and Hindi language support',
      hi: 'अंग्रेज़ी और हिंदी भाषा समर्थन',
    ),
  ];
}
