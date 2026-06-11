(function (root) {
  var SWIPE_MIN = 50;   // px minimos para contar como swipe
  var TAP_MAX = 10;     // px maximos de deslocamento para contar como toque
  var AXIS_RATIO = 1.3; // quanto um eixo precisa dominar o outro

  function dominantAxis(dx, dy) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax === 0 && ay === 0) return 'none';
    return ax >= ay ? 'x' : 'y';
  }

  function swipeDirection(dx, dy) {
    if (Math.abs(dx) < SWIPE_MIN) return null;
    if (Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return null; // vertical domina
    return dx > 0 ? 'right' : 'left';
  }

  function isTap(dx, dy) {
    return Math.abs(dx) <= TAP_MAX && Math.abs(dy) <= TAP_MAX;
  }

  var api = {
    SWIPE_MIN: SWIPE_MIN, TAP_MAX: TAP_MAX, AXIS_RATIO: AXIS_RATIO,
    dominantAxis: dominantAxis, swipeDirection: swipeDirection, isTap: isTap,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BDMGestures = api;
})(typeof window !== 'undefined' ? window : globalThis);
