#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wall"
#pragma GCC diagnostic ignored "-Wextra"
#pragma GCC diagnostic ignored "-Wpedantic"
#pragma GCC diagnostic ignored "-Wunused-parameter"
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-variable"
#pragma GCC diagnostic ignored "-Wsign-compare"
#pragma GCC diagnostic ignored "-Wmissing-field-initializers"
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#pragma GCC diagnostic ignored "-Wparentheses"
#include "App.h"
#pragma GCC diagnostic pop

namespace doublemint_http_detail {

struct ContextState {
  uWS::HttpResponse<false>* response = nullptr;
  std::string method;
  std::string path;
  std::string body;
  std::vector<std::pair<std::string, std::string>> headers;
  std::unordered_map<std::string, std::string> pathParams;
  std::unordered_map<std::string, std::string> queryParams;
  int pendingStatus = 0;
  std::vector<std::pair<std::string, std::string>> pendingHeaders;
  bool ended = false;
};

struct ServerHolder {
  std::unique_ptr<uWS::App> app;
  us_listen_socket_t* listenSocket = nullptr;
  ServerHolder() : app(std::make_unique<uWS::App>()) {}
};

[[maybe_unused]] static std::unordered_map<std::string, std::string> parseQueryString(std::string_view query) {
  std::unordered_map<std::string, std::string> out;
  std::size_t start = 0;
  while (start <= query.size()) {
    std::size_t end = query.find('&', start);
    if (end == std::string_view::npos) { end = query.size(); }
    auto piece = query.substr(start, end - start);
    auto eq = piece.find('=');
    if (eq != std::string_view::npos) {
      out.emplace(std::string(piece.substr(0, eq)), std::string(piece.substr(eq + 1)));
    } else if (!piece.empty()) {
      out.emplace(std::string(piece), std::string());
    }
    if (end == query.size()) { break; }
    start = end + 1;
  }
  return out;
}

[[maybe_unused]] static std::vector<std::string> extractPathParamNames(std::string_view pattern) {
  std::vector<std::string> names;
  std::size_t cursor = 0;
  while (cursor < pattern.size()) {
    auto colon = pattern.find(':', cursor);
    if (colon == std::string_view::npos) { break; }
    auto stop = colon + 1;
    while (stop < pattern.size()) {
      char c = pattern[stop];
      bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
      if (!ok) { break; }
      ++stop;
    }
    names.emplace_back(pattern.substr(colon + 1, stop - colon - 1));
    cursor = stop;
  }
  return names;
}

[[maybe_unused]] static void applyPendingHeaders(ContextState& state) {
  if (state.ended) { return; }
  if (state.pendingStatus > 0) {
    state.response->writeStatus(std::to_string(state.pendingStatus));
  }
  for (const auto& header : state.pendingHeaders) {
    state.response->writeHeader(header.first, header.second);
  }
  state.pendingHeaders.clear();
}

[[maybe_unused]] static void invokeHandler(
    uWS::HttpResponse<false>* res,
    uWS::HttpRequest* req,
    const std::vector<std::string>& paramNames,
    const std::function<void(const Context&)>& handler,
    bool collectBody) {
  auto state = std::make_shared<ContextState>();
  state->response = res;
  state->method = std::string(req->getMethod());
  for (auto& ch : state->method) {
    if (ch >= 'a' && ch <= 'z') { ch = static_cast<char>(ch - 32); }
  }
  state->path = std::string(req->getUrl());
  for (std::size_t index = 0; index < paramNames.size(); ++index) {
    auto value = req->getParameter(static_cast<unsigned short>(index));
    if (!value.empty()) {
      state->pathParams.emplace(paramNames[index], std::string(value));
    }
  }
  state->queryParams = parseQueryString(req->getQuery());
  for (auto it = req->begin(); it != req->end(); ++it) {
    auto pair = *it;
    state->headers.emplace_back(std::string(pair.first), std::string(pair.second));
  }

  res->onAborted([state]() { state->ended = true; });

  if (!collectBody) {
    handler(Context(state));
    if (!state->ended) {
      applyPendingHeaders(*state);
      res->end();
      state->ended = true;
    }
    return;
  }

  res->onData([state, handler](std::string_view chunk, bool last) {
    state->body.append(chunk.data(), chunk.size());
    if (last && !state->ended) {
      handler(Context(state));
      if (!state->ended) {
        applyPendingHeaders(*state);
        state->response->end();
        state->ended = true;
      }
    }
  });
}

[[maybe_unused]] static void registerRoute(
    ServerHolder& holder,
    const std::string& method,
    std::string_view pattern,
    const std::function<void(const Context&)>& handler) {
  auto names = extractPathParamNames(pattern);
  bool collectBody = method != "GET" && method != "HEAD" && method != "OPTIONS";
  auto adapter = [names, handler, collectBody](uWS::HttpResponse<false>* res, uWS::HttpRequest* req) {
    invokeHandler(res, req, names, handler, collectBody);
  };
  std::string p(pattern);
  if (method == "GET") { holder.app->get(p, adapter); }
  else if (method == "POST") { holder.app->post(p, adapter); }
  else if (method == "PUT") { holder.app->put(p, adapter); }
  else if (method == "DELETE") { holder.app->del(p, adapter); }
  else if (method == "PATCH") { holder.app->patch(p, adapter); }
  else if (method == "OPTIONS") { holder.app->options(p, adapter); }
}

}  // namespace doublemint_http_detail

