import path from 'node:path';

export function resolveSafe(rootDir: string, relPath: string): string {
  const normalizedRoot = path.resolve(rootDir);
  const candidate = path.resolve(normalizedRoot, relPath);
  const rel = path.relative(normalizedRoot, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path traversal blocked: ${relPath}`);
  }
  return candidate;
}

export function toRelPath(rootDir: string, absPath: string): string {
  const rel = path.relative(path.resolve(rootDir), path.resolve(absPath));
  return rel.split(path.sep).join('/');
}
