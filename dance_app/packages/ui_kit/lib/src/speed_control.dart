import 'package:flutter/material.dart';

/// A snapping playback-speed slider in [0.25, 2.0].
class SpeedControl extends StatelessWidget {
  const SpeedControl({
    super.key,
    required this.value,
    required this.onChanged,
  });

  static const List<double> steps = <double>[
    0.25,
    0.5,
    0.75,
    1.0,
    1.25,
    1.5,
    1.75,
    2.0,
  ];

  final double value;
  final void Function(double) onChanged;

  static double _snap(double raw) {
    var best = steps.first;
    var bestDiff = (raw - best).abs();
    for (final step in steps) {
      final diff = (raw - step).abs();
      if (diff < bestDiff) {
        bestDiff = diff;
        best = step;
      }
    }
    return best;
  }

  static String _formatValue(double v) {
    final s = v.toStringAsFixed(2);
    return '$s×';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final clamped = value.clamp(0.25, 2.0);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 56,
            child: Text(
              _formatValue(clamped),
              style: theme.textTheme.bodyMedium?.copyWith(
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              ),
            ),
          ),
          Expanded(
            child: Slider(
              value: clamped,
              min: 0.25,
              max: 2.0,
              divisions: steps.length - 1,
              label: _formatValue(clamped),
              onChanged: (double raw) => onChanged(_snap(raw)),
            ),
          ),
        ],
      ),
    );
  }
}
