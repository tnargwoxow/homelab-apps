# dance_app

Cross-platform (iOS / Android / Web) Flutter app for practicing dance from
tutorial videos.

Status: **Phase 0 scaffold.** Interfaces and fakes are in place; no real
implementations yet. The plan lives at
`/root/.claude/plans/i-want-to-build-woolly-alpaca.md`.

## Layout

```
app/                                Flutter app shell, screens, composition root
packages/
  core_api/                         shared value types and errors
  ui_kit/                           widgets, theme, design tokens
  video_engine_api/                 VideoEngine interface
  camera_service_api/
  pose_detection_api/
  media_repo_api/
  metadata_store_api/
  alignment/                        pure-math affine fitting
  stats_engine/
  test_fixtures/                    fakes for every *_api
```

The strict rule is that `app/` and `*_impl` packages depend only on `*_api`
packages. The composition root in `app/lib/composition_root.dart` wires
implementations (or fakes) at startup.

## Working on this monorepo

First-time setup requires generating the Flutter platform folders for
`app/` (iOS, Android, web). They were not committed in Phase 0 because they're
generated artifacts:

```sh
cd dance_app/app
flutter create . --platforms=ios,android,web --org com.tnargwoxow.dance
cd ..
dart pub global activate melos
melos bootstrap        # runs `pub get` everywhere
melos run analyze
melos run test
melos run format-check
```

After bootstrap, run the app from `dance_app/app/`:

```sh
flutter run -d chrome    # or -d ios / -d android
```

## Phases

- **Phase 0** (this commit): contracts, fakes, app shell, CI.
- **Phase 1**: media_kit playback, A/B loop, speed slider, tutorial library.
- **Phase 2**: camera recording + live overlay practice.
- **Phase 3**: manual 5-point alignment + ghost playback.
- **Phase 4**: AI pose detection (ML Kit on mobile, MediaPipe JS on web).
- **Phase 5**: statistics + polish.
- **Phase 6**: PWA deployment via existing homelab GitOps + TestFlight / Play Internal.

Each phase past Phase 0 is decomposed into 2-3 disjoint packages so
independent agents can work in parallel without conflicts.
