/// Fakes for every *_api in dance_app. The composition root wires these
/// during Phase 0 so the shell compiles end-to-end with no real impls.
library test_fixtures;

export 'src/fake_camera_service.dart';
export 'src/fake_media_repository.dart';
export 'src/fake_metadata_store.dart';
export 'src/fake_pose_detector.dart';
export 'src/fake_video_engine.dart';
