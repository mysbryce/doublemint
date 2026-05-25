[[maybe_unused]] static std::string __doublemint_file_read_to_string(const std::string& path) {
  std::ifstream input(path, std::ios::binary);
  return std::string(std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>());
}

[[maybe_unused]] static std::vector<int> __doublemint_file_read_to_bytes(const std::string& path) {
  std::ifstream input(path, std::ios::binary);
  std::vector<int> bytes;
  char byte;
  while (input.get(byte)) { bytes.push_back(static_cast<unsigned char>(byte)); }
  return bytes;
}

[[maybe_unused]] static void __doublemint_file_write_string(const std::string& path, const std::string& content) {
  std::ofstream output(path, std::ios::binary | std::ios::trunc);
  output << content;
}

[[maybe_unused]] static void __doublemint_file_append_string(const std::string& path, const std::string& content) {
  std::ofstream output(path, std::ios::binary | std::ios::app);
  output << content;
}

[[maybe_unused]] static std::string __doublemint_path_join(const std::string& left, const std::string& right) {
  return (std::filesystem::path(left) / std::filesystem::path(right)).string();
}

[[maybe_unused]] static std::string __doublemint_path_basename(const std::string& path) {
  return std::filesystem::path(path).filename().string();
}
