import 'about_config.dart';
import 'legal_models.dart';

/// Catalog of About hub entries and full legal documents.
///
/// Content is derived from published dayfax.in policies and current app behaviour
/// (auth, orders, Razorpay/COD, returns, location, push, Google Sign-In, support).
abstract final class LegalCatalog {
  static List<LegalDocumentMeta> menuDocuments() => const [
        LegalDocumentMeta(
          id: LegalDocumentId.terms,
          title: L10nText(en: 'Terms & Conditions', hi: 'नियम और शर्तें'),
          shortDescription: L10nText(
            en: 'Rules for using DayFax accounts and orders',
            hi: 'डेफैक्स खाते और ऑर्डर इस्तेमाल के नियम',
          ),
          icon: IconDataRef.description,
          externalUrl: AboutConfig.termsUrl,
        ),
        LegalDocumentMeta(
          id: LegalDocumentId.privacy,
          title: L10nText(en: 'Privacy Policy', hi: 'गोपनीयता नीति'),
          shortDescription: L10nText(
            en: 'How we collect, use, and protect your data',
            hi: 'हम आपका डेटा कैसे एकत्र, उपयोग और सुरक्षित रखते हैं',
          ),
          icon: IconDataRef.privacyTip,
          externalUrl: AboutConfig.privacyPolicyUrl,
        ),
        LegalDocumentMeta(
          id: LegalDocumentId.refund,
          title: L10nText(
            en: 'Refund & Cancellation Policy',
            hi: 'रिफंड और रद्दीकरण नीति',
          ),
          shortDescription: L10nText(
            en: 'Cancellations, returns, and refunds',
            hi: 'रद्द करना, रिटर्न और रिफंड',
          ),
          icon: IconDataRef.currencyExchange,
        ),
        LegalDocumentMeta(
          id: LegalDocumentId.community,
          title: L10nText(en: 'Community Guidelines', hi: 'समुदाय दिशानिर्देश'),
          shortDescription: L10nText(
            en: 'Respectful use of chat, support, and partner interactions',
            hi: 'चैट, सहायता और पार्टनर व्यवहार के नियम',
          ),
          icon: IconDataRef.groups,
        ),
        LegalDocumentMeta(
          id: LegalDocumentId.safety,
          title: L10nText(
            en: 'User Safety & Responsible Use',
            hi: 'उपयोगकर्ता सुरक्षा और जिम्मेदार उपयोग',
          ),
          shortDescription: L10nText(
            en: 'Stay safe, secure your account, and report concerns',
            hi: 'सुरक्षित रहें, खाता सुरक्षित रखें और समस्या बताएँ',
          ),
          icon: IconDataRef.healthAndSafety,
        ),
        LegalDocumentMeta(
          id: LegalDocumentId.disclaimer,
          title: L10nText(en: 'Disclaimer', hi: 'अस्वीकरण'),
          shortDescription: L10nText(
            en: 'Service availability and responsibility limits',
            hi: 'सेवा उपलब्धता और जिम्मेदारी की सीमाएँ',
          ),
          icon: IconDataRef.gavel,
        ),
      ];

  static LegalDocument document(LegalDocumentId id) {
    return switch (id) {
      LegalDocumentId.terms => _terms,
      LegalDocumentId.privacy => _privacy,
      LegalDocumentId.refund => _refund,
      LegalDocumentId.community => _community,
      LegalDocumentId.safety => _safety,
      LegalDocumentId.disclaimer => _disclaimer,
    };
  }

  static const _v = AboutConfig.legalDocumentsVersion;
  static const _effective = AboutConfig.legalEffectiveDate;
  static const _updated = AboutConfig.legalLastUpdated;

