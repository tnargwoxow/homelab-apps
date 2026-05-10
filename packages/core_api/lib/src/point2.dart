import 'dart:math' as math;

import 'package:meta/meta.dart';

/// A 2D point in normalised image coordinates ([0..1] on both axes).
@immutable
class Point2 {
  const Point2(this.x, this.y);
  final double x;
  final double y;

  Point2 operator +(Point2 other) => Point2(x + other.x, y + other.y);
  Point2 operator -(Point2 other) => Point2(x - other.x, y - other.y);
  Point2 operator *(double s) => Point2(x * s, y * s);

  double distanceTo(Point2 other) {
    final dx = x - other.x;
    final dy = y - other.y;
    return math.sqrt(dx * dx + dy * dy);
  }

  @override
  bool operator ==(Object other) =>
      other is Point2 && other.x == x && other.y == y;

  @override
  int get hashCode => Object.hash(x, y);

  @override
  String toString() =>
      'Point2(${x.toStringAsFixed(3)}, ${y.toStringAsFixed(3)})';
}
