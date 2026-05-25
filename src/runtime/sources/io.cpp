[[maybe_unused]] static std::string __doublemint_read_line(std::string_view prompt) {
  std::cout << prompt;
  std::string line;
  std::getline(std::cin, line);
  return line;
}
