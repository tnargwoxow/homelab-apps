import 'package:meta/meta.dart';

/// Sum type for fallible operations. Avoids throwing across package boundaries.
@immutable
sealed class Result<T> {
  const Result();
}

@immutable
class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;
}

@immutable
class Err<T> extends Result<T> {
  const Err(this.message, {this.cause});
  final String message;
  final Object? cause;
}