std::string Context::method() const { return state_->method; }
std::string Context::path() const { return state_->path; }
std::string Context::body() const { return state_->body; }

HeaderMap Context::headers() const {
  HeaderMap result;
  for (const auto& entry : state_->headers) { result.set(entry.first, entry.second); }
  return result;
}

HeaderMap Context::params() const {
  HeaderMap result;
  for (const auto& entry : state_->pathParams) { result.set(entry.first, entry.second); }
  return result;
}

HeaderMap Context::query() const {
  HeaderMap result;
  for (const auto& entry : state_->queryParams) { result.set(entry.first, entry.second); }
  return result;
}

std::string Context::header(std::string_view name) const {
  std::string lower(name);
  for (auto& ch : lower) {
    if (ch >= 'A' && ch <= 'Z') { ch = static_cast<char>(ch + 32); }
  }
  for (const auto& entry : state_->headers) {
    std::string key = entry.first;
    for (auto& ch : key) {
      if (ch >= 'A' && ch <= 'Z') { ch = static_cast<char>(ch + 32); }
    }
    if (key == lower) { return entry.second; }
  }
  return std::string();
}

std::string Context::param(std::string_view name) const {
  auto entry = state_->pathParams.find(std::string(name));
  return entry == state_->pathParams.end() ? std::string() : entry->second;
}

std::string Context::queryParam(std::string_view name) const {
  auto entry = state_->queryParams.find(std::string(name));
  return entry == state_->queryParams.end() ? std::string() : entry->second;
}

void Context::setStatus(int status) const { state_->pendingStatus = status; }

void Context::setHeader(std::string_view name, std::string_view value) const {
  state_->pendingHeaders.emplace_back(std::string(name), std::string(value));
}

void Context::text(std::string_view body) const {
  if (state_->ended) { return; }
  if (state_->pendingStatus == 0) { state_->pendingStatus = 200; }
  state_->pendingHeaders.emplace_back("Content-Type", "text/plain; charset=utf-8");
  doublemint_http_detail::applyPendingHeaders(*state_);
  state_->response->end(body);
  state_->ended = true;
}

void Context::json(std::string_view body) const {
  if (state_->ended) { return; }
  if (state_->pendingStatus == 0) { state_->pendingStatus = 200; }
  state_->pendingHeaders.emplace_back("Content-Type", "application/json; charset=utf-8");
  doublemint_http_detail::applyPendingHeaders(*state_);
  state_->response->end(body);
  state_->ended = true;
}

void Context::html(std::string_view body) const {
  if (state_->ended) { return; }
  if (state_->pendingStatus == 0) { state_->pendingStatus = 200; }
  state_->pendingHeaders.emplace_back("Content-Type", "text/html; charset=utf-8");
  doublemint_http_detail::applyPendingHeaders(*state_);
  state_->response->end(body);
  state_->ended = true;
}

