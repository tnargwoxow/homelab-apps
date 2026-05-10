import 'package:core_api/core_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:media_repo_api/media_repo_api.dart';
import 'package:ui_kit/ui_kit.dart';

import '../../composition_root.dart';
import '../player/player_providers.dart';
import 'import_flow.dart';

/// Lists imported tutorials and offers an import button.
final tutorialsProvider = FutureProvider<List<TutorialMedia>>((ref) async {
  final repo = ref.watch(mediaRepositoryProvider);
  return repo.listTutorials();
});

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tutorialsAsync = ref.watch(tutorialsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Library'),
        actions: <Widget>[
          IconButton(
            tooltip: 'Import tutorial',
            icon: const Icon(Icons.add),
            onPressed: () async {
              await showImportSheet(context, ref);
              ref.invalidate(tutorialsProvider);
            },
          ),
        ],
      ),
      body: tutorialsAsync.when(
        data: (tutorials) {
          if (tutorials.isEmpty) {
            return const EmptyState(
              icon: Icons.video_library_outlined,
              title: 'No tutorials yet',
              message: 'Tap + to import a video from your device or a URL.',
            );
          }
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 220,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 16 / 12,
            ),
            itemCount: tutorials.length,
            itemBuilder: (context, i) => _TutorialCard(
              tutorial: tutorials[i],
              onTap: () {
                ref.read(selectedTutorialIdProvider.notifier).state =
                    tutorials[i].id;
                context.go('/player');
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EmptyState(
          icon: Icons.error_outline,
          title: 'Failed to load library',
          message: '$e',
        ),
      ),
    );
  }
}

class _TutorialCard extends StatelessWidget {
  const _TutorialCard({required this.tutorial, required this.onTap});

  final TutorialMedia tutorial;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Expanded(
              child: ColoredBox(
                color: theme.colorScheme.surfaceContainerHighest,
                child:
                    const Center(child: Icon(Icons.movie_outlined, size: 40)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(
                tutorial.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleSmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Used by other features (alignment, ghost) to look up a tutorial's media
/// repository entry by id.
final tutorialByIdProvider =
    FutureProvider.family<TutorialMedia?, TutorialId>((ref, id) async {
  final repo = ref.watch(mediaRepositoryProvider);
  return repo.getTutorial(id);
});
