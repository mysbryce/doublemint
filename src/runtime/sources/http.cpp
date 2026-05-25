// Implementation of Http and Context classes from runtime/headers/http.hpp,
// using cpp-httplib (prepended at embed time by scripts/embed-runtime.mjs).

namespace doublemint_http_detail {

struct ServerHolder {
  httplib::Server server;
};

[[maybe_unused]] static const httplib::Request* asRequest(const void* p) {
  return reinterpret_cast<const httplib::Request*>(p);
}

[[maybe_unused]] static httplib::Response* asResponse(void* p) {
  return reinterpret_cast<httplib::Response*>(p);
}

[[maybe_unused]] static httplib::Server::Handler makeBridge(
    const std::function<void(const Context&)>& handler) {
  return [handler](const httplib::Request& req, httplib::Response& res) {
    Context ctx(&req, &res);
    handler(ctx);
  };
}

}  // namespace doublemint_http_detail

std::string Context::method() const {
  return doublemint_http_detail::asRequest(req_)->method;
}

std::string Context::path() const {
  return doublemint_http_detail::asRequest(req_)->path;
}

std::string Context::body() const {
  return doublemint_http_detail::asRequest(req_)->body;
}

std::string Context::header(std::string_view name) const {
  return doublemint_http_detail::asRequest(req_)->get_header_value(std::string(name));
}

std::string Context::param(std::string_view name) const {
  const auto& params = doublemint_http_detail::asRequest(req_)->path_params;
  auto entry = params.find(std::string(name));
  return entry == params.end() ? std::string() : entry->second;
}

std::string Context::query(std::string_view name) const {
  return doublemint_http_detail::asRequest(req_)->get_param_value(std::string(name));
}

void Context::setStatus(int status) const {
  doublemint_http_detail::asResponse(res_)->status = status;
}

void Context::setHeader(std::string_view name, std::string_view value) const {
  doublemint_http_detail::asResponse(res_)->set_header(std::string(name), std::string(value));
}

void Context::text(std::string_view body) const {
  auto* res = doublemint_http_detail::asResponse(res_);
  if (res->status == 0 || res->status == -1) { res->status = 200; }
  res->set_content(std::string(body), "text/plain; charset=utf-8");
}

void Context::json(std::string_view body) const {
  auto* res = doublemint_http_detail::asResponse(res_);
  if (res->status == 0 || res->status == -1) { res->status = 200; }
  res->set_content(std::string(body), "application/json; charset=utf-8");
}

void Context::html(std::string_view body) const {
  auto* res = doublemint_http_detail::asResponse(res_);
  if (res->status == 0 || res->status == -1) { res->status = 200; }
  res->set_content(std::string(body), "text/html; charset=utf-8");
}

void Context::send(int status, std::string_view contentType, std::string_view body) const {
  auto* res = doublemint_http_detail::asResponse(res_);
  res->status = status;
  res->set_content(std::string(body), std::string(contentType));
}

Http::Http() : holder_(std::make_shared<doublemint_http_detail::ServerHolder>()) {}

void Http::get(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  holder_->server.Get(std::string(pattern), doublemint_http_detail::makeBridge(handler));
}

void Http::post(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  holder_->server.Post(std::string(pattern), doublemint_http_detail::makeBridge(handler));
}

void Http::put(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  holder_->server.Put(std::string(pattern), doublemint_http_detail::makeBridge(handler));
}

void Http::del(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  holder_->server.Delete(std::string(pattern), doublemint_http_detail::makeBridge(handler));
}

void Http::patch(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  holder_->server.Patch(std::string(pattern), doublemint_http_detail::makeBridge(handler));
}

void Http::options(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  holder_->server.Options(std::string(pattern), doublemint_http_detail::makeBridge(handler));
}

bool Http::listen(std::string_view host, int port) {
  return holder_->server.listen(host.empty() ? std::string("0.0.0.0") : std::string(host), port);
}

void Http::stop() {
  holder_->server.stop();
}
