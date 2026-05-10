/// Composition root: wires *_api interfaces to implementations.
///
/// Phase 0 wires every interface to its fake from test_fixtures so the app
/// shell builds end-to-end. Each later phase replaces one provider override
/// with a real impl (media_kit, ML Kit, Drift, etc.) without touching call
/// sites.
library;

import 'package:camera_service_api/camera_service_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_repo_api/media_repo_api.dart';
import 'package:metadata_store_api/metadata_store_api.dart';
import 'package:pose_detection_api/pose_detection_api.dart';
import 'package:test_fixtures/test_fixtures.dart';
import 'package:video_engine_api/video_engine_api.dart';

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

List<Override> buildFakeOverrides() => <Override>[
      videoEngineProvider.overrideWithValue(FakeVideoEngine()),
      cameraServiceProvider.overrideWithValue(FakeCameraService()),
      poseDetectorProvider.overrideWithValue(FakePoseDetector()),
      mediaRepositoryProvider.overrideWithValue(FakeMediaRepository()),
      metadataStoreProvider.overrideWithValue(FakeMetadataStore()),
    ];
