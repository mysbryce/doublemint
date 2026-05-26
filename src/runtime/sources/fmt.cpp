[[maybe_unused]] static std::string __doublemint_fmt_pad_left(const std::string& text, int width, const std::string& pad) {
  if (pad.empty() || static_cast<int>(text.size()) >= width) { return text; }
  std::string out = text;
  while (static_cast<int>(out.size()) < width) {
    out = pad + out;
  }
  if (static_cast<int>(out.size()) > width) {
    out = out.substr(out.size() - static_cast<std::size_t>(width));
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_fmt_pad_right(const std::string& text, int width, const std::string& pad) {
  if (pad.empty() || static_cast<int>(text.size()) >= width) { return text; }
  std::string out = text;
  while (static_cast<int>(out.size()) < width) {
    out += pad;
  }
  if (static_cast<int>(out.size()) > width) {
    out = out.substr(0, static_cast<std::size_t>(width));
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_fmt_repeat(const std::string& text, int count) {
  if (count <= 0) { return std::string{}; }
  std::string out;
  out.reserve(text.size() * static_cast<std::size_t>(count));
  for (int i = 0; i < count; ++i) {
    out += text;
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_fmt_hex(std::int64_t value) {
  std::ostringstream s;
  s << std::hex << value;
  return s.str();
}

[[maybe_unused]] static std::string __doublemint_fmt_hex_upper(std::int64_t value) {
  std::ostringstream s;
  s << std::hex << std::uppercase << value;
  return s.str();
}

[[maybe_unused]] static std::string __doublemint_fmt_octal(std::int64_t value) {
  std::ostringstream s;
  s << std::oct << value;
  return s.str();
}

[[maybe_unused]] static std::string __doublemint_fmt_binary(std::int64_t value) {
  if (value == 0) { return std::string{"0"}; }
  std::string out;
  std::uint64_t bits = static_cast<std::uint64_t>(value < 0 ? -value : value);
  while (bits > 0) {
    out.insert(out.begin(), (bits & 1ULL) ? '1' : '0');
    bits >>= 1;
  }
  if (value < 0) { out.insert(out.begin(), '-'); }
  return out;
}

[[maybe_unused]] static std::string __doublemint_fmt_precision(double value, int places) {
  if (places < 0) { places = 0; }
  std::ostringstream s;
  s << std::fixed << std::setprecision(places) << value;
  return s.str();
}

[[maybe_unused]] static std::string __doublemint_fmt_with_thousands(std::int64_t value, const std::string& sep) {
  std::string digits = std::to_string(value < 0 ? -value : value);
  std::string out;
  int count = 0;
  for (auto it = digits.rbegin(); it != digits.rend(); ++it) {
    if (count > 0 && count % 3 == 0) {
      for (auto sIt = sep.rbegin(); sIt != sep.rend(); ++sIt) {
        out.insert(out.begin(), *sIt);
      }
    }
    out.insert(out.begin(), *it);
    count += 1;
  }
  if (value < 0) { out.insert(out.begin(), '-'); }
  return out;
}
