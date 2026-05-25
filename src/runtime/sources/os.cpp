[[maybe_unused]] static bool __doublemint_os_is_linux() {
#ifdef __linux__
  return true;
#else
  return false;
#endif
}

[[maybe_unused]] static bool __doublemint_os_is_windows() {
#ifdef _WIN32
  return true;
#else
  return false;
#endif
}

[[maybe_unused]] static std::string __doublemint_env_get(const std::string& key, const std::string& fallback) {
  const char* value = std::getenv(key.c_str());
  return value == nullptr ? fallback : std::string(value);
}

[[maybe_unused]] static std::string __doublemint_os_execute(const std::string& command) {
#ifdef _WIN32
  FILE* pipe = _popen(command.c_str(), "r");
#else
  FILE* pipe = popen(command.c_str(), "r");
#endif
  if (pipe == nullptr) { return ""; }
  std::array<char, 256> buffer{};
  std::string result;
  while (fgets(buffer.data(), static_cast<int>(buffer.size()), pipe) != nullptr) { result += buffer.data(); }
#ifdef _WIN32
  _pclose(pipe);
#else
  pclose(pipe);
#endif
  return result;
}
