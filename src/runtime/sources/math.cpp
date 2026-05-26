[[maybe_unused]] static int __doublemint_math_floor_to_int(double value) {
  return static_cast<int>(std::floor(value));
}

[[maybe_unused]] static int __doublemint_math_ceil_to_int(double value) {
  return static_cast<int>(std::ceil(value));
}

[[maybe_unused]] static int __doublemint_math_trunc_to_int(double value) {
  return static_cast<int>(std::trunc(value));
}

[[maybe_unused]] static double __doublemint_math_int_to_float(int value) {
  return static_cast<double>(value);
}

[[maybe_unused]] static int __doublemint_math_sign_int(int value) {
  return (value > 0) - (value < 0);
}

[[maybe_unused]] static int __doublemint_math_sign_float(double value) {
  if (value > 0.0) { return 1; }
  if (value < 0.0) { return -1; }
  return 0;
}
