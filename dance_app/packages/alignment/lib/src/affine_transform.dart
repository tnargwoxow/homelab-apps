import 'package:core_api/core_api.dart';
import 'package:meta/meta.dart';

/// A 2D affine transform represented as a row-major 3x3 matrix where the
/// last row is fixed at [0, 0, 1].
@immutable
class AffineTransform {
  const AffineTransform(this.matrix);

  /// Row-major 3x3.
  final List<double> matrix;

  static const AffineTransform identity = AffineTransform(<double>[
    1,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    1,
  ]);

  Point2 apply(Point2 p) {
    final m = matrix;
    final x = m[0] * p.x + m[1] * p.y + m[2];
    final y = m[3] * p.x + m[4] * p.y + m[5];
    return Point2(x, y);
  }
}
