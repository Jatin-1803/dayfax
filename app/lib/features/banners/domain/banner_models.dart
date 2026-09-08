import 'package:equatable/equatable.dart';

class HomeBanner extends Equatable {
  const HomeBanner({
    required this.id,
    required this.title,
    required this.imageUrl,
    required this.priority,
    this.linkPath,
  });

  final String id;
  final String title;
  final String imageUrl;
  final String? linkPath;
  final int priority;

  /// In-app path only. External URLs are ignored.
  String? get tapPath {
    final path = linkPath?.trim();
    if (path == null || path.isEmpty) return null;
    if (!path.startsWith('/') || path.startsWith('//') || path.contains('://')) {
      return null;
    }
    return path;
  }

  factory HomeBanner.fromJson(Map<String, dynamic> json) {
    final imageUrl = json['imageUrl'];
    return HomeBanner(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      imageUrl: imageUrl is String ? imageUrl : '',
      linkPath: json['linkPath'] as String?,
      priority: (json['priority'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, title, imageUrl, linkPath, priority];
}
