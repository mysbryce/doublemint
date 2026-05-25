[[maybe_unused]] static std::string __doublemint_url_scheme(std::string_view url) {
  auto position = url.find("://");
  return position == std::string_view::npos ? std::string() : std::string(url.substr(0, position));
}

[[maybe_unused]] static std::string __doublemint_url_host(std::string_view url) {
  auto schemeEnd = url.find("://");
  std::size_t start = schemeEnd == std::string_view::npos ? 0 : schemeEnd + 3;
  auto pathStart = url.find('/', start);
  return std::string(url.substr(start, pathStart == std::string_view::npos ? std::string_view::npos : pathStart - start));
}

[[maybe_unused]] static std::string __doublemint_url_path(std::string_view url) {
  auto schemeEnd = url.find("://");
  std::size_t start = schemeEnd == std::string_view::npos ? 0 : schemeEnd + 3;
  auto pathStart = url.find('/', start);
  return pathStart == std::string_view::npos ? std::string("/") : std::string(url.substr(pathStart));
}

[[maybe_unused]] static std::string __doublemint_url_encode(std::string_view value) {
  std::ostringstream out;
  out << std::hex << std::uppercase;
  for (unsigned char ch : value) {
    bool safe = (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch == '-' || ch == '_' || ch == '.' || ch == '~';
    if (safe) {
      out << static_cast<char>(ch);
    } else {
      out << '%';
      if (ch < 16) { out << '0'; }
      out << static_cast<int>(ch);
    }
  }
  return out.str();
}

[[maybe_unused]] static std::string __doublemint_http_build_get(std::string_view path, std::string_view host) {
  std::ostringstream out;
  out << "GET " << (path.empty() ? std::string_view("/") : path) << " HTTP/1.1\r\n";
  out << "Host: " << host << "\r\n";
  out << "Connection: close\r\n\r\n";
  return out.str();
}
