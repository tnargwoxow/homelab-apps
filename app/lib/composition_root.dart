/// Composition root: wires *_api interfaces to implementations.
///
/// `buildFakeOverrides()` keeps the in-memory fakes (used by widget tests).
/// `buildRealOverrides()` returns overrides backed by the real Phase 1
/// implementations: media_kit for video, Drift for metadata, the local FS
/// for media. Both signatures return a `List<Override>` so the call site
/// (main.dart vs widget tests) decides which to use.
library;

import 'package:camera_service_api/camera_service_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_repo_api/media_repo_api.dart';
import 'package:media_repo_local/media_repo_local.dart';
import 'package:metadata_store_api/metadata_store_api.dart';
import 'package:metadata_store_drift/metadata_store_drift.dart';
import 'package:pose_detection_api/pose_detection_api.dart';
import 'package:test_fixtures/test_fixtures.dart';
import 'package:video_engine_api/video_engine_api.dart';
import 'package:video_engine_media_kit/video_engine_media_kit.dart';

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
Future<List<Override>> buildRealOverrides() async {
  MediaKitVideoEngine.ensureInitialized();
  final mediaRepo = await LocalMediaRepository.openDefault();
  final metadataStore = await DriftMetadataStore.openDefault();
  return <Override>[
    videoEngineProvider.overrideWithValue(MediaKitVideoEngine()),
    cameraServiceProvider.overrideWithValue(FakeCameraService()),
    poseDetectorProvider.overrideWithValue(FakePoseDetector()),
    mediaRepositoryProvider.overrideWithValue(mediaRepo),
    metadataStoreProvider.overrideWithValue(metadataStore),
  ];
}
