// Opt-in until full-scene / real-phone rendering has been validated.
// Keep the upstream renderer intact for comparison and rollback.
import { createPost as createCinematicPost } from './cinematic.js';
import { createInkPost } from './ink.js';

export function createPost(options) {
  const original = new URLSearchParams(location.search).get('style') !== 'ink';
  document.documentElement.dataset.visualStyle = original ? 'original' : 'ink';
  return original ? createCinematicPost(options) : createInkPost(options);
}
