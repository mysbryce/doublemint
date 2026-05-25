extern "cmath" {
  function sqrt(num: double): double;
}

export function calculateDistance(x1: float, y1: float, x2: float, y2: float): float {
  let dx: double = (x2 - x1);
  let dy: double = (y2 - y1);
  return sqrt((dx * dx) + (dy * dy)) as float;
}

