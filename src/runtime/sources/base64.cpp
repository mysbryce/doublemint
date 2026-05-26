namespace doublemint_base64_detail {

[[maybe_unused]] static const char kAlphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

[[maybe_unused]] static int decodeChar(char c) {
  if (c >= 'A' && c <= 'Z') { return c - 'A'; }
  if (c >= 'a' && c <= 'z') { return c - 'a' + 26; }
  if (c >= '0' && c <= '9') { return c - '0' + 52; }
  if (c == '+') { return 62; }
  if (c == '/') { return 63; }
  return -1;
}

}  // namespace doublemint_base64_detail

[[maybe_unused]] static std::string __doublemint_base64_encode(std::string_view value) {
  std::string out;
  out.reserve(((value.size() + 2) / 3) * 4);
  std::size_t index = 0;
  while (index + 3 <= value.size()) {
    auto a = static_cast<unsigned char>(value[index]);
    auto b = static_cast<unsigned char>(value[index + 1]);
    auto c = static_cast<unsigned char>(value[index + 2]);
    out.push_back(doublemint_base64_detail::kAlphabet[a >> 2]);
    out.push_back(doublemint_base64_detail::kAlphabet[((a & 0x03) << 4) | (b >> 4)]);
    out.push_back(doublemint_base64_detail::kAlphabet[((b & 0x0f) << 2) | (c >> 6)]);
    out.push_back(doublemint_base64_detail::kAlphabet[c & 0x3f]);
    index += 3;
  }
  if (index < value.size()) {
    auto a = static_cast<unsigned char>(value[index]);
    out.push_back(doublemint_base64_detail::kAlphabet[a >> 2]);
    if (index + 1 == value.size()) {
      out.push_back(doublemint_base64_detail::kAlphabet[(a & 0x03) << 4]);
      out.push_back('=');
      out.push_back('=');
    } else {
      auto b = static_cast<unsigned char>(value[index + 1]);
      out.push_back(doublemint_base64_detail::kAlphabet[((a & 0x03) << 4) | (b >> 4)]);
      out.push_back(doublemint_base64_detail::kAlphabet[(b & 0x0f) << 2]);
      out.push_back('=');
    }
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_base64_decode(std::string_view value) {
  std::string out;
  out.reserve((value.size() / 4) * 3);
  int buffer = 0;
  int bits = 0;
  for (char c : value) {
    if (c == '=' || c == '\n' || c == '\r' || c == ' ') { continue; }
    int decoded = doublemint_base64_detail::decodeChar(c);
    if (decoded < 0) { continue; }
    buffer = (buffer << 6) | decoded;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push_back(static_cast<char>((buffer >> bits) & 0xff));
    }
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_base64_encode_bytes(const std::vector<int>& bytes) {
  std::string buffer;
  buffer.reserve(bytes.size());
  for (int byte : bytes) { buffer.push_back(static_cast<char>(byte & 0xff)); }
  return __doublemint_base64_encode(buffer);
}

[[maybe_unused]] static std::vector<int> __doublemint_base64_decode_bytes(std::string_view value) {
  std::string decoded = __doublemint_base64_decode(value);
  std::vector<int> out;
  out.reserve(decoded.size());
  for (char c : decoded) { out.push_back(static_cast<unsigned char>(c)); }
  return out;
}