void Context::send(int status, std::string_view contentType, std::string_view body) const {
  if (state_->ended) { return; }
  state_->pendingStatus = status;
  state_->pendingHeaders.emplace_back("Content-Type", std::string(contentType));
  doublemint_http_detail::applyPendingHeaders(*state_);
  state_->response->end(body);
  state_->ended = true;
}

Http::Http() : holder_(std::make_shared<doublemint_http_detail::ServerHolder>()) {}

void Http::get(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  doublemint_http_detail::registerRoute(*holder_, "GET", pattern, handler);
}
void Http::post(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  doublemint_http_detail::registerRoute(*holder_, "POST", pattern, handler);
}
void Http::put(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  doublemint_http_detail::registerRoute(*holder_, "PUT", pattern, handler);
}
void Http::del(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  doublemint_http_detail::registerRoute(*holder_, "DELETE", pattern, handler);
}
void Http::patch(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  doublemint_http_detail::registerRoute(*holder_, "PATCH", pattern, handler);
}
void Http::options(std::string_view pattern, const std::function<void(const Context&)>& handler) {
  doublemint_http_detail::registerRoute(*holder_, "OPTIONS", pattern, handler);
}

namespace doublemint_http_detail {

struct WsPerSocket {};

using WsType = uWS::WebSocket<false, true, WsPerSocket>;

}  // namespace doublemint_http_detail

void WebSocket::send(std::string_view message) const {
  auto* ws = static_cast<doublemint_http_detail::WsType*>(socket_);
  if (ws != nullptr) { ws->send(message, uWS::OpCode::TEXT); }
}

void WebSocket::sendBinary(const std::vector<int>& data) const {
  auto* ws = static_cast<doublemint_http_detail::WsType*>(socket_);
  if (ws == nullptr) { return; }
  std::string buffer;
  buffer.reserve(data.size());
  for (int byte : data) { buffer.push_back(static_cast<char>(byte & 0xff)); }
  ws->send(buffer, uWS::OpCode::BINARY);
}

void WebSocket::close() const {
  auto* ws = static_cast<doublemint_http_detail::WsType*>(socket_);
  if (ws != nullptr) { ws->close(); }
}

void WebSocket::closeWithCode(int code, std::string_view reason) const {
  auto* ws = static_cast<doublemint_http_detail::WsType*>(socket_);
  if (ws != nullptr) { ws->end(code, reason); }
}

std::string WebSocket::remoteAddress() const {
  auto* ws = static_cast<doublemint_http_detail::WsType*>(socket_);
  if (ws == nullptr) { return std::string(); }
  return std::string(ws->getRemoteAddressAsText());
}

void Http::ws(
    std::string_view pattern,
    const std::function<void(const WebSocket&)>& openHandler,
    const std::function<void(const WebSocket&, std::string_view)>& messageHandler,
    const std::function<void(const WebSocket&)>& closeHandler) {
  using namespace doublemint_http_detail;
  uWS::App::WebSocketBehavior<WsPerSocket> behavior{};
  behavior.open = [openHandler](WsType* ws) {
    WebSocket wrapper(ws);
    if (openHandler) { openHandler(wrapper); }
  };
  behavior.message = [messageHandler](WsType* ws, std::string_view message, uWS::OpCode opCode) {
    (void)opCode;
    WebSocket wrapper(ws);
    if (messageHandler) { messageHandler(wrapper, message); }
  };
  behavior.close = [closeHandler](WsType* ws, int code, std::string_view reason) {
    (void)code;
    (void)reason;
    WebSocket wrapper(ws);
    if (closeHandler) { closeHandler(wrapper); }
  };
  holder_->app->ws<WsPerSocket>(std::string(pattern), std::move(behavior));
}

bool Http::listen(std::string_view host, int port) {
  auto* shared = holder_.get();
  bool ok = false;
  std::string hostStr = host.empty() ? std::string("0.0.0.0") : std::string(host);
  shared->app->listen(hostStr, port, [shared, &ok](us_listen_socket_t* token) {
    if (token != nullptr) {
      shared->listenSocket = token;
      ok = true;
    }
  });
  shared->app->run();
  return ok;
}

void Http::stop() {
  if (holder_->listenSocket != nullptr) {
    us_listen_socket_close(0, holder_->listenSocket);
    holder_->listenSocket = nullptr;
  }
}
