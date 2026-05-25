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

[[maybe_unused]] static int __doublemint_async_parallel_max(const std::vector<int>& values) {
  if (values.empty()) { return 0; }
  return *std::max_element(values.begin(), values.end());
}

[[maybe_unused]] static int __doublemint_async_parallel_min(const std::vector<int>& values) {
  if (values.empty()) { return 0; }
  return *std::min_element(values.begin(), values.end());
}

namespace doublemint_async_detail {

struct ThreadRegistry {
  std::mutex mutex;
  std::unordered_map<int, std::thread> threads;
  int counter{0};
};

[[maybe_unused]] static ThreadRegistry& threadRegistry() {
  static ThreadRegistry instance;
  return instance;
}

struct MutexRegistry {
  std::mutex tableMutex;
  std::unordered_map<int, std::unique_ptr<std::mutex>> mutexes;
  int counter{0};
};

[[maybe_unused]] static MutexRegistry& mutexRegistry() {
  static MutexRegistry instance;
  return instance;
}

struct AtomicRegistry {
  std::mutex tableMutex;
  std::unordered_map<int, std::unique_ptr<std::atomic<std::int64_t>>> atomics;
  int counter{0};
};

[[maybe_unused]] static AtomicRegistry& atomicRegistry() {
  static AtomicRegistry instance;
  return instance;
}

struct Channel {
  std::mutex mutex;
  std::condition_variable cv;
  std::queue<std::string> messages;
  bool closed{false};
};

struct ChannelRegistry {
  std::mutex tableMutex;
  std::unordered_map<int, std::shared_ptr<Channel>> channels;
  int counter{0};
};

[[maybe_unused]] static ChannelRegistry& channelRegistry() {
  static ChannelRegistry instance;
  return instance;
}

}  // namespace doublemint_async_detail

[[maybe_unused]] static int __doublemint_async_spawn(const std::function<void()>& task) {
  auto& registry = doublemint_async_detail::threadRegistry();
  std::lock_guard<std::mutex> guard(registry.mutex);
  int id = ++registry.counter;
  registry.threads.emplace(id, std::thread([fn = task]() { fn(); }));
  return id;
}

[[maybe_unused]] static void __doublemint_async_join(int id) {
  auto& registry = doublemint_async_detail::threadRegistry();
  std::thread worker;
  {
    std::lock_guard<std::mutex> guard(registry.mutex);
    auto entry = registry.threads.find(id);
    if (entry == registry.threads.end()) { return; }
    worker = std::move(entry->second);
    registry.threads.erase(entry);
  }
  if (worker.joinable()) { worker.join(); }
}

[[maybe_unused]] static void __doublemint_async_detach(int id) {
  auto& registry = doublemint_async_detail::threadRegistry();
  std::lock_guard<std::mutex> guard(registry.mutex);
  auto entry = registry.threads.find(id);
  if (entry == registry.threads.end()) { return; }
  if (entry->second.joinable()) { entry->second.detach(); }
  registry.threads.erase(entry);
}

[[maybe_unused]] static void __doublemint_async_parallel_for(int count, const std::function<void(int)>& body) {
  if (count <= 0) { return; }
  unsigned int threads = std::thread::hardware_concurrency();
  if (threads < 2 || static_cast<unsigned int>(count) < threads * 2) {
    for (int index = 0; index < count; ++index) { body(index); }
    return;
  }
  std::vector<std::thread> workers;
  workers.reserve(threads);
  int chunk = count / static_cast<int>(threads);
  for (unsigned int t = 0; t < threads; ++t) {
    int begin = static_cast<int>(t) * chunk;
    int end = (t + 1 == threads) ? count : begin + chunk;
    workers.emplace_back([&, begin, end]() {
      for (int index = begin; index < end; ++index) { body(index); }
    });
  }
  for (auto& worker : workers) { worker.join(); }
}

[[maybe_unused]] static int __doublemint_async_mutex_create() {
  auto& registry = doublemint_async_detail::mutexRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  int id = ++registry.counter;
  registry.mutexes.emplace(id, std::make_unique<std::mutex>());
  return id;
}

[[maybe_unused]] static void __doublemint_async_mutex_lock(int id) {
  auto& registry = doublemint_async_detail::mutexRegistry();
  std::mutex* target = nullptr;
  {
    std::lock_guard<std::mutex> guard(registry.tableMutex);
    auto entry = registry.mutexes.find(id);
    if (entry == registry.mutexes.end()) { return; }
    target = entry->second.get();
  }
  if (target != nullptr) { target->lock(); }
}

[[maybe_unused]] static void __doublemint_async_mutex_unlock(int id) {
  auto& registry = doublemint_async_detail::mutexRegistry();
  std::mutex* target = nullptr;
  {
    std::lock_guard<std::mutex> guard(registry.tableMutex);
    auto entry = registry.mutexes.find(id);
    if (entry == registry.mutexes.end()) { return; }
    target = entry->second.get();
  }
  if (target != nullptr) { target->unlock(); }
}

[[maybe_unused]] static bool __doublemint_async_mutex_try_lock(int id) {
  auto& registry = doublemint_async_detail::mutexRegistry();
  std::mutex* target = nullptr;
  {
    std::lock_guard<std::mutex> guard(registry.tableMutex);
    auto entry = registry.mutexes.find(id);
    if (entry == registry.mutexes.end()) { return false; }
    target = entry->second.get();
  }
  return target != nullptr && target->try_lock();
}

