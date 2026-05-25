[[maybe_unused]] static std::unordered_map<std::string, std::chrono::high_resolution_clock::time_point> __doublemint_profiler_marks;

[[maybe_unused]] static int __doublemint_now_ms() {
  auto now = std::chrono::time_point_cast<std::chrono::milliseconds>(std::chrono::system_clock::now());
  return static_cast<int>(now.time_since_epoch().count());
}

[[maybe_unused]] static void __doublemint_profiler_start(const std::string& name) {
  __doublemint_profiler_marks[name] = std::chrono::high_resolution_clock::now();
}

[[maybe_unused]] static int __doublemint_profiler_stop(const std::string& name) {
  auto end = std::chrono::high_resolution_clock::now();
  auto start = __doublemint_profiler_marks[name];
  return static_cast<int>(std::chrono::duration_cast<std::chrono::microseconds>(end - start).count());
}
