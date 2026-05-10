import 'dart:math' as math;

import 'package:core_api/core_api.dart';

import 'affine_transform.dart';

/// Computes a 2D affine transform (6 degrees of freedom) that maps
/// `from` points onto `to` points by least-squares. The transform has the
/// form
///
///     [ x' ]   [ a  b  c ] [ x ]
///     [ y' ] = [ d  e  f ] [ y ]
///                          [ 1 ]
///
/// With N ≥ 3 non-degenerate point pairs, the system is solved via the
/// normal equations  AᵀA · p = Aᵀb  for the 6-vector p = [a b c d e f].
class Aligner {
  const Aligner();

  /// Minimum number of point pairs required for a 6-DoF affine fit.
  static const int minPoints = 3;

  /// Computes the affine transform that best maps `from` onto `to`.
  ///
  /// Throws [ArgumentError] if the lists are mismatched, too short, or the
  /// `from` points are degenerate (collinear / coincident → singular normal
  /// matrix).
  AffineTransform compute({
    required List<Point2> from,
    required List<Point2> to,
  }) {
    if (from.length != to.length) {
      throw ArgumentError('from and to must be the same length');
    }
    if (from.length < minPoints) {
      throw ArgumentError('need at least $minPoints point pairs');
    }

    // Build the symmetric 3x3 normal matrix N = Σ [x y 1]ᵀ [x y 1] and the
    // 3-vectors  rx = Σ [x y 1]ᵀ x'  and  ry = Σ [x y 1]ᵀ y'.
    // Solving N · [a b c]ᵀ = rx and N · [d e f]ᵀ = ry decouples the two rows.
    var n00 = 0.0, n01 = 0.0, n02 = 0.0;
    var n11 = 0.0, n12 = 0.0;
    var n22 = 0.0;
    var rx0 = 0.0, rx1 = 0.0, rx2 = 0.0;
    var ry0 = 0.0, ry1 = 0.0, ry2 = 0.0;

    for (var i = 0; i < from.length; i++) {
      final x = from[i].x, y = from[i].y;
      final xp = to[i].x, yp = to[i].y;
      n00 += x * x;
      n01 += x * y;
      n02 += x;
      n11 += y * y;
      n12 += y;
      n22 += 1.0;
      rx0 += x * xp;
      rx1 += y * xp;
      rx2 += xp;
      ry0 += x * yp;
      ry1 += y * yp;
      ry2 += yp;
    }

    final n = <List<double>>[
      <double>[n00, n01, n02],
      <double>[n01, n11, n12],
      <double>[n02, n12, n22],
    ];
    final inv = _invert3x3(n);
    if (inv == null) {
      throw ArgumentError(
          'source points are degenerate (collinear or coincident)');
    }

    double dot3(List<double> r, double a, double b, double c) =>
        r[0] * a + r[1] * b + r[2] * c;

    final a = dot3(inv[0], rx0, rx1, rx2);
    final b = dot3(inv[1], rx0, rx1, rx2);
    final c = dot3(inv[2], rx0, rx1, rx2);
    final d = dot3(inv[0], ry0, ry1, ry2);
    final e = dot3(inv[1], ry0, ry1, ry2);
    final f = dot3(inv[2], ry0, ry1, ry2);

    return AffineTransform(<double>[a, b, c, d, e, f, 0, 0, 1]);
  }

  /// Root-mean-square residual after applying `transform`. Useful as a UI
  /// quality indicator ("good fit" vs. "try again"). Result is in the same
  /// units as the input points (normalised image space).
  double rmsError({
    required AffineTransform transform,
    required List<Point2> from,
    required List<Point2> to,
  }) {
    if (from.length != to.length || from.isEmpty) {
      return double.infinity;
    }
    var sum = 0.0;
    for (var i = 0; i < from.length; i++) {
      final mapped = transform.apply(from[i]);
      final dx = mapped.x - to[i].x;
      final dy = mapped.y - to[i].y;
      sum += dx * dx + dy * dy;
    }
    return math.sqrt(sum / from.length);
  }

  static List<List<double>>? _invert3x3(List<List<double>> m) {
    final a = m[0][0], b = m[0][1], c = m[0][2];
    final d = m[1][0], e = m[1][1], f = m[1][2];
    final g = m[2][0], h = m[2][1], i = m[2][2];
    final det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (det.abs() < 1e-12) {
      return null;
    }
    final invDet = 1.0 / det;
    return <List<double>>[
      <double>[
        (e * i - f * h) * invDet,
        -(b * i - c * h) * invDet,
        (b * f - c * e) * invDet,
      ],
      <double>[
        -(d * i - f * g) * invDet,
        (a * i - c * g) * invDet,
        -(a * f - c * d) * invDet,
      ],
      <double>[
        (d * h - e * g) * invDet,
        -(a * h - b * g) * invDet,
        (a * e - b * d) * invDet,
      ],
    ];
  }
}