[[maybe_unused]] static void __doublemint_async_mutex_destroy(int id) {
  auto& registry = doublemint_async_detail::mutexRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  registry.mutexes.erase(id);
}

[[maybe_unused]] static int __doublemint_async_atomic_create(std::int64_t initial) {
  auto& registry = doublemint_async_detail::atomicRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  int id = ++registry.counter;
  registry.atomics.emplace(id, std::make_unique<std::atomic<std::int64_t>>(initial));
  return id;
}

[[maybe_unused]] static std::int64_t __doublemint_async_atomic_load(int id) {
  auto& registry = doublemint_async_detail::atomicRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  auto entry = registry.atomics.find(id);
  return entry == registry.atomics.end() ? 0 : entry->second->load();
}

[[maybe_unused]] static void __doublemint_async_atomic_store(int id, std::int64_t value) {
  auto& registry = doublemint_async_detail::atomicRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  auto entry = registry.atomics.find(id);
  if (entry != registry.atomics.end()) { entry->second->store(value); }
}

[[maybe_unused]] static std::int64_t __doublemint_async_atomic_add(int id, std::int64_t delta) {
  auto& registry = doublemint_async_detail::atomicRegistry();
  std::atomic<std::int64_t>* target = nullptr;
  {
    std::lock_guard<std::mutex> guard(registry.tableMutex);
    auto entry = registry.atomics.find(id);
    if (entry == registry.atomics.end()) { return 0; }
    target = entry->second.get();
  }
  return target->fetch_add(delta) + delta;
}

[[maybe_unused]] static bool __doublemint_async_atomic_cas(int id, std::int64_t expected, std::int64_t desired) {
  auto& registry = doublemint_async_detail::atomicRegistry();
  std::atomic<std::int64_t>* target = nullptr;
  {
    std::lock_guard<std::mutex> guard(registry.tableMutex);
    auto entry = registry.atomics.find(id);
    if (entry == registry.atomics.end()) { return false; }
    target = entry->second.get();
  }
  std::int64_t local = expected;
  return target->compare_exchange_strong(local, desired);
}

[[maybe_unused]] static void __doublemint_async_atomic_destroy(int id) {
  auto& registry = doublemint_async_detail::atomicRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  registry.atomics.erase(id);
}

[[maybe_unused]] static int __doublemint_async_channel_create() {
  auto& registry = doublemint_async_detail::channelRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  int id = ++registry.counter;
  registry.channels.emplace(id, std::make_shared<doublemint_async_detail::Channel>());
  return id;
}

[[maybe_unused]] static void __doublemint_async_channel_send(int id, const std::string& value) {
  auto& registry = doublemint_async_detail::channelRegistry();
  std::shared_ptr<doublemint_async_detail::Channel> channel;
  {
    std::lock_guard<std::mutex> guard(registry.tableMutex);
    auto entry = registry.channels.find(id);
    if (entry == registry.channels.end()) { return; }
    channel = entry->second;
  }
  {
    std::lock_guard<std::mutex> guard(channel->mutex);
    if (channel->closed) { return; }
    channel->messages.push(value);
  }
  channel->cv.notify_one();
}

[[maybe_unused]] static std::string __doublemint_async_channel_receive(int id) {
  auto& registry = doublemint_async_detail::channelRegistry();
  std::shared_ptr<doublemint_async_detail::Channel> channel;
  {
    std::lock_guard<std::mutex> guard(registry.tableMutex);
    auto entry = registry.channels.find(id);
    if (entry == registry.channels.end()) { return std::string(); }
    channel = entry->second;
  }
  std::unique_lock<std::mutex> lock(channel->mutex);
  channel->cv.wait(lock, [&] { return !channel->messages.empty() || channel->closed; });
  if (channel->messages.empty()) { return std::string(); }
  std::string value = std::move(channel->messages.front());
  channel->messages.pop();
  return value;
}

[[maybe_unused]] static std::string __doublemint_async_channel_try_receive(int id) {
  auto& registry = doublemint_async_detail::channelRegistry();
  std::shared_ptr<doublemint_async_detail::Channel> channel;
  {
    std::lock_guard<std::mutex> guard(registry.tableMutex);
    auto entry = registry.channels.find(id);
    if (entry == registry.channels.end()) { return std::string(); }
    channel = entry->second;
  }
  std::lock_guard<std::mutex> guard(channel->mutex);
  if (channel->messages.empty()) { return std::string(); }
  std::string value = std::move(channel->messages.front());
  channel->messages.pop();
  return value;
}

[[maybe_unused]] static void __doublemint_async_channel_close(int id) {
  auto& registry = doublemint_async_detail::channelRegistry();
  std::shared_ptr<doublemint_async_detail::Channel> channel;
  {
    std::lock_guard<std::mutex> guard(registry.tableMutex);
    auto entry = registry.channels.find(id);
    if (entry == registry.channels.end()) { return; }
    channel = entry->second;
  }
  {
    std::lock_guard<std::mutex> guard(channel->mutex);
    channel->closed = true;
  }
  channel->cv.notify_all();
}

[[maybe_unused]] static void __doublemint_async_channel_destroy(int id) {
  auto& registry = doublemint_async_detail::channelRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  registry.channels.erase(id);
}
