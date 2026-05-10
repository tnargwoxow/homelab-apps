import 'package:meta/meta.dart';

enum MediaSourceType { localFile, network, asset }

/// An opaque, platform-agnostic reference to a media file. Implementations
/// translate this into a concrete location (file path, URL, OPFS handle).
@immutable
class MediaRef {
  const MediaRef({required this.uri, required this.sourceType});

  final String uri;
  final MediaSourceType sourceType;

  @override
  bool operator ==(Object other) =>
      other is MediaRef && other.uri == uri && other.sourceType == sourceType;

  @override
  int get hashCode => Object.hash(uri, sourceType);

  @override
  String toString() => 'MediaRef($sourceType:$uri)';
}
