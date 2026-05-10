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

    test('throws on too few points', () {
      expect(
        () => aligner.compute(
          from: <Point2>[const Point2(0, 0)],
          to: <Point2>[const Point2(0, 0)],
        ),
        throwsArgumentError,
      );
    });
  });
}
