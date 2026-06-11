const test = require('node:test');
const assert = require('node:assert');
const { dominantAxis, swipeDirection, isTap, SWIPE_MIN, TAP_MAX } = require('../js/gestures.js');

test('dominantAxis identifica eixo predominante', () => {
  assert.strictEqual(dominantAxis(40, 10), 'x');
  assert.strictEqual(dominantAxis(10, 40), 'y');
  assert.strictEqual(dominantAxis(0, 0), 'none');
});

test('swipeDirection respeita o threshold horizontal', () => {
  assert.strictEqual(swipeDirection(SWIPE_MIN + 1, 5), 'right');
  assert.strictEqual(swipeDirection(-(SWIPE_MIN + 1), 5), 'left');
  assert.strictEqual(swipeDirection(SWIPE_MIN - 1, 5), null); // curto demais
  assert.strictEqual(swipeDirection(60, 60), null); // vertical domina
});

test('isTap: deslocamento pequeno conta como toque', () => {
  assert.strictEqual(isTap(TAP_MAX - 1, TAP_MAX - 1), true);
  assert.strictEqual(isTap(TAP_MAX + 5, 0), false);
});
