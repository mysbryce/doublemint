class HeaderMap {
 private:
  std::vector<std::pair<std::string, std::string>> data_;
  static bool equalsCaseInsensitive(std::string_view a, std::string_view b) {
    if (a.size() != b.size()) { return false; }
    for (std::size_t index = 0; index < a.size(); ++index) {
      char ca = a[index]; char cb = b[index];
      if (ca >= 'A' && ca <= 'Z') { ca = static_cast<char>(ca + 32); }
      if (cb >= 'A' && cb <= 'Z') { cb = static_cast<char>(cb + 32); }
      if (ca != cb) { return false; }
    }
    return true;
  }

 public:
  HeaderMap() = default;
  void set(std::string_view key, std::string_view value) {
    data_.emplace_back(std::string(key), std::string(value));
  }
  std::string operator[](std::string_view key) const {
    for (const auto& entry : data_) {
      if (entry.first == key) { return entry.second; }
    }
    for (const auto& entry : data_) {
      if (equalsCaseInsensitive(entry.first, key)) { return entry.second; }
    }
    return std::string();
  }
};

namespace doublemint_http_detail {
struct ServerHolder;
struct ContextState;
}

class Context {
 private:
  std::shared_ptr<doublemint_http_detail::ContextState> state_;

 public:
  explicit Context(std::shared_ptr<doublemint_http_detail::ContextState> state) noexcept
      : state_(std::move(state)) {}
  std::string method() const;
  std::string path() const;
  std::string body() const;
  HeaderMap headers() const;
  HeaderMap params() const;
  HeaderMap query() const;
  std::string header(std::string_view name) const;
  std::string param(std::string_view name) const;
  std::string queryParam(std::string_view name) const;
  void setStatus(int status) const;
  void setHeader(std::string_view name, std::string_view value) const;
  void text(std::string_view body) const;
  void json(std::string_view body) const;
  void html(std::string_view body) const;
  void send(int status, std::string_view contentType, std::string_view body) const;
};

class Http {
 private:
  std::shared_ptr<doublemint_http_detail::ServerHolder> holder_;

 public:
  Http();
  void get(std::string_view pattern, const std::function<void(const Context&)>& handler);
  void post(std::string_view pattern, const std::function<void(const Context&)>& handler);
  void put(std::string_view pattern, const std::function<void(const Context&)>& handler);
  void del(std::string_view pattern, const std::function<void(const Context&)>& handler);
  void patch(std::string_view pattern, const std::function<void(const Context&)>& handler);
  void options(std::string_view pattern, const std::function<void(const Context&)>& handler);
  bool listen(std::string_view host, int port);
  void stop();
};
