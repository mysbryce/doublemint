[[maybe_unused]] static void __doublemint_log_emit(const char* level, std::string_view message) {
  std::cout << '[' << level << "] " << message << std::endl;
}

[[maybe_unused]] static void __doublemint_log_info(std::string_view message) { __doublemint_log_emit("INFO", message); }
[[maybe_unused]] static void __doublemint_log_warn(std::string_view message) { __doublemint_log_emit("WARN", message); }
[[maybe_unused]] static void __doublemint_log_error(std::string_view message) { __doublemint_log_emit("ERROR", message); }
[[maybe_unused]] static void __doublemint_log_debug(std::string_view message) { __doublemint_log_emit("DEBUG", message); }
