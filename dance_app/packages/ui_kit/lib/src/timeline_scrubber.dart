import 'package:flutter/material.dart';

/// A horizontal scrubber for video position with optional A/B loop markers.
class TimelineScrubber extends StatelessWidget {
  const TimelineScrubber({
    super.key,
    required this.position,
    required this.duration,
    required this.onSeek,
    this.loopStart,
    this.loopEnd,
    this.onSetLoopStart,
    this.onSetLoopEnd,
  });

  final Duration position;
  final Duration duration;
  final Duration? loopStart;
  final Duration? loopEnd;
  final void Function(Duration) onSeek;
  final void Function(Duration)? onSetLoopStart;
  final void Function(Duration)? onSetLoopEnd;

  static String _formatDuration(Duration d) {
    final clamped = d < Duration.zero ? Duration.zero : d;
    final totalMs = clamped.inMilliseconds;
    final minutes = totalMs ~/ 60000;
    final seconds = (totalMs ~/ 1000) % 60;
    final millis = totalMs % 1000;
    final secStr = seconds.toString().padLeft(2, '0');
    final msStr = millis.toString().padLeft(3, '0');
    return '$minutes:$secStr.$msStr';
  }

  Duration _clamp(Duration value) {
    if (value < Duration.zero) {
      return Duration.zero;
    }
    if (value > duration) {
      return duration;
    }
    return value;
  }

  void _seekFromLocalX(double localX, double width) {
    if (duration <= Duration.zero || width <= 0) {
      return;
    }
    final ratio = (localX / width).clamp(0.0, 1.0);
    final ms = (duration.inMilliseconds * ratio).round();
    onSeek(_clamp(Duration(milliseconds: ms)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final progress = duration.inMilliseconds == 0
        ? 0.0
        : (position.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0);
    final loopStartRatio = (loopStart != null && duration > Duration.zero)
        ? (loopStart!.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0)
        : null;
    final loopEndRatio = (loopEnd != null && duration > Duration.zero)
        ? (loopEnd!.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0)
        : null;
    final loopColor = colors.primary.withValues(alpha: 0.2);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Align(
            child: Text(
              '${_formatDuration(position)} / ${_formatDuration(duration)}',
              style: theme.textTheme.bodySmall?.copyWith(
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
                fontFamily: 'monospace',
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: <Widget>[
              if (onSetLoopStart != null)
                _LoopButton(
                  label: 'A',
                  onPressed: () => onSetLoopStart!(position),
                ),
              Expanded(
                child: LayoutBuilder(
                  builder: (BuildContext context, BoxConstraints constraints) {
                    final width = constraints.maxWidth;
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTapDown: (TapDownDetails details) {
                        _seekFromLocalX(details.localPosition.dx, width);
                      },
                      onHorizontalDragStart: (DragStartDetails details) {
                        _seekFromLocalX(details.localPosition.dx, width);
                      },
                      onHorizontalDragUpdate: (DragUpdateDetails details) {
                        _seekFromLocalX(details.localPosition.dx, width);
                      },
                      child: SizedBox(
                        height: 32,
                        child: CustomPaint(
                          painter: _ScrubberPainter(
                            progress: progress,
                            loopStartRatio: loopStartRatio,
                            loopEndRatio: loopEndRatio,
                            trackColor: colors.surfaceContainerHighest,
                            activeColor: colors.primary,
                            loopColor: loopColor,
                            thumbColor: colors.primary,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              if (onSetLoopEnd != null)
                _LoopButton(
                  label: 'B',
                  onPressed: () => onSetLoopEnd!(position),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LoopButton extends StatelessWidget {
  const _LoopButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: SizedBox(
        width: 32,
        height: 32,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: const Size(32, 32),
            shape: const CircleBorder(),
          ),
          child: Text(label),
        ),
      ),
    );
  }
}

class _ScrubberPainter extends CustomPainter {
  _ScrubberPainter({
    required this.progress,
    required this.loopStartRatio,
    required this.loopEndRatio,
    required this.trackColor,
    required this.activeColor,
    required this.loopColor,
    required this.thumbColor,
  });

  final double progress;
  final double? loopStartRatio;
  final double? loopEndRatio;
  final Color trackColor;
  final Color activeColor;
  final Color loopColor;
  final Color thumbColor;

  @override
  void paint(Canvas canvas, Size size) {
    final centerY = size.height / 2;
    const trackHeight = 4.0;
    final trackRect = Rect.fromLTWH(
      0,
      centerY - trackHeight / 2,
      size.width,
      trackHeight,
    );
    final trackRRect =
        RRect.fromRectAndRadius(trackRect, const Radius.circular(2));
    final trackPaint = Paint()..color = trackColor;
    canvas.drawRRect(trackRRect, trackPaint);

    if (loopStartRatio != null || loopEndRatio != null) {
      final a = loopStartRatio ?? 0.0;
      final b = loopEndRatio ?? 1.0;
      final start = a < b ? a : b;
      final end = a < b ? b : a;
      final loopRect = Rect.fromLTWH(
        size.width * start,
        centerY - trackHeight / 2,
        size.width * (end - start),
        trackHeight,
      );
      final loopPaint = Paint()..color = loopColor;
      canvas.drawRect(loopRect, loopPaint);
    }

    final activeRect = Rect.fromLTWH(
      0,
      centerY - trackHeight / 2,
      size.width * progress,
      trackHeight,
    );
    final activePaint = Paint()..color = activeColor;
    canvas.drawRRect(
      RRect.fromRectAndRadius(activeRect, const Radius.circular(2)),
      activePaint,
    );

    final thumbCenter = Offset(size.width * progress, centerY);
    final thumbPaint = Paint()..color = thumbColor;
    canvas.drawCircle(thumbCenter, 8, thumbPaint);
  }

  @override
  bool shouldRepaint(covariant _ScrubberPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.loopStartRatio != loopStartRatio ||
        oldDelegate.loopEndRatio != loopEndRatio ||
        oldDelegate.trackColor != trackColor ||
        oldDelegate.activeColor != activeColor ||
        oldDelegate.loopColor != loopColor ||
        oldDelegate.thumbColor != thumbColor;
  }
}
