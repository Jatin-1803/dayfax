import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/i18n/app_locale.dart';
import '../../../../core/i18n/i18n_providers.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/customer/customer_colors.dart';
import '../../../../core/theme/customer/customer_radius.dart';
import '../../../../core/theme/customer/customer_spacing.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/local_shop_note.dart';
import '../../../orders/presentation/orders_view_models.dart';
import '../../data/support_repository.dart';
import '../../domain/support_models.dart';

final supportRepositoryProvider = Provider<SupportRepository>((ref) {
  return SupportRepository(dio: ref.watch(dioProvider));
});

class SupportChatScreen extends ConsumerStatefulWidget {
  const SupportChatScreen({super.key, required this.idOrNumber});

  final String idOrNumber;

  @override
  ConsumerState<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends ConsumerState<SupportChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  SupportThread? _thread;
  var _loading = true;
  var _sending = false;
  String? _error;
  final _selected = <String, int>{};
  final _photos = <XFile>[];
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _open();
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _refresh());
  }

  @override
  void dispose() {
    _poll?.cancel();
    FocusManager.instance.primaryFocus?.unfocus();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  String get _lang {
    final locale = ref.read(localeControllerProvider).value ?? AppLocale.en;
    return locale.code;
  }

  Future<void> _open() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final thread = await ref.read(supportRepositoryProvider).open(widget.idOrNumber, lang: _lang);
      if (!mounted) return;
      setState(() => _thread = thread);
      _jumpToEnd();
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error is AppFailure ? error.message : 'support.could_not_load');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    _input.clear();
    try {
      final thread = await ref.read(supportRepositoryProvider).send(
            widget.idOrNumber,
            body: text,
            lang: _lang,
          );
      if (!mounted) return;
      setState(() => _thread = thread);
      _jumpToEnd();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t(error is AppFailure ? error.message : 'support.send_failed'))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _refresh() async {
    if (_sending || _loading || _thread == null) return;
    try {
      final thread = await ref.read(supportRepositoryProvider).get(widget.idOrNumber);
      if (!mounted) return;
      final previous = _thread?.messages.isNotEmpty == true ? _thread!.messages.last.id : null;
      final next = thread.messages.isNotEmpty ? thread.messages.last.id : null;
      if (previous == next && _thread?.showItemPicker == thread.showItemPicker) return;
      setState(() => _thread = thread);
      if (previous != next) _jumpToEnd();
    } catch (_) {
      // Polling should not interrupt an open chat.
    }
  }

  Future<void> _addPhoto(ImageSource source) async {
    if (_photos.length >= 3 || _sending) return;
    final file = await ImagePicker().pickImage(
      source: source,
      imageQuality: 75,
      maxWidth: 1600,
    );
    if (file == null || !mounted) return;
    setState(() => _photos.add(file));
  }

  Future<void> _report() async {
    final thread = _thread;
    if (thread == null || _selected.isEmpty || _sending) return;
    if (_photos.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t('support.photo_required'))),
      );
      return;
    }
    setState(() => _sending = true);
    try {
      final repo = ref.read(supportRepositoryProvider);
      final photoUrls = <String>[];
      for (final photo in _photos) {
        photoUrls.add(await repo.uploadDamagePhoto(photo.path));
      }
      final updated = await repo.reportDamaged(
        widget.idOrNumber,
        customerNote: ref.t('support.damage_note'),
        items: _selected.entries
            .map((entry) => {'orderItemId': entry.key, 'quantity': entry.value})
            .toList(),
        photoUrls: photoUrls,
      );
      if (!mounted) return;
      setState(() {
        _thread = updated;
        _selected.clear();
        _photos.clear();
      });
      ref.invalidate(orderDetailViewModelProvider(widget.idOrNumber));
      ref.invalidate(ordersListViewModelProvider);
      final orderNumber = updated.orderNumber;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            orderNumber.isEmpty
                ? ref.t('support.request_sent_plain')
                : ref.t('support.request_sent', {'orderNumber': orderNumber}),
          ),
        ),
      );
      _jumpToEnd();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.t(error is AppFailure ? error.message : 'support.photo_failed'))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _jumpToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  @override
  Widget build(BuildContext context) {
    final thread = _thread;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(thread?.agentName ?? ref.t('support.agent_name')),
            Text(
              ref.t('support.team'),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(CustomerSpacing.lg),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(ref.t(_error!), textAlign: TextAlign.center),
                        const SizedBox(height: CustomerSpacing.md),
                        AppButton(label: ref.t('common.retry'), onPressed: _open),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    if (thread != null && thread.orderNumber.isNotEmpty)
                      _OrderBanner(thread: thread),
                    Expanded(
                      child: ListView(
                        controller: _scroll,
                        padding: const EdgeInsets.all(CustomerSpacing.marginMobile),
                        children: [
                          for (final message in thread?.messages ?? const <SupportMessage>[])
                            _Bubble(message: message),
                          if (_sending)
                            Padding(
                              padding: const EdgeInsets.only(top: CustomerSpacing.sm),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(ref.t('support.typing')),
                              ),
                            ),
                          if (thread?.orderItems.any((item) => item.isLocalShop) == true) ...[
                            const SizedBox(height: CustomerSpacing.md),
                            const LocalShopNote(),
                          ],
                          if (thread?.hasOpenReturn == true)
                            _RequestSentCard(orderNumber: thread!.orderNumber),
                          if (thread?.showDamageForm == true) _DamageForm(
                            orderNumber: thread!.orderNumber,
                            items: thread.orderItems.where((item) => !item.isLocalShop).toList(),
                            selected: _selected,
                            photos: _photos,
                            onChanged: (id, qty) {
                              setState(() {
                                if (qty == null) {
                                  _selected.remove(id);
                                } else {
                                  _selected[id] = qty;
                                }
                              });
                            },
                            onAddPhoto: _sending ? null : _addPhoto,
                            onRemovePhoto: (index) => setState(() => _photos.removeAt(index)),
                            onSubmit: _sending ? null : _report,
                          ),
                        ],
                      ),
                    ),
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          CustomerSpacing.marginMobile,
                          0,
                          CustomerSpacing.marginMobile,
                          CustomerSpacing.sm,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _input,
                                minLines: 1,
                                maxLines: 4,
                                textInputAction: TextInputAction.send,
                                decoration: InputDecoration(
                                  hintText: ref.t('support.message_hint'),
                                ),
                                onSubmitted: (_) => _send(),
                              ),
                            ),
                            const SizedBox(width: CustomerSpacing.sm),
                            IconButton.filled(
                              onPressed: _sending ? null : _send,
                              icon: const Icon(Icons.send),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final SupportMessage message;

  @override
  Widget build(BuildContext context) {
    final mine = !message.isAgent;
    final time = DateFormat('hh:mm a').format(message.at.toLocal());
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: CustomerSpacing.sm),
        padding: const EdgeInsets.symmetric(
          horizontal: CustomerSpacing.md,
          vertical: CustomerSpacing.sm,
        ),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
        decoration: BoxDecoration(
          color: mine ? CustomerColors.primary : CustomerColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(CustomerRadius.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.body,
              style: TextStyle(color: mine ? Colors.white : CustomerColors.onSurface),
            ),
            const SizedBox(height: 4),
            Text(
              time,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: mine ? Colors.white70 : CustomerColors.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderBanner extends StatelessWidget {
  const _OrderBanner({required this.thread});

  final SupportThread thread;

  @override
  Widget build(BuildContext context) {
    final date = thread.placedAt == null
        ? ''
        : DateFormat('dd MMM yyyy').format(thread.placedAt!.toLocal());
    final shop = thread.storeName.trim();
    final parts = <String>[
      if (shop.isNotEmpty) shop,
      if (date.isNotEmpty) date,
    ];
    return Material(
      color: CustomerColors.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          CustomerSpacing.marginMobile,
          CustomerSpacing.sm,
          CustomerSpacing.marginMobile,
          CustomerSpacing.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              context.t('support.order_banner', {'orderNumber': thread.orderNumber}),
              style: Theme.of(context).textTheme.titleSmall,
            ),
            if (parts.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                parts.join(' · '),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: CustomerColors.onSurfaceVariant,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RequestSentCard extends StatelessWidget {
  const _RequestSentCard({required this.orderNumber});

  final String orderNumber;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: CustomerSpacing.md),
      padding: const EdgeInsets.all(CustomerSpacing.md),
      decoration: BoxDecoration(
        color: CustomerColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(CustomerRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            orderNumber.isEmpty
                ? context.t('support.request_sent_plain')
                : context.t('support.request_sent', {'orderNumber': orderNumber}),
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: CustomerSpacing.xs),
          Text(context.t('support.request_next')),
        ],
      ),
    );
  }
}

class _DamageForm extends StatelessWidget {
  const _DamageForm({
    required this.orderNumber,
    required this.items,
    required this.selected,
    required this.photos,
    required this.onChanged,
    required this.onAddPhoto,
    required this.onRemovePhoto,
    required this.onSubmit,
  });

  final String orderNumber;
  final List<SupportOrderItem> items;
  final Map<String, int> selected;
  final List<XFile> photos;
  final void Function(String id, int? quantity) onChanged;
  final void Function(ImageSource source)? onAddPhoto;
  final void Function(int index) onRemovePhoto;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) {
    final canSend = selected.isNotEmpty && photos.isNotEmpty && onSubmit != null;
    return Container(
      margin: const EdgeInsets.only(top: CustomerSpacing.md),
      padding: const EdgeInsets.all(CustomerSpacing.md),
      decoration: BoxDecoration(
        border: Border.all(color: CustomerColors.outline),
        borderRadius: BorderRadius.circular(CustomerRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            orderNumber.isEmpty
                ? context.t('support.damage_title')
                : context.t('support.damage_title_for', {'orderNumber': orderNumber}),
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: CustomerSpacing.sm),
          if (items.isEmpty)
            Text(
              context.t('returns.local_shop_not_eligible'),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CustomerColors.onSurfaceVariant,
                  ),
            ),
          for (final item in items) ...[
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: selected.containsKey(item.id),
              title: Text(item.productName),
              subtitle: item.variantLabel == null || item.variantLabel!.trim().isEmpty
                  ? null
                  : Text(item.variantLabel!),
              onChanged: (checked) => onChanged(item.id, checked == true ? 1 : null),
            ),
            if (selected.containsKey(item.id) && item.quantity > 1)
              Row(
                children: [
                  Text(context.t('support.quantity')),
                  const Spacer(),
                  IconButton(
                    onPressed: (selected[item.id] ?? 1) <= 1
                        ? null
                        : () => onChanged(item.id, (selected[item.id] ?? 1) - 1),
                    icon: const Icon(Icons.remove),
                  ),
                  Text('${selected[item.id] ?? 1}'),
                  IconButton(
                    onPressed: (selected[item.id] ?? 1) >= item.quantity
                        ? null
                        : () => onChanged(item.id, (selected[item.id] ?? 1) + 1),
                    icon: const Icon(Icons.add),
                  ),
                ],
              ),
          ],
          const SizedBox(height: CustomerSpacing.sm),
          Text(context.t('support.photo_title'), style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: CustomerSpacing.sm),
          Wrap(
            spacing: CustomerSpacing.sm,
            runSpacing: CustomerSpacing.sm,
            children: [
              for (var i = 0; i < photos.length; i++)
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(CustomerRadius.sm),
                      child: Image.file(
                        File(photos[i].path),
                        width: 72,
                        height: 72,
                        fit: BoxFit.cover,
                      ),
                    ),
                    Positioned(
                      top: 0,
                      right: 0,
                      child: IconButton(
                        visualDensity: VisualDensity.compact,
                        onPressed: () => onRemovePhoto(i),
                        icon: const Icon(Icons.close, size: 16),
                      ),
                    ),
                  ],
                ),
              if (photos.length < 3)
                OutlinedButton.icon(
                  onPressed: onAddPhoto == null
                      ? null
                      : () => showModalBottomSheet<void>(
                            context: context,
                            builder: (sheetContext) => SafeArea(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  ListTile(
                                    leading: const Icon(Icons.photo_camera_outlined),
                                    title: Text(sheetContext.t('support.photo_camera')),
                                    onTap: () {
                                      Navigator.pop(sheetContext);
                                      onAddPhoto!(ImageSource.camera);
                                    },
                                  ),
                                  ListTile(
                                    leading: const Icon(Icons.photo_library_outlined),
                                    title: Text(sheetContext.t('support.photo_gallery')),
                                    onTap: () {
                                      Navigator.pop(sheetContext);
                                      onAddPhoto!(ImageSource.gallery);
                                    },
                                  ),
                                ],
                              ),
                            ),
                          ),
                  icon: const Icon(Icons.add_a_photo_outlined),
                  label: Text(context.t('support.add_photo')),
                ),
            ],
          ),
          if (items.isNotEmpty) ...[
            const SizedBox(height: CustomerSpacing.md),
            AppButton(
              label: context.t('support.send_request'),
              onPressed: canSend ? onSubmit : null,
            ),
          ],
        ],
      ),
    );
  }
}
