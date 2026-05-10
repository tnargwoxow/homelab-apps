import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/alignment/alignment_screen.dart';
import 'features/library/library_screen.dart';
import 'features/player/player_screen.dart';
import 'features/practice/practice_screen.dart';
import 'features/stats/stats_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: <RouteBase>[
      ShellRoute(
        builder: (context, state, child) => _RootShell(child: child),
        routes: <RouteBase>[
          GoRoute(
            path: '/',
            name: 'library',
            builder: (_, __) => const LibraryScreen(),
          ),
          GoRoute(
            path: '/player',
            name: 'player',
            builder: (_, __) => const PlayerScreen(),
          ),
          GoRoute(
            path: '/practice',
            name: 'practice',
            builder: (_, __) => const PracticeScreen(),
          ),
          GoRoute(
            path: '/alignment',
            name: 'alignment',
            builder: (_, __) => const AlignmentScreen(),
          ),
          GoRoute(
            path: '/stats',
            name: 'stats',
            builder: (_, __) => const StatsScreen(),
          ),
        ],
      ),
    ],
  );
});

class _RootShell extends StatelessWidget {
  const _RootShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    final index = switch (location) {
      '/' => 0,
      '/player' => 1,
      '/practice' => 2,
      '/alignment' => 3,
      '/stats' => 4,
      _ => 0,
    };
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) {
          switch (i) {
            case 0:
              context.go('/');
            case 1:
              context.go('/player');
            case 2:
              context.go('/practice');
            case 3:
              context.go('/alignment');
            case 4:
              context.go('/stats');
          }
        },
        destinations: const <NavigationDestination>[
          NavigationDestination(
              icon: Icon(Icons.video_library_outlined), label: 'Library'),
          NavigationDestination(
              icon: Icon(Icons.play_circle_outline), label: 'Player'),
          NavigationDestination(
              icon: Icon(Icons.videocam_outlined), label: 'Practice'),
          NavigationDestination(
              icon: Icon(Icons.center_focus_strong_outlined),
              label: 'Align'),
          NavigationDestination(
              icon: Icon(Icons.bar_chart_outlined), label: 'Stats'),
        ],
      ),
    );
  }
}
