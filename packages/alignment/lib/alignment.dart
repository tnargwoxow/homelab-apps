/// Computes a geometric transform that maps points on a user video onto the
/// matching points on a tutorial video. Phase 0 ships only a similarity
/// transform (uniform scale + rotation + translation); Phase 3 will replace
/// it with a least-squares affine fit. The interface is stable.
library alignment;

export 'src/affine_transform.dart';
export 'src/aligner.dart';
