[[maybe_unused]] static std::atomic<std::int64_t> __doublemint_memory_bytes{0};
[[maybe_unused]] static std::atomic<std::int64_t> __doublemint_memory_peak{0};

[[maybe_unused]] static void __doublemint_memory_record_alloc(int bytes) {
  if (bytes <= 0) { return; }
  std::int64_t current = __doublemint_memory_bytes.fetch_add(bytes) + bytes;
  std::int64_t peak = __doublemint_memory_peak.load();
  while (current > peak && !__doublemint_memory_peak.compare_exchange_weak(peak, current)) {}
}

[[maybe_unused]] static void __doublemint_memory_record_free(int bytes) {
  if (bytes <= 0) { return; }
  __doublemint_memory_bytes.fetch_sub(bytes);
}

[[maybe_unused]] static int __doublemint_memory_bytes_used() {
  return static_cast<int>(__doublemint_memory_bytes.load());
}

[[maybe_unused]] static int __doublemint_memory_peak_bytes() {
  return static_cast<int>(__doublemint_memory_peak.load());
}

[[maybe_unused]] static void __doublemint_memory_reset() {
  __doublemint_memory_bytes.store(0);
  __doublemint_memory_peak.store(0);
}
