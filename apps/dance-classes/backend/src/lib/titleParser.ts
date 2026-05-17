export interface ParsedTitle {
  episodeNum: number | null;
  displayTitle: string;
}

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

export function stripExt(filename: string): string {
  return filename.replace(VIDEO_EXT, '');
}

export function parseVideoFilename(filename: string): ParsedTitle {
  const base = stripExt(filename).trim();

  // Pattern: "-N- rest" or "-N-rest"
  const dashed = /^-(\d+)-\s*(.*)$/.exec(base);
  if (dashed) {
    const episodeNum = Number.parseInt(dashed[1], 10);
    let rest = dashed[2].trim();
    if (rest === '') {
      return { episodeNum, displayTitle: episodeNum === 0 ? 'Trailer' : `Episode ${episodeNum}` };
    }
    if (/^trailer$/i.test(rest)) {
      return { episodeNum, displayTitle: 'Trailer' };
    }
    // Strip a redundant "N. " prefix that often duplicates the -N- index
    const numbered = /^(\d+)\.\s+(.+)$/.exec(rest);
    if (numbered) rest = numbered[2].trim();
    return { episodeNum, displayTitle: rest };
  }

  // Pattern: "1. Some Title" without leading dashes
  const numbered = /^(\d+)\.\s+(.+)$/.exec(base);
  if (numbered) {
    return { episodeNum: Number.parseInt(numbered[1], 10), displayTitle: numbered[2].trim() };
  }

  return { episodeNum: null, displayTitle: base };
}

export function parseFolderName(name: string): string {
  let s = name.trim();
  // Strip a leading episode-style prefix if present
  const dashed = /^-(\d+)-\s*(.+)$/.exec(s);
  if (dashed) s = dashed[2];
  s = s.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s === s.toLowerCase()) {
    s = s.replace(/\b\w/g, c => c.toUpperCase());
  }
  return s;
}

export function isVideoFile(filename: string): boolean {
  return VIDEO_EXT.test(filename);
}
