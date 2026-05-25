// Bridge between Mint's mint:http surface and cpp-httplib.
// The cpp-httplib single-header is prepended to this file by
// scripts/embed-runtime.mjs at build time so the implementation is
// self-contained inside the generated translation unit.

namespace doublemint_http_detail {

struct HttpContext {
  const httplib::Request* request;
  httplib::Response* response;
};

struct ServerEntry {
  std::unique_ptr<httplib::Server> server;
};

struct ServerRegistry {
  std::mutex tableMutex;
  std::unordered_map<int, std::unique_ptr<ServerEntry>> servers;
  int counter{0};
};

[[maybe_unused]] static ServerRegistry& serverRegistry() {
  static ServerRegistry instance;
  return instance;
}

[[maybe_unused]] static httplib::Server* lookupServer(int id) {
  auto& registry = serverRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  auto entry = registry.servers.find(id);
  return entry == registry.servers.end() ? nullptr : entry->second->server.get();
}

[[maybe_unused]] static HttpContext* lookupContext(std::int64_t handle) {
  return handle == 0 ? nullptr : reinterpret_cast<HttpContext*>(static_cast<std::uintptr_t>(handle));
}

}  // namespace doublemint_http_detail

[[maybe_unused]] static int __doublemint_http_create() {
  auto& registry = doublemint_http_detail::serverRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  int id = ++registry.counter;
  auto entry = std::make_unique<doublemint_http_detail::ServerEntry>();
  entry->server = std::make_unique<httplib::Server>();
  registry.servers.emplace(id, std::move(entry));
  return id;
}

[[maybe_unused]] static void __doublemint_http_destroy(int serverId) {
  auto& registry = doublemint_http_detail::serverRegistry();
  std::lock_guard<std::mutex> guard(registry.tableMutex);
  auto entry = registry.servers.find(serverId);
  if (entry == registry.servers.end()) { return; }
  if (entry->second->server) { entry->second->server->stop(); }
  registry.servers.erase(entry);
}

namespace doublemint_http_detail {

[[maybe_unused]] static void registerRoute(
    int serverId, const std::string& method, const std::string& pattern,
    const std::function<void(std::int64_t)>& handler) {
  auto* server = lookupServer(serverId);
  if (server == nullptr) { return; }
  auto bridge = [handler](const httplib::Request& req, httplib::Response& res) {
    HttpContext ctx{&req, &res};
    handler(static_cast<std::int64_t>(reinterpret_cast<std::uintptr_t>(&ctx)));
  };
  if (method == "GET") { server->Get(pattern, bridge); }
  else if (method == "POST") { server->Post(pattern, bridge); }
  else if (method == "PUT") { server->Put(pattern, bridge); }
  else if (method == "DELETE") { server->Delete(pattern, bridge); }
  else if (method == "PATCH") { server->Patch(pattern, bridge); }
  else if (method == "OPTIONS") { server->Options(pattern, bridge); }
}

}  // namespace doublemint_http_detail

[[maybe_unused]] static void __doublemint_http_get(int serverId, const std::string& pattern, const std::function<void(std::int64_t)>& handler) {
  doublemint_http_detail::registerRoute(serverId, "GET", pattern, handler);
}

[[maybe_unused]] static void __doublemint_http_post(int serverId, const std::string& pattern, const std::function<void(std::int64_t)>& handler) {
  doublemint_http_detail::registerRoute(serverId, "POST", pattern, handler);
}

[[maybe_unused]] static void __doublemint_http_put(int serverId, const std::string& pattern, const std::function<void(std::int64_t)>& handler) {
  doublemint_http_detail::registerRoute(serverId, "PUT", pattern, handler);
}

[[maybe_unused]] static void __doublemint_http_delete(int serverId, const std::string& pattern, const std::function<void(std::int64_t)>& handler) {
  doublemint_http_detail::registerRoute(serverId, "DELETE", pattern, handler);
}

