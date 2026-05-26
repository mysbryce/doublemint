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

namespace doublemint_crypto_detail {

[[maybe_unused]] static std::string bytesToHex(const std::uint8_t* bytes, std::size_t size) {
  static const char kHex[] = "0123456789abcdef";
  std::string out;
  out.resize(size * 2);
  for (std::size_t index = 0; index < size; ++index) {
    out[index * 2] = kHex[(bytes[index] >> 4) & 0x0f];
    out[index * 2 + 1] = kHex[bytes[index] & 0x0f];
  }
  return out;
}

// ===== SHA-256 =====

[[maybe_unused]] static const std::uint32_t kSha256K[64] = {
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

[[maybe_unused]] static inline std::uint32_t rotr32(std::uint32_t x, int n) {
  return (x >> n) | (x << (32 - n));
}

[[maybe_unused]] static void sha256Process(std::uint32_t state[8], const std::uint8_t block[64]) {
  std::uint32_t w[64];
  for (int i = 0; i < 16; ++i) {
    w[i] = (static_cast<std::uint32_t>(block[i * 4]) << 24)
         | (static_cast<std::uint32_t>(block[i * 4 + 1]) << 16)
         | (static_cast<std::uint32_t>(block[i * 4 + 2]) << 8)
         | static_cast<std::uint32_t>(block[i * 4 + 3]);
  }
  for (int i = 16; i < 64; ++i) {
    std::uint32_t s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >> 3);
    std::uint32_t s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >> 10);
    w[i] = w[i - 16] + s0 + w[i - 7] + s1;
  }
  std::uint32_t a = state[0], b = state[1], c = state[2], d = state[3];
  std::uint32_t e = state[4], f = state[5], g = state[6], h = state[7];
  for (int i = 0; i < 64; ++i) {
    std::uint32_t S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
    std::uint32_t ch = (e & f) ^ (~e & g);
    std::uint32_t temp1 = h + S1 + ch + kSha256K[i] + w[i];
    std::uint32_t S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
    std::uint32_t mj = (a & b) ^ (a & c) ^ (b & c);
    std::uint32_t temp2 = S0 + mj;
    h = g; g = f; f = e; e = d + temp1;
    d = c; c = b; b = a; a = temp1 + temp2;
  }
  state[0] += a; state[1] += b; state[2] += c; state[3] += d;
  state[4] += e; state[5] += f; state[6] += g; state[7] += h;
}

[[maybe_unused]] static void sha256Bytes(const std::uint8_t* data, std::size_t size, std::uint8_t out[32]) {
  std::uint32_t state[8] = {
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  };
  std::uint64_t bitLength = static_cast<std::uint64_t>(size) * 8;
  std::vector<std::uint8_t> padded(data, data + size);
  padded.push_back(0x80);
  while (padded.size() % 64 != 56) { padded.push_back(0); }
  for (int i = 7; i >= 0; --i) { padded.push_back(static_cast<std::uint8_t>((bitLength >> (i * 8)) & 0xff)); }
  for (std::size_t offset = 0; offset < padded.size(); offset += 64) {
    sha256Process(state, padded.data() + offset);
  }
  for (int i = 0; i < 8; ++i) {
    out[i * 4] = static_cast<std::uint8_t>(state[i] >> 24);
    out[i * 4 + 1] = static_cast<std::uint8_t>(state[i] >> 16);
    out[i * 4 + 2] = static_cast<std::uint8_t>(state[i] >> 8);
    out[i * 4 + 3] = static_cast<std::uint8_t>(state[i]);
  }
}

// ===== MD5 =====

[[maybe_unused]] static const std::uint32_t kMd5K[64] = {
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
};

[[maybe_unused]] static const int kMd5S[64] = {
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
};

[[maybe_unused]] static inline std::uint32_t rotl32(std::uint32_t x, int n) {
  return (x << n) | (x >> (32 - n));
}

[[maybe_unused]] static void md5Process(std::uint32_t state[4], const std::uint8_t block[64]) {
  std::uint32_t m[16];
  for (int i = 0; i < 16; ++i) {
    m[i] = static_cast<std::uint32_t>(block[i * 4])
         | (static_cast<std::uint32_t>(block[i * 4 + 1]) << 8)
         | (static_cast<std::uint32_t>(block[i * 4 + 2]) << 16)
         | (static_cast<std::uint32_t>(block[i * 4 + 3]) << 24);
  }
  std::uint32_t a = state[0], b = state[1], c = state[2], d = state[3];
  for (int i = 0; i < 64; ++i) {
    std::uint32_t f;
    int g;
    if (i < 16) { f = (b & c) | (~b & d); g = i; }
    else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
    else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
    else { f = c ^ (b | ~d); g = (7 * i) % 16; }
    std::uint32_t temp = d;
    d = c;
    c = b;
    b = b + rotl32(a + f + kMd5K[i] + m[g], kMd5S[i]);
    a = temp;
  }
  state[0] += a; state[1] += b; state[2] += c; state[3] += d;
}

