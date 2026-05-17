import 'package:alignment/alignment.dart';
import 'package:core_api/core_api.dart';
import 'package:test/test.dart';

void main() {
  group('Aligner', () {
    const aligner = Aligner();

    test('identity for matching point sets', () {
      final pts = <Point2>[
        const Point2(0.0, 0.0),
        const Point2(1.0, 0.0),
        const Point2(0.0, 1.0),
      ];
      final t = aligner.compute(from: pts, to: pts);
      for (final p in pts) {
        final mapped = t.apply(p);
        expect((mapped.x - p.x).abs(), lessThan(1e-9));
        expect((mapped.y - p.y).abs(), lessThan(1e-9));
      }
    });

    test('uniform scale 2x', () {
      final from = <Point2>[
        const Point2(0.0, 0.0),
        const Point2(1.0, 0.0),
        const Point2(0.0, 1.0),
      ];
      final to = <Point2>[
        const Point2(0.0, 0.0),
        const Point2(2.0, 0.0),
        const Point2(0.0, 2.0),
      ];
      final t = aligner.compute(from: from, to: to);
      final mapped = t.apply(const Point2(0.5, 0.5));
      expect((mapped.x - 1.0).abs(), lessThan(1e-9));
      expect((mapped.y - 1.0).abs(), lessThan(1e-9));
    });

    test('non-uniform scale + translation (5 points, exact)', () {
      // x' = 2x + 0.1, y' = 0.5y + 0.2 — pure affine, fit must be exact.
      final from = <Point2>[
        const Point2(0.0, 0.0),
        const Point2(1.0, 0.0),
        const Point2(0.0, 1.0),
        const Point2(1.0, 1.0),
        const Point2(0.5, 0.5),
      ];
      final to = <Point2>[
        for (final p in from) Point2(2 * p.x + 0.1, 0.5 * p.y + 0.2),
      ];
      final t = aligner.compute(from: from, to: to);
      expect(
          aligner.rmsError(transform: t, from: from, to: to), lessThan(1e-9));
    });

    test('least-squares with noisy points returns bounded error', () {
      // Same affine as above, but with small jitter on each target.
      final base = <Point2>[
        const Point2(0.0, 0.0),
        const Point2(1.0, 0.0),
        const Point2(0.0, 1.0),
        const Point2(1.0, 1.0),
        const Point2(0.5, 0.5),
      ];
      final noisy = <Point2>[
        const Point2(0.10 + 0.001, 0.20 - 0.001),
        const Point2(2.10 - 0.002, 0.20 + 0.001),
        const Point2(0.10 + 0.001, 0.70 + 0.002),
        const Point2(2.10 - 0.001, 0.70 - 0.002),
        const Point2(1.10 + 0.001, 0.45 + 0.001),
      ];
      final t = aligner.compute(from: base, to: noisy);
      final rms = aligner.rmsError(transform: t, from: base, to: noisy);
      expect(rms, lessThan(0.01));
    });

    test('throws on too few points', () {
      expect(
        () => aligner.compute(
          from: <Point2>[const Point2(0, 0), const Point2(1, 0)],
          to: <Point2>[const Point2(0, 0), const Point2(1, 0)],
        ),
        throwsArgumentError,
      );
    });

    test('throws on collinear source points', () {
      final from = <Point2>[
        const Point2(0, 0),
        const Point2(1, 0),
        const Point2(2, 0),
      ];
      final to = <Point2>[
        const Point2(0, 0),
        const Point2(1, 1),
        const Point2(2, 2),
      ];
      expect(
        () => aligner.compute(from: from, to: to),
        throwsArgumentError,
      );
    });
  });
}
