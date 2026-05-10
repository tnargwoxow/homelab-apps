import 'dart:math' as math;

import 'package:core_api/core_api.dart';

import 'affine_transform.dart';

/// Phase 0 stub: similarity transform (uniform scale + rotation + translation)
/// from at least two point pairs. Phase 3 will swap this for a least-squares
/// affine that uses all five keypoints.
class Aligner {
  const Aligner();

  AffineTransform compute({
    required List<Point2> from,
    required List<Point2> to,
  }) {
    if (from.length != to.length) {
      throw ArgumentError('from and to must be the same length');
    }
    if (from.length < 2) {
      throw ArgumentError('need at least 2 point pairs');
    }

    final fromCentroid = _centroid(from);
    final toCentroid = _centroid(to);

    final fromDist = _avgDistance(from, fromCentroid);
    final toDist = _avgDistance(to, toCentroid);
    if (fromDist == 0) {
      throw ArgumentError('source points are coincident');
    }
    final scale = toDist / fromDist;

    var sumSin = 0.0;
    var sumCos = 0.0;
    for (var i = 0; i < from.length; i++) {
      final f = from[i] - fromCentroid;
      final t = to[i] - toCentroid;
      sumCos += f.x * t.x + f.y * t.y;
      sumSin += f.x * t.y - f.y * t.x;
    }
    final theta = math.atan2(sumSin, sumCos);
    final c = math.cos(theta) * scale;
    final s = math.sin(theta) * scale;

    final tx = toCentroid.x - (c * fromCentroid.x - s * fromCentroid.y);
    final ty = toCentroid.y - (s * fromCentroid.x + c * fromCentroid.y);

    return AffineTransform(<double>[
      c,
      -s,
      tx,
      s,
      c,
      ty,
      0,
      0,
      1,
    ]);
  }

  Point2 _centroid(List<Point2> points) {
    var sx = 0.0;
    var sy = 0.0;
    for (final p in points) {
      sx += p.x;
      sy += p.y;
    }
    return Point2(sx / points.length, sy / points.length);
  }

  double _avgDistance(List<Point2> points, Point2 center) {
    var sum = 0.0;
    for (final p in points) {
      sum += p.distanceTo(center);
    }
    return sum / points.length;
  }
}
