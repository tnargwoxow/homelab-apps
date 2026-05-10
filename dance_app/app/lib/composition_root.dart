/// Composition root: wires *_api interfaces to implementations.
///
/// `buildFakeOverrides()` keeps the in-memory fakes (used by widget tests).
/// `buildRealOverrides()` returns overrides backed by the real Phase 1
/// implementations: media_kit for video, Drift for metadata, the local FS
/// for media. Both signatures return a `List<Override>` so the call site
/// (main.dart vs widget tests) decides which to use.
library;

import 'package:camera_service_api/camera_service_api.dart';
import 'package:camera_service_impl/camera_service_impl.dart';
import 'package:core_api/core_api.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_repo_api/media_repo_api.dart';
import 'package:media_repo_local/media_repo_local.dart';
import 'package:metadata_store_api/metadata_store_api.dart';
import 'package:metadata_store_drift/metadata_store_drift.dart';
import 'package:pose_detection_api/pose_detection_api.dart';
import 'package:test_fixtures/test_fixtures.dart';
import 'package:video_engine_api/video_engine_api.dart';
import 'package:video_engine_media_kit/video_engine_media_kit.dart';

import 'features/player/player_providers.dart';

final videoEngineProvider = Provider<VideoEngine>(
  (ref) => throw UnimplementedError('Override at app startup'),
);

final cameraServiceProvider = Provider<CameraService>(
  (ref) => throw UnimplementedError('Override at app startup'),
);

final poseDetectorProvider = Provider<PoseDetector>(
  (ref) => throw UnimplementedError('Override at app startup'),
);

final mediaRepositoryProvider = Provider<MediaRepository>(
  (ref) => throw UnimplementedError('Override at app startup'),
);

final metadataStoreProvider = Provider<MetadataStore>(
  (ref) => throw UnimplementedError('Override at app startup'),
);

/// In-memory fakes for widget tests and dev iteration without platform deps.
List<Override> buildFakeOverrides() => <Override>[
      videoEngineProvider.overrideWithValue(FakeVideoEngine()),
      cameraServiceProvider.overrideWithValue(FakeCameraService()),
      poseDetectorProvider.overrideWithValue(FakePoseDetector()),
      mediaRepositoryProvider.overrideWithValue(FakeMediaRepository()),
      metadataStoreProvider.overrideWithValue(FakeMetadataStore()),
    ];

/// Real Phase 1 wiring. Caller must `await` the future before passing it to
/// `ProviderScope.overrides` because Drift databases are async to open.
///
/// On web, drift_flutter requires sqlite3.wasm + a worker bundled in `web/`,
/// which Phase 1 has not shipped yet. We fall back to in-memory fakes for
/// storage there so the rest of the UI is exercisable in a browser; mobile
/// gets the full Drift-backed persistence.
Future<List<Override>> buildRealOverrides() async {
  MediaKitVideoEngine.ensureInitialized();
  final MediaRepository mediaRepo;
  final MetadataStore metadataStore;
  if (kIsWeb) {
    // Seed a public demo tutorial so the player is exercisable in a browser
    // without the full drift_flutter web setup.
    mediaRepo = FakeMediaRepository(
      seedTutorials: const <TutorialMedia>[
        TutorialMedia(
          id: TutorialId('demo-butterfly'),
          title: 'Butterfly (demo)',
          ref: MediaRef(
            uri:
                'https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4',
            sourceType: MediaSourceType.network,
          ),
          duration: Duration(seconds: 6),
        ),
      ],
    );
    metadataStore = FakeMetadataStore();
  } else {
    mediaRepo = await LocalMediaRepository.openDefault();
    metadataStore = await DriftMetadataStore.openDefault();
  }
  return <Override>[
    videoEngineProvider.overrideWithValue(MediaKitVideoEngine()),
    cameraServiceProvider.overrideWithValue(CameraServiceImpl()),
    poseDetectorProvider.overrideWithValue(FakePoseDetector()),
    mediaRepositoryProvider.overrideWithValue(mediaRepo),
    metadataStoreProvider.overrideWithValue(metadataStore),
    if (kIsWeb)
      // On web, jump straight into the demo tutorial so the player route
      // is reachable without manual tutorial selection.
      selectedTutorialIdProvider.overrideWith(
        (ref) => const TutorialId('demo-butterfly'),
      ),
  ];
}
