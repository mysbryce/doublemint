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

[[maybe_unused]] static std::string __doublemint_os_run_capture(const std::string& command, int* exitCode, std::string* stderrOut) {
  std::string redirected = command + " 2>&1";
#ifdef _WIN32
  FILE* pipe = _popen(redirected.c_str(), "r");
#else
  FILE* pipe = popen(redirected.c_str(), "r");
#endif
  if (pipe == nullptr) {
    if (exitCode != nullptr) { *exitCode = -1; }
    if (stderrOut != nullptr) { *stderrOut = "popen failed"; }
    return std::string();
  }
  std::array<char, 4096> buffer{};
  std::string result;
  while (fgets(buffer.data(), static_cast<int>(buffer.size()), pipe) != nullptr) { result += buffer.data(); }
#ifdef _WIN32
  int rc = _pclose(pipe);
#else
  int rc = pclose(pipe);
#endif
  if (exitCode != nullptr) { *exitCode = rc; }
  if (stderrOut != nullptr) { stderrOut->clear(); }
  return result;
}

[[maybe_unused]] static int __doublemint_os_run_exit_code(const std::string& command) {
  int rc = 0;
  __doublemint_os_run_capture(command, &rc, nullptr);
  return rc;
}

[[maybe_unused]] static std::string __doublemint_os_run_output(const std::string& command) {
  return __doublemint_os_run_capture(command, nullptr, nullptr);
}

[[maybe_unused]] static std::string __doublemint_os_args_quote(std::string_view arg) {
  bool needsQuote = false;
  for (char c : arg) {
    if (c == ' ' || c == '\t' || c == '"' || c == '\'') { needsQuote = true; break; }
  }
  if (!needsQuote && !arg.empty()) { return std::string(arg); }
  std::string out;
  out.push_back('"');
  for (char c : arg) {
    if (c == '"' || c == '\\') { out.push_back('\\'); }
    out.push_back(c);
  }
  out.push_back('"');
  return out;
}

[[maybe_unused]] static std::string __doublemint_os_args_join(const std::vector<std::string_view>& parts) {
  std::string out;
  for (std::size_t index = 0; index < parts.size(); ++index) {
    if (index > 0) { out.push_back(' '); }
    out.append(__doublemint_os_args_quote(parts[index]));
  }
  return out;
}
