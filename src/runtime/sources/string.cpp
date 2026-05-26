[[maybe_unused]] static std::string __doublemint_string_upper(std::string_view value) {
  std::string out(value.size(), '\0');
  for (std::size_t index = 0; index < value.size(); ++index) {
    char ch = value[index];
    out[index] = (ch >= 'a' && ch <= 'z') ? static_cast<char>(ch - 32) : ch;
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_string_lower(std::string_view value) {
  std::string out(value.size(), '\0');
  for (std::size_t index = 0; index < value.size(); ++index) {
    char ch = value[index];
    out[index] = (ch >= 'A' && ch <= 'Z') ? static_cast<char>(ch + 32) : ch;
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_string_trim(std::string_view value) {
  std::size_t start = 0;
  while (start < value.size()) {
    char ch = value[start];
    if (ch != ' ' && ch != '\t' && ch != '\n' && ch != '\r') { break; }
    ++start;
  }
  std::size_t end = value.size();
  while (end > start) {
    char ch = value[end - 1];
    if (ch != ' ' && ch != '\t' && ch != '\n' && ch != '\r') { break; }
    --end;
  }
  return std::string(value.substr(start, end - start));
}

[[maybe_unused]] static std::vector<std::string> __doublemint_string_split(std::string_view value, std::string_view delimiter) {
  std::vector<std::string> result;
  if (delimiter.empty()) {
    result.emplace_back(value);
    return result;
  }
  std::size_t start = 0;
  while (start <= value.size()) {
    auto pos = value.find(delimiter, start);
    if (pos == std::string_view::npos) {
      result.emplace_back(value.substr(start));
      break;
    }
    result.emplace_back(value.substr(start, pos - start));
    start = pos + delimiter.size();
  }
  return result;
}

[[maybe_unused]] static std::string __doublemint_string_replace(std::string_view value, std::string_view find, std::string_view replacement) {
  if (find.empty()) { return std::string(value); }
  std::string out;
  out.reserve(value.size());
  std::size_t start = 0;
  while (start < value.size()) {
    auto pos = value.find(find, start);
    if (pos == std::string_view::npos) {
      out.append(value.substr(start));
      break;
    }
    out.append(value.substr(start, pos - start));
    out.append(replacement);
    start = pos + find.size();
  }
  return out;
}

[[maybe_unused]] static bool __doublemint_string_contains(std::string_view value, std::string_view needle) {
  return value.find(needle) != std::string_view::npos;
}

[[maybe_unused]] static bool __doublemint_string_starts_with(std::string_view value, std::string_view prefix) {
  return prefix.size() <= value.size() && value.compare(0, prefix.size(), prefix) == 0;
}

[[maybe_unused]] static bool __doublemint_string_ends_with(std::string_view value, std::string_view suffix) {
  return suffix.size() <= value.size() && value.compare(value.size() - suffix.size(), suffix.size(), suffix) == 0;
}

[[maybe_unused]] static int __doublemint_string_index_of(std::string_view value, std::string_view needle) {
  auto pos = value.find(needle);
  return pos == std::string_view::npos ? -1 : static_cast<int>(pos);
}

[[maybe_unused]] static int __doublemint_string_last_index_of(std::string_view value, std::string_view needle) {
  auto pos = value.rfind(needle);
  return pos == std::string_view::npos ? -1 : static_cast<int>(pos);
}

[[maybe_unused]] static std::string __doublemint_string_substring(std::string_view value, int start, int end) {
  if (start < 0) { start = 0; }
  if (end < 0 || end > static_cast<int>(value.size())) { end = static_cast<int>(value.size()); }
  if (start >= end) { return std::string(); }
  return std::string(value.substr(static_cast<std::size_t>(start), static_cast<std::size_t>(end - start)));
}

[[maybe_unused]] static int __doublemint_string_length(std::string_view value) {
  return static_cast<int>(value.size());
}

[[maybe_unused]] static std::string __doublemint_string_repeat(std::string_view value, int count) {
  if (count <= 0) { return std::string(); }
  std::string out;
  out.reserve(value.size() * static_cast<std::size_t>(count));
  for (int index = 0; index < count; ++index) { out.append(value); }
  return out;
}

[[maybe_unused]] static std::string __doublemint_string_pad_left(std::string_view value, int width, std::string_view filler) {
  if (filler.empty()) { return std::string(value); }
  if (static_cast<int>(value.size()) >= width) { return std::string(value); }
  std::string out;
  int padNeeded = width - static_cast<int>(value.size());
  while (static_cast<int>(out.size()) < padNeeded) {
    auto remaining = padNeeded - static_cast<int>(out.size());
    if (remaining >= static_cast<int>(filler.size())) {
      out.append(filler);
    } else {
      out.append(filler.substr(0, static_cast<std::size_t>(remaining)));
    }
  }
  out.append(value);
  return out;
}

[[maybe_unused]] static std::string __doublemint_string_pad_right(std::string_view value, int width, std::string_view filler) {
  if (filler.empty()) { return std::string(value); }
  if (static_cast<int>(value.size()) >= width) { return std::string(value); }
  std::string out;
  out.append(value);
  int padNeeded = width - static_cast<int>(value.size());
  while (static_cast<int>(out.size()) < width) {
    auto remaining = padNeeded - (static_cast<int>(out.size()) - static_cast<int>(value.size()));
    if (remaining >= static_cast<int>(filler.size())) {
      out.append(filler);
    } else {
      out.append(filler.substr(0, static_cast<std::size_t>(remaining)));
    }
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_string_join(const std::vector<std::string>& parts, std::string_view separator) {
  std::string out;
  for (std::size_t index = 0; index < parts.size(); ++index) {
    if (index > 0) { out.append(separator); }
    out.append(parts[index]);
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_string_reverse(std::string_view value) {
  std::string out(value.rbegin(), value.rend());
  return out;
}

[[maybe_unused]] static std::string __doublemint_string_from_int(int value) {
  return std::to_string(value);
}

[[maybe_unused]] static int __doublemint_string_to_int(std::string_view value) {
  try { return std::stoi(std::string(value)); } catch (...) { return 0; }
}
