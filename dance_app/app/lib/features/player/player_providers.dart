import 'package:core_api/core_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The currently selected tutorial. Library taps will write this; the player
/// screen watches it. Phase 1 wiring keeps this null by default and the
/// player shows an empty state.
final selectedTutorialIdProvider = StateProvider<TutorialId?>((ref) => null);
