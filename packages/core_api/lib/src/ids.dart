import 'package:meta/meta.dart';

@immutable
class TutorialId {
  const TutorialId(this.value);
  final String value;

  @override
  bool operator ==(Object other) => other is TutorialId && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'TutorialId($value)';
}

@immutable
class RecordingId {
  const RecordingId(this.value);
  final String value;

  @override
  bool operator ==(Object other) =>
      other is RecordingId && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'RecordingId($value)';
}

@immutable
class SessionId {
  const SessionId(this.value);
  final String value;

  @override
  bool operator ==(Object other) => other is SessionId && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'SessionId($value)';
}