[[maybe_unused]] static void md5Bytes(const std::uint8_t* data, std::size_t size, std::uint8_t out[16]) {
  std::uint32_t state[4] = { 0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476 };
  std::uint64_t bitLength = static_cast<std::uint64_t>(size) * 8;
  std::vector<std::uint8_t> padded(data, data + size);
  padded.push_back(0x80);
  while (padded.size() % 64 != 56) { padded.push_back(0); }
  for (int i = 0; i < 8; ++i) { padded.push_back(static_cast<std::uint8_t>((bitLength >> (i * 8)) & 0xff)); }
  for (std::size_t offset = 0; offset < padded.size(); offset += 64) {
    md5Process(state, padded.data() + offset);
  }
  for (int i = 0; i < 4; ++i) {
    out[i * 4] = static_cast<std::uint8_t>(state[i]);
    out[i * 4 + 1] = static_cast<std::uint8_t>(state[i] >> 8);
    out[i * 4 + 2] = static_cast<std::uint8_t>(state[i] >> 16);
    out[i * 4 + 3] = static_cast<std::uint8_t>(state[i] >> 24);
  }
}

}  // namespace doublemint_crypto_detail

[[maybe_unused]] static std::string __doublemint_crypto_sha256(std::string_view value) {
  std::uint8_t digest[32];
  doublemint_crypto_detail::sha256Bytes(reinterpret_cast<const std::uint8_t*>(value.data()), value.size(), digest);
  return doublemint_crypto_detail::bytesToHex(digest, 32);
}

[[maybe_unused]] static std::string __doublemint_crypto_md5(std::string_view value) {
  std::uint8_t digest[16];
  doublemint_crypto_detail::md5Bytes(reinterpret_cast<const std::uint8_t*>(value.data()), value.size(), digest);
  return doublemint_crypto_detail::bytesToHex(digest, 16);
}

[[maybe_unused]] static std::string __doublemint_crypto_hmac_sha256(std::string_view key, std::string_view message) {
  std::uint8_t blockKey[64] = {0};
  if (key.size() > 64) {
    doublemint_crypto_detail::sha256Bytes(reinterpret_cast<const std::uint8_t*>(key.data()), key.size(), blockKey);
  } else {
    std::memcpy(blockKey, key.data(), key.size());
  }
  std::uint8_t ipad[64], opad[64];
  for (int i = 0; i < 64; ++i) { ipad[i] = blockKey[i] ^ 0x36; opad[i] = blockKey[i] ^ 0x5c; }
  std::vector<std::uint8_t> inner;
  inner.insert(inner.end(), ipad, ipad + 64);
  inner.insert(inner.end(), message.begin(), message.end());
  std::uint8_t innerDigest[32];
  doublemint_crypto_detail::sha256Bytes(inner.data(), inner.size(), innerDigest);
  std::vector<std::uint8_t> outer;
  outer.insert(outer.end(), opad, opad + 64);
  outer.insert(outer.end(), innerDigest, innerDigest + 32);
  std::uint8_t finalDigest[32];
  doublemint_crypto_detail::sha256Bytes(outer.data(), outer.size(), finalDigest);
  return doublemint_crypto_detail::bytesToHex(finalDigest, 32);
}

[[maybe_unused]] static std::string __doublemint_crypto_hmac_md5(std::string_view key, std::string_view message) {
  std::uint8_t blockKey[64] = {0};
  if (key.size() > 64) {
    doublemint_crypto_detail::md5Bytes(reinterpret_cast<const std::uint8_t*>(key.data()), key.size(), blockKey);
  } else {
    std::memcpy(blockKey, key.data(), key.size());
  }
  std::uint8_t ipad[64], opad[64];
  for (int i = 0; i < 64; ++i) { ipad[i] = blockKey[i] ^ 0x36; opad[i] = blockKey[i] ^ 0x5c; }
  std::vector<std::uint8_t> inner;
  inner.insert(inner.end(), ipad, ipad + 64);
  inner.insert(inner.end(), message.begin(), message.end());
  std::uint8_t innerDigest[16];
  doublemint_crypto_detail::md5Bytes(inner.data(), inner.size(), innerDigest);
  std::vector<std::uint8_t> outer;
  outer.insert(outer.end(), opad, opad + 64);
  outer.insert(outer.end(), innerDigest, innerDigest + 16);
  std::uint8_t finalDigest[16];
  doublemint_crypto_detail::md5Bytes(outer.data(), outer.size(), finalDigest);
  return doublemint_crypto_detail::bytesToHex(finalDigest, 16);
}
