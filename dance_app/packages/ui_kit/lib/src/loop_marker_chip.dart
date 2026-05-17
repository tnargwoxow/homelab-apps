import 'package:flutter/material.dart';

/// A chip representing a saved loop marker with label and time range.
class LoopMarkerChip extends StatelessWidget {
  const LoopMarkerChip({
    super.key,
    required this.label,
    required this.start,
    required this.end,
    required this.onTap,
    this.selected = false,
    this.onDelete,
  });

  final String label;
  final Duration start;
  final Duration end;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  static String _formatRange(Duration start, Duration end) {
    return '${start.inMilliseconds} - ${end.inMilliseconds}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InputChip(
      label: Text('$label  ${_formatRange(start, end)}'),
      selected: selected,
      onPressed: onTap,
      onDeleted: onDelete,
      labelStyle: theme.textTheme.bodySmall?.copyWith(
        fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
      ),
    );
  }
}
