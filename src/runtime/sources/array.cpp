template <typename T, typename Fn>
[[maybe_unused]] static auto __doublemint_array_map(const std::vector<T>& values, const Fn& fn) {
  using U = std::invoke_result_t<Fn, T>;
  std::vector<U> out;
  out.reserve(values.size());
  for (const auto& value : values) { out.push_back(fn(value)); }
  return out;
}

template <typename T, typename Fn>
[[maybe_unused]] static std::vector<T> __doublemint_array_filter(const std::vector<T>& values, const Fn& fn) {
  std::vector<T> out;
  out.reserve(values.size());
  for (const auto& value : values) { if (fn(value)) { out.push_back(value); } }
  return out;
}

template <typename T, typename U, typename Fn>
[[maybe_unused]] static U __doublemint_array_reduce(const std::vector<T>& values, U seed, const Fn& fn) {
  U acc = seed;
  for (const auto& value : values) { acc = fn(acc, value); }
  return acc;
}

template <typename T, typename Fn>
[[maybe_unused]] static int __doublemint_array_find_index(const std::vector<T>& values, const Fn& fn) {
  for (std::size_t index = 0; index < values.size(); ++index) {
    if (fn(values[index])) { return static_cast<int>(index); }
  }
  return -1;
}

template <typename T, typename Fn>
[[maybe_unused]] static bool __doublemint_array_any(const std::vector<T>& values, const Fn& fn) {
  for (const auto& value : values) { if (fn(value)) { return true; } }
  return false;
}

template <typename T, typename Fn>
[[maybe_unused]] static bool __doublemint_array_all(const std::vector<T>& values, const Fn& fn) {
  for (const auto& value : values) { if (!fn(value)) { return false; } }
  return true;
}

template <typename T>
[[maybe_unused]] static std::vector<T> __doublemint_array_reverse(const std::vector<T>& values) {
  std::vector<T> out(values.rbegin(), values.rend());
  return out;
}

template <typename T>
[[maybe_unused]] static std::vector<T> __doublemint_array_sort(const std::vector<T>& values) {
  std::vector<T> out(values);
  std::sort(out.begin(), out.end());
  return out;
}

template <typename T, typename Fn>
[[maybe_unused]] static std::vector<T> __doublemint_array_sort_by(const std::vector<T>& values, const Fn& fn) {
  std::vector<T> out(values);
  std::sort(out.begin(), out.end(), [&fn](const T& a, const T& b) { return fn(a, b); });
  return out;
}

template <typename T>
[[maybe_unused]] static int __doublemint_array_length(const std::vector<T>& values) {
  return static_cast<int>(values.size());
}

template <typename T>
[[maybe_unused]] static std::vector<T> __doublemint_array_concat(const std::vector<T>& a, const std::vector<T>& b) {
  std::vector<T> out;
  out.reserve(a.size() + b.size());
  out.insert(out.end(), a.begin(), a.end());
  out.insert(out.end(), b.begin(), b.end());
  return out;
}

template <typename T>
[[maybe_unused]] static std::vector<T> __doublemint_array_slice(const std::vector<T>& values, int start, int end) {
  if (start < 0) { start = 0; }
  if (end < 0 || end > static_cast<int>(values.size())) { end = static_cast<int>(values.size()); }
  if (start >= end) { return std::vector<T>(); }
  return std::vector<T>(values.begin() + start, values.begin() + end);
}

template <typename T>
[[maybe_unused]] static bool __doublemint_array_contains(const std::vector<T>& values, const T& needle) {
  for (const auto& value : values) { if (value == needle) { return true; } }
  return false;
}

template <typename T>
[[maybe_unused]] static int __doublemint_array_index_of(const std::vector<T>& values, const T& needle) {
  for (std::size_t index = 0; index < values.size(); ++index) {
    if (values[index] == needle) { return static_cast<int>(index); }
  }
  return -1;
}
