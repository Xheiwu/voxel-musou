// Explicit intent wins over convenience repetition. No simulation state is read here.
export const ACTIONS = ['attack', 'charge', 'jump', 'dodge', 'musou', 'target'];
export const REPEAT_STEPS = 12;
// Covers combo.js WAIT (40) + BUF (14): a quick heavy tap must survive until its branch.
export const INTENT_STEPS = 54;
export function prioritizeActions(pressed) {
  if (pressed.charge || pressed.dodge || pressed.musou) pressed.attack = false;
  return pressed;
}
export function createAttackRepeater() {
  let repeat = REPEAT_STEPS, guard = 0;
  return {
    reset() { repeat = REPEAT_STEPS; guard = 0; },
    press(action) {
      if (action === 'attack') { guard = 0; repeat = REPEAT_STEPS; }
      else if (action === 'charge' || action === 'dodge' || action === 'musou') {
        guard = INTENT_STEPS; repeat = REPEAT_STEPS;
      }
    },
    // Called once per fixed simulation sample, never from requestAnimationFrame.
    sample(held, pressed) {
      if (guard > 0) { guard--; return false; }
      if (!held.attack) { repeat = REPEAT_STEPS; return false; }
      if (held.charge || pressed.charge || pressed.dodge || pressed.musou || pressed.attack) return false;
      if (--repeat <= 0) { repeat = REPEAT_STEPS; return true; }
      return false;
    },
  };
}