  static final LegalDocument _terms = LegalDocument(
    id: LegalDocumentId.terms,
    title: const L10nText(en: 'Terms & Conditions', hi: 'नियम और शर्तें'),
    version: _v,
    effectiveDate: _effective,
    lastUpdated: _updated,
    externalUrl: AboutConfig.termsUrl,
    sections: [
      LegalSection(
        title: const L10nText(en: '1. Introduction', hi: '1. परिचय'),
        paragraphs: [
          L10nText(
            en:
                'These Terms & Conditions (“Terms”) govern your use of the DayFax mobile application and website at dayfax.in. By creating an account, signing in, or placing an order, you agree to these Terms.',
            hi:
                'ये नियम और शर्तें (“नियम”) डेफैक्स मोबाइल ऐप और dayfax.in वेबसाइट के उपयोग पर लागू होते हैं। खाता बनाकर, साइन इन करके या ऑर्डर देकर आप इन नियमों से सहमत होते हैं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '2. About DayFax', hi: '2. डेफैक्स के बारे में'),
        paragraphs: [
          L10nText(
            en:
                'DayFax provides a local quick-commerce platform connecting customers with nearby stores and delivery partners for food, grocery, vegetables, and other daily essentials in supported service areas in ${AboutConfig.governingLawRegion}.',
            hi:
                'डेफैक्स एक लोकल क्विक-कॉमर्स प्लेटफ़ॉर्म है जो ग्राहकों को नज़दीकी स्टोर और डिलीवरी पार्टनर से जोड़ता है — खाना, किराना, सब्ज़ी और अन्य रोज़मर्रा की ज़रूरतें, जहाँ सेवा उपलब्ध है (${AboutConfig.governingLawRegion})।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '3. Eligibility', hi: '3. पात्रता'),
        paragraphs: [
          L10nText(
            en:
                'You must be at least ${AboutConfig.minimumAgeYears} years old and capable of entering a binding contract under Indian law to use DayFax. You are responsible for keeping your phone number, OTP access, password, and Google account access secure.',
            hi:
                'डेफैक्स उपयोग करने के लिए आपकी आयु कम से कम ${AboutConfig.minimumAgeYears} वर्ष होनी चाहिए और भारतीय कानून के अंतर्गत अनुबंध करने की क्षमता होनी चाहिए। आप अपने फ़ोन नंबर, OTP, पासवर्ड और Google खाते की सुरक्षा के लिए जिम्मेदार हैं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '4. User account', hi: '4. उपयोगकर्ता खाता'),
        paragraphs: [
          const L10nText(
            en:
                'You may register or sign in using a mobile number with OTP verification, a password (where set), and/or Google Sign-In. Some account actions (such as delivery updates) may require linking a phone number.',
            hi:
                'आप मोबाइल नंबर और OTP, पासवर्ड (यदि सेट हो), और/या Google साइन-इन से पंजीकरण या साइन इन कर सकते हैं। कुछ कार्यों (जैसे डिलीवरी अपडेट) के लिए फ़ोन नंबर जोड़ना आवश्यक हो सकता है।',
          ),
        ],
        bullets: const [
          L10nText(
            en: 'Provide accurate information and keep it up to date.',
            hi: 'सही जानकारी दें और उसे अपडेट रखें।',
          ),
          L10nText(
            en: 'You are responsible for activity under your account.',
            hi: 'आपके खाते की गतिविधि की जिम्मेदारी आपकी है।',
          ),
          L10nText(
            en:
                'We may suspend or terminate accounts that misuse the service, violate these Terms, or present safety or fraud risks.',
            hi:
                'सेवा का दुरुपयोग, नियमों का उल्लंघन, या सुरक्षा/धोखाधड़ी जोखिम पर हम खाता निलंबित या समाप्त कर सकते हैं।',
          ),
          L10nText(
            en:
                'You may request account deletion by contacting support (see Privacy Policy and Contact & Support). Pending orders and legal retention requirements may apply.',
            hi:
                'आप सहायता से संपर्क कर खाता हटाने का अनुरोध कर सकते हैं (गोपनीयता नीति और संपर्क देखें)। लंबित ऑर्डर और कानूनी संरक्षण लागू हो सकते हैं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '5. Acceptable use', hi: '5. स्वीकार्य उपयोग'),
        paragraphs: [
          const L10nText(
            en: 'You agree not to:',
            hi: 'आप सहमत हैं कि आप नहीं करेंगे:',
          ),
        ],
        bullets: const [
          L10nText(
            en: 'Use DayFax for unlawful, harmful, or fraudulent purposes.',
            hi: 'डेफैक्स का अवैध, हानिकारक या धोखाधड़ी वाले उद्देश्यों के लिए उपयोग।',
          ),
          L10nText(
            en: 'Interfere with the app, APIs, or other users’ accounts.',
            hi: 'ऐप, API या अन्य उपयोगकर्ताओं के खातों में दखल।',
          ),
          L10nText(
            en: 'Attempt unauthorised access, scraping, reverse engineering, or overloading our systems.',
            hi: 'अनधिकृत पहुँच, स्क्रैपिंग, रिवर्स इंजीनियरिंग या सिस्टम पर अत्यधिक भार।',
          ),
          L10nText(
            en: 'Misrepresent identity, delivery details, payment status, or damage claims.',
            hi: 'पहचान, डिलीवरी विवरण, भुगतान स्थिति या नुकसान के दावों में गलत जानकारी।',
          ),
          L10nText(
            en: 'Harass customers, support staff, or delivery partners.',
            hi: 'ग्राहकों, सहायता टीम या डिलीवरी पार्टनर को परेशान करना।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '6. User content', hi: '6. उपयोगकर्ता सामग्री'),
        paragraphs: [
          const L10nText(
            en:
                'DayFax is not a public social network. Limited user-submitted content may include profile name, delivery addresses, order-support chat messages, and photos you upload for damage/return requests. You retain ownership of content you submit. You grant DayFax a limited licence to use that content solely to operate support, fulfilment, fraud prevention, and legal compliance. Do not submit illegal, abusive, or irrelevant content. We may remove or refuse content that violates these Terms.',
            hi:
                'डेफैक्स सार्वजनिक सोशल नेटवर्क नहीं है। सीमित उपयोगकर्ता सामग्री में प्रोफ़ाइल नाम, डिलीवरी पते, ऑर्डर-सहायता चैट संदेश, और रिटर्न/नुकसान के लिए अपलोड की गई फ़ोटो शामिल हो सकती हैं। आपकी सामग्री का स्वामित्व आपका रहता है। आप डेफैक्स को केवल सहायता, पूर्ति, धोखाधड़ी रोकथाम और कानूनी अनुपालन के लिए सीमित लाइसेंस देते हैं। अवैध, अपमानजनक या असंगत सामग्री न भेजें। उल्लंघन पर हम सामग्री हटा या अस्वीकार कर सकते हैं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(
          en: '7. Orders, payments, and delivery',
          hi: '7. ऑर्डर, भुगतान और डिलीवरी',
        ),
        bullets: const [
          L10nText(
            en:
                'Product availability, prices, and delivery fees may change and can vary by store and location.',
            hi:
                'उत्पाद उपलब्धता, कीमतें और डिलीवरी शुल्क बदल सकते हैं और स्टोर/स्थान के अनुसार भिन्न हो सकते हैं।',
          ),
          L10nText(
            en: 'An order is accepted when we confirm it in the app.',
            hi: 'ऐप में पुष्टि होने पर ऑर्डर स्वीकार माना जाता है।',
          ),
          L10nText(
            en:
                'Payments may be collected through supported methods (for example UPI, cards, wallets via our payment partner, or cash on delivery where enabled). DayFax does not store your full card or banking credentials in the app.',
            hi:
                'भुगतान समर्थित तरीकों से हो सकता है (जैसे UPI, कार्ड, वॉलेट हमारे भुगतान पार्टनर के माध्यम से, या जहाँ उपलब्ध हो कैश ऑन डिलीवरी)। डेफैक्स ऐप में आपके पूरे कार्ड या बैंकिंग विवरण संग्रहीत नहीं करता।',
          ),
          L10nText(
            en:
                'Estimated delivery times are indicative, not guarantees. Provide a reachable address and be available to receive the order.',
            hi:
                'अनुमानित डिलीवरी समय संकेत मात्र हैं, गारंटी नहीं। सही पता दें और ऑर्डर लेने के लिए उपलब्ध रहें।',
          ),
          L10nText(
            en:
                'Cancellation, return, and refund rules are described in the Refund & Cancellation Policy.',
            hi:
                'रद्द करने, रिटर्न और रिफंड के नियम रिफंड और रद्दीकरण नीति में दिए गए हैं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '8. Intellectual property', hi: '8. बौद्धिक संपदा'),
        paragraphs: [
          const L10nText(
            en:
                'DayFax branding, logos, app content, graphics, text, and software are owned by DayFax or its licensors. You receive a limited, non-exclusive licence to use the app for personal, non-commercial ordering as intended. You may not copy, modify, or redistribute proprietary materials without permission.',
            hi:
                'डेफैक्स ब्रांडिंग, लोगो, ऐप सामग्री, ग्राफ़िक्स, टेक्स्ट और सॉफ़्टवेयर डेफैक्स या उसके लाइसेंसदाताओं के हैं। आपको व्यक्तिगत, गैर-व्यावसायिक ऑर्डरिंग के लिए सीमित, गैर-विशिष्ट लाइसेंस मिलता है। बिना अनुमति मालिकाना सामग्री की नकल, बदलाव या पुनर्वितरण न करें।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '9. Third-party services', hi: '9. तृतीय-पक्ष सेवाएँ'),
        paragraphs: [
          const L10nText(
            en:
                'DayFax uses third-party services to operate features such as payments, maps/geocoding, push notifications, Google Sign-In, and cloud infrastructure. Those providers process data as needed to provide their services, under their own terms where applicable.',
            hi:
                'डेफैक्स भुगतान, मानचित्र/जियोकोडिंग, पुश नोटिफ़िकेशन, Google साइन-इन और क्लाउड इन्फ्रा जैसी सुविधाओं के लिए तृतीय-पक्ष सेवाओं का उपयोग करता है। वे प्रदाता अपनी सेवाओं के लिए आवश्यक डेटा संसाधित करते हैं, जहाँ लागू हो उनके अपने नियमों के अधीन।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '10. Service availability', hi: '10. सेवा उपलब्धता'),
        paragraphs: [
          const L10nText(
            en:
                'Service areas, store hours, stock, and features may vary. Maintenance, updates, outages, or technical issues may temporarily affect availability. We do not guarantee uninterrupted or error-free service.',
            hi:
                'सेवा क्षेत्र, स्टोर समय, स्टॉक और सुविधाएँ भिन्न हो सकती हैं। रखरखाव, अपडेट, आउटेज या तकनीकी समस्याएँ अस्थायी रूप से उपलब्धता प्रभावित कर सकती हैं। हम निर्बाध या त्रुटि-मुक्त सेवा की गारंटी नहीं देते।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(
          en: '11. Limitation of liability',
          hi: '11. दायित्व की सीमा',
        ),
        paragraphs: [
          const L10nText(
            en:
                'To the fullest extent permitted by law, DayFax is not liable for indirect, incidental, or consequential damages arising from use of the service. Our total liability for any claim relating to an order is limited to the amount you paid for that order, except where liability cannot be limited under applicable Indian law (including for proven personal injury caused by negligence where such exclusion is not allowed).',
            hi:
                'कानून द्वारा अनुमत अधिकतम सीमा तक, सेवा के उपयोग से उत्पन्न अप्रत्यक्ष, आकस्मिक या परिणामी नुकसान के लिए डेफैक्स उत्तरदायी नहीं है। किसी ऑर्डर संबंधी दावे में हमारा कुल दायित्व उस ऑर्डर के लिए आपके द्वारा भुगतान की गई राशि तक सीमित है, सिवाय जहाँ भारतीय कानून के अंतर्गत दायित्व सीमित नहीं किया जा सकता।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '12. Changes to Terms', hi: '12. नियमों में बदलाव'),
        paragraphs: [
          const L10nText(
            en:
                'We may update features and these Terms. The version and “Last updated” date shown with this document will change when we do. Material updates may also be communicated in the app or on dayfax.in. Continued use after an update constitutes acceptance. If you do not agree, stop using DayFax.',
            hi:
                'हम सुविधाएँ और ये नियम अपडेट कर सकते हैं। दस्तावेज़ का संस्करण और “अंतिम अपडेट” तारीख बदल जाएगी। महत्वपूर्ण बदलाव ऐप या dayfax.in पर भी बताए जा सकते हैं। अपडेट के बाद उपयोग जारी रखना स्वीकृति माना जाता है। असहमत होने पर डेफैक्स का उपयोग बंद करें।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '13. Termination', hi: '13. समाप्ति'),
        paragraphs: [
          const L10nText(
            en:
                'We may suspend or terminate access for Terms violations, fraud, abuse, legal requirements, or operational risk. You may stop using the app at any time and may request account deletion through support.',
            hi:
                'नियम उल्लंघन, धोखाधड़ी, दुरुपयोग, कानूनी आवश्यकता या परिचालन जोखिम पर हम पहुँच निलंबित या समाप्त कर सकते हैं। आप कभी भी ऐप उपयोग बंद कर सकते हैं और सहायता के माध्यम से खाता हटाने का अनुरोध कर सकते हैं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '14. Governing law', hi: '14. लागू कानून'),
        paragraphs: [
          L10nText(
            en:
                'These Terms are governed by the laws of ${AboutConfig.governingLawRegion}. Courts in ${AboutConfig.governingLawRegion} shall have jurisdiction, subject to applicable consumer protection rights.',
            hi:
                'ये नियम ${AboutConfig.governingLawRegion} के कानूनों द्वारा शासित हैं। लागू उपभोक्ता संरक्षण अधिकारों के अधीन ${AboutConfig.governingLawRegion} की अदालतों का क्षेत्राधिकार होगा।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '15. Contact', hi: '15. संपर्क'),
        paragraphs: [
          L10nText(
            en:
                'Questions about these Terms: ${AboutConfig.supportEmail} or ${AboutConfig.websiteUrl}.',
            hi:
                'इन नियमों के बारे में प्रश्न: ${AboutConfig.supportEmail} या ${AboutConfig.websiteUrl}।',
          ),
        ],
      ),
    ],
  );

  static final LegalDocument _privacy = LegalDocument(
    id: LegalDocumentId.privacy,
    title: const L10nText(en: 'Privacy Policy', hi: 'गोपनीयता नीति'),
    version: _v,
    effectiveDate: _effective,
    lastUpdated: _updated,
    externalUrl: AboutConfig.privacyPolicyUrl,
    sections: [
      LegalSection(
        title: const L10nText(en: 'Introduction', hi: 'परिचय'),
        paragraphs: [
          L10nText(
            en:
                'DayFax (“we”, “us”) operates the DayFax mobile application and website at dayfax.in. This Privacy Policy explains how we collect, use, store, and share personal information when you use our services in ${AboutConfig.governingLawRegion}.',
            hi:
                'डेफैक्स (“हम”) डेफैक्स मोबाइल ऐप और dayfax.in वेबसाइट संचालित करता है। यह गोपनीयता नीति बताती है कि ${AboutConfig.governingLawRegion} में हमारी सेवाओं का उपयोग करते समय हम व्यक्तिगत जानकारी कैसे एकत्र, उपयोग, संग्रहीत और साझा करते हैं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(
          en: '1. Information we collect',
          hi: '1. हम जो जानकारी एकत्र करते हैं',
        ),
        paragraphs: [
          const L10nText(
            en: 'We collect information needed to run DayFax. Categories include:',
            hi: 'डेफैक्स चलाने के लिए आवश्यक जानकारी एकत्र की जाती है। श्रेणियाँ:',
          ),
        ],
        bullets: const [
          L10nText(
            en:
                'Account information: mobile phone number, name, email (for example when signing in with Google), OTP verification details, and password credentials when you set a password (stored securely as hashed values — we do not store plaintext passwords).',
            hi:
                'खाता जानकारी: मोबाइल नंबर, नाम, ईमेल (जैसे Google साइन-इन पर), OTP विवरण, और पासवर्ड सेट करने पर सुरक्षित हैश (सादा पासवर्ड संग्रहीत नहीं)।',
          ),
          L10nText(
            en:
                'Addresses: delivery addresses and related location details you provide or confirm.',
            hi: 'पते: आपके द्वारा दिए या पुष्टि किए गए डिलीवरी पते और संबंधित स्थान विवरण।',
          ),
          L10nText(
            en:
                'Transaction information: cart contents, orders, order status, payment status, and transaction references from our payment partner. We do not store complete card or bank account numbers in the DayFax app.',
            hi:
                'लेन-देन जानकारी: कार्ट, ऑर्डर, स्थिति, भुगतान स्थिति और भुगतान पार्टनर के संदर्भ। डेफैक्स ऐप में पूरे कार्ड या बैंक खाता नंबर संग्रहीत नहीं होते।',
          ),
          L10nText(
            en:
                'Device information: app version, build, device type / platform, operating system version, and a generated device identifier used for security, sessions, and push delivery.',
            hi:
                'डिवाइस जानकारी: ऐप संस्करण, बिल्ड, डिवाइस प्रकार/प्लेटफ़ॉर्म, OS संस्करण, और सुरक्षा/सत्र/पुश के लिए जनरेट किया गया डिवाइस पहचानकर्ता।',
          ),
          L10nText(
            en:
                'Location information (when you allow it): approximate and/or precise location to help set delivery addresses, show nearby stores, and support delivery. You can control location permission in device settings.',
            hi:
                'स्थान जानकारी (अनुमति होने पर): डिलीवरी पता, नज़दीकी स्टोर और डिलीवरी सहायता के लिए अनुमानित और/या सटीक स्थान। अनुमति डिवाइस सेटिंग में नियंत्रित करें।',
          ),
          L10nText(
            en:
                'Usage and diagnostics: basic logs and interactions needed for security, support, and reliability (including IP address where collected by our servers).',
            hi:
                'उपयोग और डायग्नोस्टिक्स: सुरक्षा, सहायता और विश्वसनीयता के लिए मूल लॉग/इंटरैक्शन (जहाँ सर्वर एकत्र करें, IP पता सहित)।',
          ),
          L10nText(
            en:
                'Support content: messages you send in order support chat and photos you upload for damaged-item return requests.',
            hi:
                'सहायता सामग्री: ऑर्डर सहायता चैट संदेश और क्षतिग्रस्त आइटम रिटर्न के लिए अपलोड की गई फ़ोटो।',
          ),
          L10nText(
            en:
                'Push notification tokens: when notifications are enabled, so we can send order and service alerts.',
            hi:
                'पुश नोटिफ़िकेशन टोकन: नोटिफ़िकेशन चालू होने पर ऑर्डर और सेवा अलर्ट भेजने के लिए।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(
          en: '2. Purpose of data collection',
          hi: '2. डेटा एकत्र करने का उद्देश्य',
        ),
        bullets: const [
          L10nText(
            en: 'Create and manage your account, including OTP, password, and Google Sign-In.',
            hi: 'OTP, पासवर्ड और Google साइन-इन सहित खाता बनाना और प्रबंधित करना।',
          ),
          L10nText(
            en: 'Process orders, payments, refunds, deliveries, and returns.',
            hi: 'ऑर्डर, भुगतान, रिफंड, डिलीवरी और रिटर्न संसाधित करना।',
          ),
          L10nText(
            en: 'Communicate about orders, support, and important service updates.',
            hi: 'ऑर्डर, सहायता और महत्वपूर्ण सेवा अपडेट की जानकारी देना।',
          ),
          L10nText(
            en: 'Improve reliability, prevent fraud, and secure our systems.',
            hi: 'विश्वसनीयता सुधारना, धोखाधड़ी रोकना और सिस्टम सुरक्षित रखना।',
          ),
          L10nText(
            en: 'Provide customer support for the orders you own.',
            hi: 'आपके ऑर्डर के लिए ग्राहक सहायता प्रदान करना।',
          ),
          L10nText(
            en: 'Comply with applicable laws and respond to lawful requests.',
            hi: 'लागू कानूनों का पालन और वैध अनुरोधों का उत्तर।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(
          en: '3. Third-party services',
          hi: '3. तृतीय-पक्ष सेवाएँ',
        ),
        paragraphs: [
          const L10nText(
            en:
                'Depending on features you use, DayFax may share necessary data with processors that help us operate the service, including:',
            hi:
                'उपयोग की गई सुविधाओं के अनुसार, डेफैक्स सेवा चलाने वाले प्रोसेसर के साथ आवश्यक डेटा साझा कर सकता है, जिनमें शामिल हैं:',
          ),
        ],
        bullets: const [
          L10nText(
            en: 'Google Sign-In (authentication when you choose Google).',
            hi: 'Google साइन-इन (जब आप Google चुनते हैं)।',
          ),
          L10nText(
            en: 'Firebase Cloud Messaging (push notifications).',
            hi: 'Firebase Cloud Messaging (पुश नोटिफ़िकेशन)।',
          ),
          L10nText(
            en: 'Razorpay (online payments and related refunds).',
            hi: 'Razorpay (ऑनलाइन भुगतान और संबंधित रिफंड)।',
          ),
          L10nText(
            en: 'Maps / geolocation providers used via device location and geocoding libraries.',
            hi: 'डिवाइस स्थान और जियोकोडिंग लाइब्रेरी के माध्यम से मानचित्र/जियोलोकेशन।',
          ),
          L10nText(
            en: 'Cloud hosting and infrastructure providers that run our backend.',
            hi: 'हमारा बैकएंड चलाने वाले क्लाउड होस्टिंग/इन्फ्रा प्रदाता।',
          ),
          L10nText(
            en:
                'AI-assisted order support tooling operated on our servers to help resolve issues for your order (customer-facing support does not disclose internal tooling details).',
            hi:
                'आपके ऑर्डर की समस्याओं में मदद के लिए हमारे सर्वर पर संचालित सहायता टूलिंग (ग्राहक-सामने आंतरिक टूलिंग विवरण नहीं बताए जाते)।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '4. Data sharing', hi: '4. डेटा साझाकरण'),
        paragraphs: [
          const L10nText(
            en: 'We do not sell your personal information. We may share data with:',
            hi: 'हम आपकी व्यक्तिगत जानकारी नहीं बेचते। हम डेटा साझा कर सकते हैं:',
          ),
        ],
        bullets: const [
          L10nText(
            en: 'Delivery partners assigned to fulfil your order or approved return pickup.',
            hi: 'आपके ऑर्डर या स्वीकृत रिटर्न पिकअप के डिलीवरी पार्टनर।',
          ),
          L10nText(
            en: 'Payment processors and infrastructure providers who help run DayFax.',
            hi: 'भुगतान प्रोसेसर और इन्फ्रा प्रदाता जो डेफैक्स चलाने में मदद करते हैं।',
          ),
          L10nText(
            en: 'Authorities when required by law or to protect rights and safety.',
            hi: 'कानून द्वारा आवश्यक होने या अधिकार/सुरक्षा की रक्षा हेतु प्राधिकरण।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '5. Data security', hi: '5. डेटा सुरक्षा'),
        paragraphs: [
          const L10nText(
            en:
                'We use reasonable technical and organisational measures to protect personal data, including encrypted transport (HTTPS), authentication controls, and access controls. No method of transmission or storage is 100% secure.',
            hi:
                'हम व्यक्तिगत डेटा की सुरक्षा के लिए उचित तकनीकी और संगठनात्मक उपाय उपयोग करते हैं, जिनमें एन्क्रिप्टेड ट्रांसपोर्ट (HTTPS), प्रमाणीकरण नियंत्रण और पहुँच नियंत्रण शामिल हैं। कोई भी तरीका 100% सुरक्षित नहीं होता।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '6. Data retention', hi: '6. डेटा संरक्षण'),
        paragraphs: [
          const L10nText(
            en:
                'We keep account, order, payment, support, and related records for as long as needed to provide the service, meet legal and accounting requirements, resolve disputes, prevent fraud, and enforce our agreements. Retention periods can vary by record type and legal obligation.',
            hi:
                'हम खाता, ऑर्डर, भुगतान, सहायता और संबंधित रिकॉर्ड तब तक रखते हैं जब तक सेवा देने, कानूनी/लेखांकन आवश्यकताओं, विवाद समाधान, धोखाधड़ी रोकथाम और समझौतों को लागू करने के लिए आवश्यक हो। अवधि रिकॉर्ड प्रकार और कानूनी दायित्व के अनुसार भिन्न हो सकती है।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '7. Delete your account', hi: '7. अपना खाता हटाएँ'),
        paragraphs: [
          L10nText(
            en:
                'There is currently no fully automated in-app account deletion button. To request deletion of your DayFax account, email ${AboutConfig.supportEmail} from your registered contact details (include your phone number or account email), or visit ${AboutConfig.deleteAccountUrl}. You can also start this from Profile → Delete account.',
            hi:
                'अभी ऐप में पूर्ण स्वचालित खाता-हटाने का बटन नहीं है। खाता हटाने का अनुरोध ${AboutConfig.supportEmail} पर अपने पंजीकृत संपर्क से ईमेल करें (फ़ोन या खाता ईमेल शामिल करें), या ${AboutConfig.deleteAccountUrl} देखें। आप प्रोफ़ाइल → खाता हटाएँ से भी शुरू कर सकते हैं।',
          ),
          const L10nText(
            en:
                'After verification, we delete or anonymise personal data that is no longer required. We may retain certain information where needed for pending orders, refunds, fraud prevention, dispute resolution, or legal/accounting obligations. Processing time depends on verification and any open orders.',
            hi:
                'सत्यापन के बाद हम वह व्यक्तिगत डेटा हटाते या गुमनाम बना देते हैं जिसकी आवश्यकता नहीं। लंबित ऑर्डर, रिफंड, धोखाधड़ी रोकथाम, विवाद या कानूनी/लेखांकन दायित्वों के लिए कुछ जानकारी रखी जा सकती है। समय सत्यापन और खुले ऑर्डर पर निर्भर करता है।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '8. Your privacy rights', hi: '8. आपकी गोपनीयता अधिकार'),
        paragraphs: [
          const L10nText(
            en:
                'Subject to applicable Indian law, you may request access to or correction of personal information we hold, and request deletion as described above. You may withdraw optional consents (such as location or notifications) via device settings. Contact us to exercise these rights. Some requests may be limited by law or by our need to complete transactions and security checks.',
            hi:
                'लागू भारतीय कानून के अधीन, आप हमारे पास मौजूद व्यक्तिगत जानकारी तक पहुँच या सुधार का अनुरोध कर सकते हैं, और ऊपर बताए अनुसार हटाने का अनुरोध कर सकते हैं। वैकल्पिक सहमति (स्थान/नोटिफ़िकेशन) डिवाइस सेटिंग से वापस ले सकते हैं। इन अधिकारों के लिए हमसे संपर्क करें। कुछ अनुरोध कानून या लेन-देन/सुरक्षा जाँच की आवश्यकता से सीमित हो सकते हैं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '9. Children’s privacy', hi: '9. बच्चों की गोपनीयता'),
        paragraphs: [
          L10nText(
            en:
                'DayFax is not directed at children under ${AboutConfig.minimumAgeYears}. We do not knowingly collect personal information from children under ${AboutConfig.minimumAgeYears}. If you believe a minor has provided personal data, contact ${AboutConfig.supportEmail} so we can take appropriate action.',
            hi:
                'डेफैक्स ${AboutConfig.minimumAgeYears} वर्ष से कम आयु के बच्चों के लिए नहीं है। हम जानबूझकर ${AboutConfig.minimumAgeYears} से कम आयु के बच्चों से व्यक्तिगत जानकारी नहीं लेते। यदि आपको लगता है कि किसी नाबालिग ने डेटा दिया है, तो ${AboutConfig.supportEmail} पर संपर्क करें।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '10. Changes', hi: '10. बदलाव'),
        paragraphs: [
          const L10nText(
            en:
                'We may update this Privacy Policy from time to time. The version and “Last updated” date will change when we do. Continued use of DayFax after changes means you accept the updated policy.',
            hi:
                'हम समय-समय पर यह नीति अपडेट कर सकते हैं। संस्करण और “अंतिम अपडेट” बदल जाएगा। बदलाव के बाद उपयोग जारी रखना अद्यतन नीति की स्वीकृति है।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '11. Contact', hi: '11. संपर्क'),
        paragraphs: [
          L10nText(
            en:
                'Questions about privacy: ${AboutConfig.supportEmail} or ${AboutConfig.websiteUrl}.',
            hi:
                'गोपनीयता संबंधी प्रश्न: ${AboutConfig.supportEmail} या ${AboutConfig.websiteUrl}।',
          ),
        ],
      ),
    ],
  );

  static final LegalDocument _refund = LegalDocument(
    id: LegalDocumentId.refund,
    title: const L10nText(
      en: 'Refund & Cancellation Policy',
      hi: 'रिफंड और रद्दीकरण नीति',
    ),
    version: _v,
    effectiveDate: _effective,
    lastUpdated: _updated,
    sections: [
      LegalSection(
        title: const L10nText(en: '1. Overview', hi: '1. अवलोकन'),
        paragraphs: [
          const L10nText(
            en:
                'This policy explains when you can cancel orders, request returns, and receive refunds on DayFax. It reflects current product behaviour and may be updated when business rules change.',
            hi:
                'यह नीति बताती है कि डेफैक्स पर आप कब ऑर्डर रद्द कर सकते हैं, रिटर्न माँग सकते हैं और रिफंड पा सकते हैं। यह वर्तमान उत्पाद व्यवहार पर आधारित है और नियमों के बदलने पर अपडेट हो सकती है।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '2. Order cancellation', hi: '2. ऑर्डर रद्द करना'),
        bullets: const [
          L10nText(
            en:
                'You may cancel eligible orders while they are still in early fulfilment stages (for example pending, confirmed, preparing, ready for pickup, or picked up), as shown in the app. Cancellation is generally not available after the order is out for delivery or delivered.',
            hi:
                'आप पात्र ऑर्डर जल्दी पूर्ति चरणों में रद्द कर सकते हैं (जैसे लंबित, पुष्टि, तैयारी, पिकअप के लिए तैयार, या पिकअप हो चुका), जैसा ऐप में दिखे। आउट फॉर डिलीवरी या डिलीवर होने के बाद रद्द करना सामान्यतः उपलब्ध नहीं।',
          ),
          L10nText(
            en:
                'Local shop (food-store) orders cannot be cancelled by the customer in the app.',
            hi: 'लोकल शॉप (फूड स्टोर) ऑर्डर ग्राहक ऐप से रद्द नहीं कर सकता।',
          ),
          L10nText(
            en:
                'If you close an online payment checkout before payment succeeds, that checkout is not a placed order and is not treated as a cancellation of a paid order.',
            hi:
                'यदि ऑनलाइन भुगतान पूरा होने से पहले चेकआउट बंद कर दें, तो वह रखा गया ऑर्डर नहीं माना जाता और भुगतान किए ऑर्डर का रद्दीकरण नहीं है।',
          ),
          L10nText(
            en:
                'We may cancel orders due to unavailability, pricing errors, payment failure, safety concerns, or operational issues.',
            hi:
                'अनुपलब्धता, मूल्य त्रुटि, भुगतान विफलता, सुरक्षा या परिचालन कारणों से हम ऑर्डर रद्द कर सकते हैं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '3. Refunds after cancellation', hi: '3. रद्द करने पर रिफंड'),
        paragraphs: [
          const L10nText(
            en:
                'If you paid online and a cancellable order is cancelled after payment capture, refund processing is initiated through our payment partner (Razorpay) according to their timelines and your payment method. Cash-on-delivery or manual cases may follow a manual refund path where applicable. You will see status updates in the app where available.',
            hi:
                'यदि आपने ऑनलाइन भुगतान किया और भुगतान कैप्चर के बाद रद्द करने योग्य ऑर्डर रद्द होता है, तो रिफंड हमारे भुगतान पार्टनर (Razorpay) के माध्यम से उनकी समयसीमा और आपके भुगतान तरीके के अनुसार शुरू होता है। COD या मैनुअल मामलों में जहाँ लागू हो मैनुअल रिफंड पथ अपनाया जा सकता है।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(
          en: '4. Returns after delivery',
          hi: '4. डिलीवरी के बाद रिटर्न',
        ),
        bullets: const [
          L10nText(
            en:
                'Returns are available only for delivered orders, and only for items that arrived damaged, spoiled, leaked, or broken.',
            hi:
                'रिटर्न केवल डिलीवर ऑर्डर पर, और केवल क्षतिग्रस्त, खराब, लीक या टूटे आइटम के लिए।',
          ),
          L10nText(
            en:
                'Change of mind, delay, taste, or preference is not eligible for refund.',
            hi: 'मन बदलना, देरी, स्वाद या पसंद रिफंड के पात्र नहीं।',
          ),
          L10nText(
            en:
                'Local shop items cannot be returned or refunded.',
            hi: 'लोकल शॉप आइटम रिटर्न या रिफंड नहीं हो सकते।',
          ),
          L10nText(
            en:
                'A damage photo is required. Select items from the in-app list for that order; do not rely on typing item names in chat.',
            hi:
                'क्षति की फ़ोटो आवश्यक है। उस ऑर्डर की इन-ऐप सूची से आइटम चुनें; चैट में नाम टाइप कर निर्भर न रहें।',
          ),
          L10nText(
            en:
                'After approval, a partner picks up the items. The refund is sent after pickup — not before. The delivery fee is not refunded. The original order remains marked delivered; customer-facing return status follows the return request.',
            hi:
                'मंज़ूरी के बाद पार्टनर आइटम पिकअप करता है। रिफंड पिकअप के बाद भेजा जाता है — पहले नहीं। डिलीवरी शुल्क रिफंड नहीं होता। मूल ऑर्डर डिलीवर्ड रहता है; ग्राहक-सामने की स्थिति रिटर्न अनुरोध के अनुसार होती है।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(
          en: '5. Payment failures and duplicates',
          hi: '5. भुगतान विफलता और डुप्लिकेट',
        ),
        paragraphs: [
          const L10nText(
            en:
                'If a payment fails, the order is not successfully paid. If you believe you were charged more than once or charged without a confirmed order, contact support with payment details so we can investigate with our payment partner.',
            hi:
                'भुगतान विफल होने पर ऑर्डर भुगतान-सफल नहीं माना जाता। यदि आपको लगता है कि एक से अधिक बार शुल्क लगा या बिना पुष्टि ऑर्डर के शुल्क लगा, तो भुगतान विवरण के साथ सहायता से संपर्क करें।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '6. Contact', hi: '6. संपर्क'),
        paragraphs: [
          L10nText(
            en:
                'For cancellation or refund help on a specific order, use order support in the app where available, or email ${AboutConfig.supportEmail}.',
            hi:
                'किसी ऑर्डर पर रद्द/रिफंड मदद के लिए ऐप में ऑर्डर सहायता (जहाँ उपलब्ध) उपयोग करें, या ${AboutConfig.supportEmail} पर ईमेल करें।',
          ),
        ],
      ),
    ],
  );

  static final LegalDocument _community = LegalDocument(
    id: LegalDocumentId.community,
    title: const L10nText(en: 'Community Guidelines', hi: 'समुदाय दिशानिर्देश'),
    version: _v,
    effectiveDate: _effective,
    lastUpdated: _updated,
    sections: [
      LegalSection(
        title: const L10nText(en: '1. Scope', hi: '1. दायरा'),
        paragraphs: [
          const L10nText(
            en:
                'DayFax does not offer public social feeds or product review communities. These guidelines apply to interactions that do exist: order support chat, return photo submissions, profile information, and respectful behaviour toward delivery partners and stores.',
            hi:
                'डेफैक्स सार्वजनिक सोशल फीड या प्रोडक्ट रिव्यू समुदाय नहीं देता। ये दिशानिर्देश मौजूदा इंटरैक्शन पर लागू होते हैं: ऑर्डर सहायता चैट, रिटर्न फ़ोटो, प्रोफ़ाइल जानकारी, और डिलीवरी पार्टनर/स्टोर के प्रति सम्मान।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '2. Be respectful', hi: '2. सम्मान रखें'),
        bullets: const [
          L10nText(
            en: 'Communicate politely with support and delivery partners.',
            hi: 'सहायता और डिलीवरी पार्टनर से विनम्रता से बात करें।',
          ),
          L10nText(
            en: 'Do not harass, threaten, or discriminate.',
            hi: 'परेशान, धमकी या भेदभाव न करें।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '3. Prohibited conduct', hi: '3. निषिद्ध आचरण'),
        bullets: const [
          L10nText(
            en: 'Fraud, scams, false damage claims, or payment abuse.',
            hi: 'धोखाधड़ी, स्कैम, झूठे नुकसान के दावे या भुगतान दुरुपयोग।',
          ),
          L10nText(
            en: 'Spam, irrelevant content, or misuse of support chat.',
            hi: 'स्पैम, असंगत सामग्री या सहायता चैट का दुरुपयोग।',
          ),
          L10nText(
            en: 'Illegal activity or sharing illegal content.',
            hi: 'अवैध गतिविधि या अवैध सामग्री साझा करना।',
          ),
          L10nText(
            en: 'Impersonation or attempting to access another person’s account or orders.',
            hi: 'किसी और की पहचान करना या उनके खाते/ऑर्डर तक पहुँचने का प्रयास।',
          ),
          L10nText(
            en: 'Uploading photos unrelated to a legitimate damage/return request.',
            hi: 'वैध नुकसान/रिटर्न से असंबंधित फ़ोटो अपलोड करना।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '4. Reporting and moderation', hi: '4. रिपोर्ट और मॉडरेशन'),
        paragraphs: [
          L10nText(
            en:
                'Report abuse or suspicious activity to ${AboutConfig.supportEmail} or via Contact & Support in the app. We may remove content, refuse return requests that violate policy, and suspend or terminate accounts for serious or repeated violations.',
            hi:
                'दुरुपयोग या संदिग्ध गतिविधि ${AboutConfig.supportEmail} पर या ऐप में संपर्क और सहायता से बताएँ। हम सामग्री हटा सकते हैं, नीति-विरोधी रिटर्न अस्वीकार कर सकते हैं, और गंभीर/बार-बार उल्लंघन पर खाता निलंबित या समाप्त कर सकते हैं।',
          ),
        ],
      ),
    ],
  );

  static final LegalDocument _safety = LegalDocument(
    id: LegalDocumentId.safety,
    title: const L10nText(
      en: 'User Safety & Responsible Use',
      hi: 'उपयोगकर्ता सुरक्षा और जिम्मेदार उपयोग',
    ),
    version: _v,
    effectiveDate: _effective,
    lastUpdated: _updated,
    sections: [
      LegalSection(
        title: const L10nText(en: '1. Safe use of DayFax', hi: '1. सुरक्षित उपयोग'),
        bullets: const [
          L10nText(
            en: 'Order only from locations and addresses you trust and can access safely.',
            hi: 'केवल विश्वसनीय और सुरक्षित पहुँच वाले पतों से ऑर्डर करें।',
          ),
          L10nText(
            en: 'Verify delivery partner identity using in-app order details where relevant.',
            hi: 'जहाँ प्रासंगिक हो, ऐप के ऑर्डर विवरण से डिलीवरी पार्टनर की पहचान जाँचें।',
          ),
          L10nText(
            en: 'Do not share OTPs, passwords, pickup codes, or payment credentials with anyone.',
            hi: 'OTP, पासवर्ड, पिकअप कोड या भुगतान विवरण किसी से साझा न करें।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '2. Account security', hi: '2. खाता सुरक्षा'),
        bullets: const [
          L10nText(
            en: 'Keep your phone and Google account secure.',
            hi: 'अपना फ़ोन और Google खाता सुरक्षित रखें।',
          ),
          L10nText(
            en: 'Use Profile → Devices to sign out sessions you do not recognise.',
            hi: 'अपरिचित सत्र साइन आउट करने के लिए प्रोफ़ाइल → डिवाइस उपयोग करें।',
          ),
          L10nText(
            en: 'Set a strong password if you use password sign-in.',
            hi: 'पासवर्ड साइन-इन उपयोग करते हों तो मजबूत पासवर्ड सेट करें।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '3. Reporting concerns', hi: '3. चिंताएँ रिपोर्ट करें'),
        paragraphs: [
          L10nText(
            en:
                'Report harassment, fraud, unsafe delivery experiences, or suspicious account activity to ${AboutConfig.supportEmail}. For an issue tied to a specific order, open that order’s support chat when available. If you are in immediate danger, contact local emergency services first.',
            hi:
                'उत्पीड़न, धोखाधड़ी, असुरक्षित डिलीवरी या संदिग्ध खाता गतिविधि ${AboutConfig.supportEmail} पर बताएँ। किसी ऑर्डर से जुड़ी समस्या पर जहाँ उपलब्ध हो उस ऑर्डर की सहायता चैट खोलें। तत्काल खतरे में पहले स्थानीय आपातकालीन सेवाओं से संपर्क करें।',
          ),
        ],
      ),
    ],
  );

  static final LegalDocument _disclaimer = LegalDocument(
    id: LegalDocumentId.disclaimer,
    title: const L10nText(en: 'Disclaimer', hi: 'अस्वीकरण'),
    version: _v,
    effectiveDate: _effective,
    lastUpdated: _updated,
    sections: [
      LegalSection(
        title: const L10nText(en: '1. Service information', hi: '1. सेवा जानकारी'),
        paragraphs: [
          const L10nText(
            en:
                'Product details, prices, availability, and delivery estimates shown in the app are provided for ordering convenience and may change. Store and partner information is based on data available to DayFax at the time of display.',
            hi:
                'ऐप में दिखने वाले उत्पाद विवरण, कीमतें, उपलब्धता और डिलीवरी अनुमान ऑर्डर सुविधा के लिए हैं और बदल सकते हैं। स्टोर/पार्टनर जानकारी प्रदर्शन के समय डेफैक्स के पास उपलब्ध डेटा पर आधारित है।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '2. Third-party information', hi: '2. तृतीय-पक्ष जानकारी'),
        paragraphs: [
          const L10nText(
            en:
                'Some catalogue, store, payment, map, or notification experiences depend on third parties. DayFax is not responsible for third-party outages or errors beyond our reasonable control, except where applicable law requires otherwise.',
            hi:
                'कुछ कैटलॉग, स्टोर, भुगतान, मानचित्र या नोटिफ़िकेशन अनुभव तृतीय पक्षों पर निर्भर करते हैं। हमारी उचित नियंत्रण से बाहर आउटेज/त्रुटियों के लिए, जहाँ कानून अन्यथा न कहे, डेफैक्स उत्तरदायी नहीं।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '3. Availability', hi: '3. उपलब्धता'),
        paragraphs: [
          const L10nText(
            en:
                'DayFax is provided on an “as available” basis. We do not warrant uninterrupted service, exact delivery times, or that every product will always be in stock.',
            hi:
                'डेफैक्स “जैसा उपलब्ध” आधार पर प्रदान किया जाता है। हम निर्बाध सेवा, सटीक डिलीवरी समय या हमेशा स्टॉक की गारंटी नहीं देते।',
          ),
        ],
      ),
      LegalSection(
        title: const L10nText(en: '4. User responsibility', hi: '4. उपयोगकर्ता जिम्मेदारी'),
        paragraphs: [
          const L10nText(
            en:
                'You are responsible for providing accurate addresses and contact details, receiving orders safely, and using the app in line with the Terms and applicable law. This disclaimer does not exclude liability that cannot be excluded under Indian consumer protection or other mandatory law.',
            hi:
                'सही पता और संपर्क देना, ऑर्डर सुरक्षित प्राप्त करना, और नियमों व कानून के अनुसार ऐप उपयोग आपकी जिम्मेदारी है। यह अस्वीकरण भारतीय उपभोक्ता संरक्षण या अन्य अनिवार्य कानून के अंतर्गत न हटाए जा सकने वाले दायित्व को बाहर नहीं करता।',
          ),
        ],
      ),
    ],
  );
}
