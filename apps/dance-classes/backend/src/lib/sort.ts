// Numeric-aware filename comparator. Used wherever videos are returned in
// per-folder order (folder listing, sibling list on the watch page) so a
// folder of "Day 1, Day 2, …, Day 10" sorts the way a human reads it.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export function compareVideos<T extends { episode_num: number | null; filename: string }>(a: T, b: T): number {
  // Episode-numbered videos go first, sorted numerically by their N.
  if (a.episode_num !== null && b.episode_num !== null) return a.episode_num - b.episode_num;
  if (a.episode_num !== null) return -1;
  if (b.episode_num !== null) return 1;
  // Both have no episode prefix — natural-sort by filename.
  return collator.compare(a.filename, b.filename);
}
