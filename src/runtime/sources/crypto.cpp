[[maybe_unused]] static int __doublemint_crypto_fnv1a(std::string_view value) {
  std::uint32_t hash = 2166136261u;
  for (unsigned char byte : value) {
    hash ^= byte;
    hash *= 16777619u;
  }
  return static_cast<int>(hash & 0x7fffffffu);
}

[[maybe_unused]] static std::string __doublemint_crypto_xor(std::string_view value, std::string_view key) {
  if (key.empty()) { return std::string(value); }
  std::string out(value.size(), '\0');
  for (std::size_t index = 0; index < value.size(); ++index) {
    out[index] = static_cast<char>(value[index] ^ key[index % key.size()]);
  }
  return out;
}

[[maybe_unused]] static std::string __doublemint_crypto_to_hex(int value) {
  std::ostringstream out;
  out << std::hex << std::nouppercase << static_cast<std::uint32_t>(value);
  return out.str();
}
