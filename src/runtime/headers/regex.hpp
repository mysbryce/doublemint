class Regex {
  std::regex pattern_;
public:
  explicit Regex(std::string_view pattern) : pattern_(std::string(pattern)) {}
  bool test(std::string_view value) const { return std::regex_match(std::string(value), pattern_); }
  std::string replace(std::string_view value, std::string_view replacement) const { return std::regex_replace(std::string(value), pattern_, std::string(replacement)); }
};
