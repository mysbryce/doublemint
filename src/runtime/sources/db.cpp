[[maybe_unused]] static std::unordered_map<std::string, std::string>& __doublemint_kv_store() {
  static std::unordered_map<std::string, std::string> store;
  return store;
}

[[maybe_unused]] static void __doublemint_kv_set(std::string_view key, std::string_view value) {
  __doublemint_kv_store()[std::string(key)] = std::string(value);
}

[[maybe_unused]] static std::string __doublemint_kv_get(std::string_view key, std::string_view fallback) {
  const auto& store = __doublemint_kv_store();
  auto entry = store.find(std::string(key));
  return entry == store.end() ? std::string(fallback) : entry->second;
}

[[maybe_unused]] static bool __doublemint_kv_has(std::string_view key) {
  const auto& store = __doublemint_kv_store();
  return store.find(std::string(key)) != store.end();
}

[[maybe_unused]] static void __doublemint_kv_remove(std::string_view key) {
  __doublemint_kv_store().erase(std::string(key));
}

[[maybe_unused]] static int __doublemint_kv_size() {
  return static_cast<int>(__doublemint_kv_store().size());
}

[[maybe_unused]] static void __doublemint_kv_clear() {
  __doublemint_kv_store().clear();
}
