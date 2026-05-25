[[maybe_unused]] static void __doublemint_async_sleep_ms(int milliseconds) {
  if (milliseconds <= 0) { return; }
  std::this_thread::sleep_for(std::chrono::milliseconds(milliseconds));
}

[[maybe_unused]] static int __doublemint_async_parallel_sum(const std::vector<int>& values) {
  if (values.empty()) { return 0; }
  unsigned int threads = std::thread::hardware_concurrency();
  if (threads < 2 || values.size() < threads * 4) {
    return std::accumulate(values.begin(), values.end(), 0);
  }
  std::vector<std::thread> workers;
  std::vector<int> partials(threads, 0);
  std::size_t chunk = values.size() / threads;
  for (unsigned int index = 0; index < threads; ++index) {
    std::size_t begin = index * chunk;
    std::size_t end = (index + 1 == threads) ? values.size() : begin + chunk;
    workers.emplace_back([&, begin, end, index]() {
      partials[index] = std::accumulate(values.begin() + static_cast<std::ptrdiff_t>(begin), values.begin() + static_cast<std::ptrdiff_t>(end), 0);
    });
  }
  for (auto& worker : workers) { worker.join(); }
  return std::accumulate(partials.begin(), partials.end(), 0);
}

[[maybe_unused]] static int __doublemint_async_hardware_threads() {
  unsigned int threads = std::thread::hardware_concurrency();
  return static_cast<int>(threads == 0 ? 1u : threads);
}
