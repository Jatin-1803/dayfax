/// Partner day filter uses the India calendar, not the device zone.
const _istOffset = Duration(hours: 5, minutes: 30);

DateTime partnerTodayDate([DateTime? now]) {
  final utc = (now ?? DateTime.now()).toUtc();
  final ist = utc.add(_istOffset);
  return DateTime(ist.year, ist.month, ist.day);
}

String formatPartnerDate(DateTime date) {
  final year = date.year.toString().padLeft(4, '0');
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
}

String partnerToday([DateTime? now]) => formatPartnerDate(partnerTodayDate(now));

String partnerYesterday([DateTime? now]) {
  final today = partnerTodayDate(now);
  return formatPartnerDate(today.subtract(const Duration(days: 1)));
}

DateTime? parsePartnerDate(String? value) {
  if (value == null || !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) return null;
  final parts = value.split('-');
  final year = int.tryParse(parts[0]);
  final month = int.tryParse(parts[1]);
  final day = int.tryParse(parts[2]);
  if (year == null || month == null || day == null) return null;
  final date = DateTime(year, month, day);
  if (date.year != year || date.month != month || date.day != day) return null;
  final today = partnerTodayDate();
  if (date.isAfter(today)) return null;
  return date;
}

String partnerDateOrToday(String? value) =>
    parsePartnerDate(value) == null ? partnerToday() : value!;
