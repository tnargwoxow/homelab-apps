import 'package:core_api/core_api.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;

import '../../composition_root.dart';

/// Shows a bottom sheet with two import options: device file, or URL.
Future<void> showImportSheet(BuildContext context, WidgetRef ref) async {
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          ListTile(
            leading: const Icon(Icons.folder_open_outlined),
            title: const Text('From device'),
            subtitle: kIsWeb
                ? const Text('Not yet supported on web')
                : const Text('Pick a video file'),
            enabled: !kIsWeb,
            onTap: () async {
              Navigator.of(sheetContext).pop();
              await _importFromDevice(context, ref);
            },
          ),
          ListTile(
            leading: const Icon(Icons.link_outlined),
            title: const Text('From URL'),
            subtitle: const Text('Paste a video URL'),
            onTap: () async {
              Navigator.of(sheetContext).pop();
              await _importFromUrl(context, ref);
            },
          ),
        ],
      ),
    ),
  );
}

Future<void> _importFromDevice(BuildContext context, WidgetRef ref) async {
  final result = await FilePicker.platform.pickFiles(
    type: FileType.video,
    allowMultiple: false,
    withData: false,
  );
  if (result == null || result.files.isEmpty) {
    return;
  }
  final picked = result.files.first;
  final path = picked.path;
  if (path == null) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('No file path available for this picker.')),
      );
    }
    return;
  }
  final repo = ref.read(mediaRepositoryProvider);
  final title = p.basenameWithoutExtension(path);
  await repo.saveTutorial(
    title: title.isEmpty ? 'Untitled' : title,
    sourceRef: MediaRef(uri: path, sourceType: MediaSourceType.localFile),
  );
}

Future<void> _importFromUrl(BuildContext context, WidgetRef ref) async {
  final controller = TextEditingController();
  final form = await showDialog<_UrlImport>(
    context: context,
    builder: (dialogContext) {
      final titleController = TextEditingController();
      return AlertDialog(
        title: const Text('Import from URL'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            TextField(
              controller: titleController,
              decoration: const InputDecoration(labelText: 'Title'),
              autofocus: true,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'URL'),
              keyboardType: TextInputType.url,
            ),
          ],
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(dialogContext).pop(
                _UrlImport(
                  title: titleController.text.trim(),
                  url: controller.text.trim(),
                ),
              );
            },
            child: const Text('Import'),
          ),
        ],
      );
    },
  );
  if (form == null || form.url.isEmpty) {
    return;
  }
  final repo = ref.read(mediaRepositoryProvider);
  await repo.saveTutorial(
    title: form.title.isEmpty ? form.url : form.title,
    sourceRef: MediaRef(uri: form.url, sourceType: MediaSourceType.network),
  );
}

class _UrlImport {
  _UrlImport({required this.title, required this.url});
  final String title;
  final String url;
}