[[maybe_unused]] static void __doublemint_http_patch(int serverId, const std::string& pattern, const std::function<void(std::int64_t)>& handler) {
  doublemint_http_detail::registerRoute(serverId, "PATCH", pattern, handler);
}

[[maybe_unused]] static void __doublemint_http_options(int serverId, const std::string& pattern, const std::function<void(std::int64_t)>& handler) {
  doublemint_http_detail::registerRoute(serverId, "OPTIONS", pattern, handler);
}

[[maybe_unused]] static bool __doublemint_http_listen(int serverId, const std::string& host, int port) {
  auto* server = doublemint_http_detail::lookupServer(serverId);
  if (server == nullptr) { return false; }
  return server->listen(host.empty() ? std::string("0.0.0.0") : host, port);
}

[[maybe_unused]] static void __doublemint_http_stop(int serverId) {
  auto* server = doublemint_http_detail::lookupServer(serverId);
  if (server != nullptr) { server->stop(); }
}

[[maybe_unused]] static std::string __doublemint_http_method(std::int64_t ctxHandle) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  return ctx == nullptr ? std::string() : ctx->request->method;
}

[[maybe_unused]] static std::string __doublemint_http_path(std::int64_t ctxHandle) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  return ctx == nullptr ? std::string() : ctx->request->path;
}

[[maybe_unused]] static std::string __doublemint_http_body(std::int64_t ctxHandle) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  return ctx == nullptr ? std::string() : ctx->request->body;
}

[[maybe_unused]] static std::string __doublemint_http_header(std::int64_t ctxHandle, const std::string& name) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  if (ctx == nullptr) { return std::string(); }
  return ctx->request->get_header_value(name);
}

[[maybe_unused]] static std::string __doublemint_http_param(std::int64_t ctxHandle, const std::string& name) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  if (ctx == nullptr) { return std::string(); }
  auto entry = ctx->request->path_params.find(name);
  return entry == ctx->request->path_params.end() ? std::string() : entry->second;
}

[[maybe_unused]] static std::string __doublemint_http_query(std::int64_t ctxHandle, const std::string& name) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  if (ctx == nullptr) { return std::string(); }
  return ctx->request->get_param_value(name);
}

[[maybe_unused]] static void __doublemint_http_set_status(std::int64_t ctxHandle, int status) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  if (ctx != nullptr) { ctx->response->status = status; }
}

[[maybe_unused]] static void __doublemint_http_set_header(std::int64_t ctxHandle, const std::string& name, const std::string& value) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  if (ctx != nullptr) { ctx->response->set_header(name, value); }
}

[[maybe_unused]] static void __doublemint_http_text(std::int64_t ctxHandle, const std::string& body) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  if (ctx == nullptr) { return; }
  ctx->response->status = ctx->response->status == 0 ? 200 : ctx->response->status;
  ctx->response->set_content(body, "text/plain; charset=utf-8");
}

[[maybe_unused]] static void __doublemint_http_json(std::int64_t ctxHandle, const std::string& body) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  if (ctx == nullptr) { return; }
  ctx->response->status = ctx->response->status == 0 ? 200 : ctx->response->status;
  ctx->response->set_content(body, "application/json; charset=utf-8");
}

[[maybe_unused]] static void __doublemint_http_html(std::int64_t ctxHandle, const std::string& body) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  if (ctx == nullptr) { return; }
  ctx->response->status = ctx->response->status == 0 ? 200 : ctx->response->status;
  ctx->response->set_content(body, "text/html; charset=utf-8");
}

[[maybe_unused]] static void __doublemint_http_send(std::int64_t ctxHandle, int status, const std::string& contentType, const std::string& body) {
  auto* ctx = doublemint_http_detail::lookupContext(ctxHandle);
  if (ctx == nullptr) { return; }
  ctx->response->status = status;
  ctx->response->set_content(body, contentType);
}
