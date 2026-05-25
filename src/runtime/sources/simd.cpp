[[maybe_unused]] static std::vector<int> __doublemint_simd_add(const std::vector<int>& left, const std::vector<int>& right) {
  std::size_t length = std::min(left.size(), right.size());
  std::vector<int> out(length, 0);
  for (std::size_t index = 0; index < length; ++index) {
    out[index] = left[index] + right[index];
  }
  return out;
}

[[maybe_unused]] static std::vector<int> __doublemint_simd_scale(const std::vector<int>& values, int factor) {
  std::vector<int> out(values.size(), 0);
  for (std::size_t index = 0; index < values.size(); ++index) {
    out[index] = values[index] * factor;
  }
  return out;
}

[[maybe_unused]] static int __doublemint_simd_dot(const std::vector<int>& left, const std::vector<int>& right) {
  std::size_t length = std::min(left.size(), right.size());
  int total = 0;
  for (std::size_t index = 0; index < length; ++index) {
    total += left[index] * right[index];
  }
  return total;
}

[[maybe_unused]] static int __doublemint_simd_sum(const std::vector<int>& values) {
  return std::accumulate(values.begin(), values.end(), 0);
}
