import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoFilename, parseFolderName, isVideoFile } from './titleParser.js';

test('parses trailer with -0- prefix', () => {
  assert.deepEqual(parseVideoFilename('-0- TRAILER.mp4'), { episodeNum: 0, displayTitle: 'Trailer' });
});

test('parses numbered lesson with redundant "N. " prefix', () => {
  assert.deepEqual(parseVideoFilename('-1- 1. Core Principles of Turns.mp4'), {
    episodeNum: 1,
    displayTitle: 'Core Principles of Turns'
  });
});

test('parses numbered lesson without redundant prefix', () => {
  assert.deepEqual(parseVideoFilename('-2- How to Do Multiple Pirouettes.mp4'), {
    episodeNum: 2,
    displayTitle: 'How to Do Multiple Pirouettes'
  });
});

test('handles ellipsis in title from screenshots', () => {
  assert.deepEqual(parseVideoFilename('-3- 3. Pro-Tips for Better Turns.mp4'), {
    episodeNum: 3,
    displayTitle: 'Pro-Tips for Better Turns'
  });
});

test('plain "1. Some Title" without dashes', () => {
  assert.deepEqual(parseVideoFilename('1. Warmup Routine.mp4'), {
    episodeNum: 1,
    displayTitle: 'Warmup Routine'
  });
});

test('falls back when no prefix matches', () => {
  assert.deepEqual(parseVideoFilename('mystery_class.mp4'), {
    episodeNum: null,
    displayTitle: 'mystery_class'
  });
});

test('handles empty rest after dashed prefix', () => {
  assert.deepEqual(parseVideoFilename('-5-.mp4'), { episodeNum: 5, displayTitle: 'Episode 5' });
});

test('parses folder name with leading dashed prefix', () => {
  assert.equal(parseFolderName('-1- Advanced Ballet Turns - Yolanda Correa'), 'Advanced Ballet Turns - Yolanda Correa');
});

test('title-cases lowercase folders', () => {
  assert.equal(parseFolderName('ballerina workout'), 'Ballerina Workout');
});

test('keeps mixed-case folders untouched', () => {
  assert.equal(parseFolderName('Ballet Classes'), 'Ballet Classes');
});

test('isVideoFile recognises common containers', () => {
  assert.equal(isVideoFile('foo.mp4'), true);
  assert.equal(isVideoFile('foo.MKV'), true);
  assert.equal(isVideoFile('foo.txt'), false);
  assert.equal(isVideoFile('Thumbs.db'), false);
});
