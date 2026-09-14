/// Google Sign-In configuration (non-secret client IDs only).
///
/// Pass a Web OAuth client ID via:
/// `--dart-define=GOOGLE_SERVER_CLIENT_ID=....apps.googleusercontent.com`
///
/// That same ID must be listed in backend `GOOGLE_CLIENT_IDS`.
const String kGoogleServerClientId = String.fromEnvironment(
  'GOOGLE_SERVER_CLIENT_ID',
  defaultValue:
      '843431847120-602npqj8o479691d0g0r1ncmqa4halkj.apps.googleusercontent.com',
);
