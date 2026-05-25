[[maybe_unused]] static std::string __doublemint_json_stringify(std::string_view value) {
  std::ostringstream out;
  out << '"';
  for (char ch : value) {
    switch (ch) {
      case '"': out << "\\\""; break;
      case '\\': out << "\\\\"; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default: out << ch; break;
    }
  }
  out << '"';
  return out.str();
}

[[maybe_unused]] static std::string __doublemint_json_stringify_int(int value) {
  return std::to_string(value);
}

[[maybe_unused]] static std::string __doublemint_json_stringify_bool(bool value) {
  return value ? std::string("true") : std::string("false");
}

[[maybe_unused]] static int __doublemint_json_parse_int(std::string_view value) {
  try { return std::stoi(std::string(value)); } catch (...) { return 0; }
}

[[maybe_unused]] static std::string __doublemint_json_parse_string(std::string_view value) {
  if (value.size() < 2 || value.front() != '"' || value.back() != '"') { return std::string(value); }
  std::string out;
  out.reserve(value.size());
  for (std::size_t index = 1; index + 1 < value.size(); ++index) {
    char ch = value[index];
    if (ch == '\\' && index + 2 < value.size()) {
      char next = value[index + 1];
      switch (next) {
        case 'n': out += '\n'; ++index; continue;
        case 'r': out += '\r'; ++index; continue;
        case 't': out += '\t'; ++index; continue;
        case '"': out += '"'; ++index; continue;
        case '\\': out += '\\'; ++index; continue;
        default: break;
      }
    }
    out += ch;
  }
  return out;
}
