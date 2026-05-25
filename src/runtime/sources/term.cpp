[[maybe_unused]] static void __doublemint_term_clear() {
  std::cout << "\x1b[2J\x1b[H";
}

[[maybe_unused]] static void __doublemint_term_move_cursor(int row, int column) {
  std::cout << "\x1b[" << row << ';' << column << 'H';
}

[[maybe_unused]] static void __doublemint_term_set_color(int code) {
  std::cout << "\x1b[" << code << 'm';
}

[[maybe_unused]] static void __doublemint_term_reset_color() {
  std::cout << "\x1b[0m";
}

[[maybe_unused]] static std::string __doublemint_term_bold(std::string_view value) {
  std::ostringstream out;
  out << "\x1b[1m" << value << "\x1b[0m";
  return out.str();
}

[[maybe_unused]] static std::string __doublemint_term_colorize(std::string_view value, int code) {
  std::ostringstream out;
  out << "\x1b[" << code << 'm' << value << "\x1b[0m";
  return out.str();
}
