class HeaderMap {
 private:
  std::unordered_map<std::string, std::string> data_;

 public:
  HeaderMap() = default;
  void set(std::string_view key, std::string_view value) {
    data_[std::string(key)] = std::string(value);
  }
  std::string operator[](std::string_view key) const {
    auto entry = data_.find(std::string(key));
    return entry == data_.end() ? std::string() : entry->second;
  }
};

namespace doublemint_http_detail {
struct ServerHolder;
}

class Context {
 private:
  const void* req_;
  void* res_;

 public:
  Context(const void* req, void* res) noexcept : req_(req), res_(res) {}
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
