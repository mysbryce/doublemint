#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wall"
#pragma GCC diagnostic ignored "-Wextra"
#pragma GCC diagnostic ignored "-Wpedantic"
extern "C" {
#include "sqlite3.h"
}
#pragma GCC diagnostic pop

namespace doublemint_sql_detail {

struct DatabaseHolder {
  sqlite3* db = nullptr;
  std::string lastError;
  ~DatabaseHolder() {
    if (db != nullptr) { sqlite3_close(db); db = nullptr; }
  }
};

struct ResultHolder {
  sqlite3_stmt* stmt = nullptr;
  int currentStatus = SQLITE_DONE;
  std::string lastError;
  std::vector<std::string> columnNames;

  ~ResultHolder() {
    if (stmt != nullptr) { sqlite3_finalize(stmt); stmt = nullptr; }
  }
};

[[maybe_unused]] static int findColumn(const ResultHolder& holder, std::string_view name) {
  for (std::size_t index = 0; index < holder.columnNames.size(); ++index) {
    if (holder.columnNames[index] == name) { return static_cast<int>(index); }
  }
  return -1;
}

[[maybe_unused]] static void populateColumnNames(ResultHolder& holder) {
  int count = sqlite3_column_count(holder.stmt);
  holder.columnNames.clear();
  holder.columnNames.reserve(static_cast<std::size_t>(count));
  for (int index = 0; index < count; ++index) {
    const char* name = sqlite3_column_name(holder.stmt, index);
    holder.columnNames.emplace_back(name == nullptr ? std::string() : std::string(name));
  }
}

[[maybe_unused]] static bool bindParams(sqlite3_stmt* stmt, const std::vector<std::string_view>& params) {
  for (std::size_t index = 0; index < params.size(); ++index) {
    int rc = sqlite3_bind_text(stmt, static_cast<int>(index + 1), params[index].data(), static_cast<int>(params[index].size()), SQLITE_TRANSIENT);
    if (rc != SQLITE_OK) { return false; }
  }
  return true;
}

}  // namespace doublemint_sql_detail

bool SqlResult::hasNext() const {
  return holder_ && holder_->stmt != nullptr && holder_->currentStatus == SQLITE_ROW;
}

void SqlResult::next() const {
  if (!holder_ || holder_->stmt == nullptr) { return; }
  holder_->currentStatus = sqlite3_step(holder_->stmt);
  if (holder_->currentStatus != SQLITE_ROW && holder_->currentStatus != SQLITE_DONE) {
    const char* err = sqlite3_errmsg(sqlite3_db_handle(holder_->stmt));
    holder_->lastError = err == nullptr ? std::string() : std::string(err);
  }
}

std::string SqlResult::getString(std::string_view column) const {
  if (!holder_ || holder_->stmt == nullptr) { return std::string(); }
  int index = doublemint_sql_detail::findColumn(*holder_, column);
  if (index < 0) { return std::string(); }
  const unsigned char* text = sqlite3_column_text(holder_->stmt, index);
  return text == nullptr ? std::string() : std::string(reinterpret_cast<const char*>(text));
}

int SqlResult::getInt(std::string_view column) const {
  if (!holder_ || holder_->stmt == nullptr) { return 0; }
  int index = doublemint_sql_detail::findColumn(*holder_, column);
  return index < 0 ? 0 : sqlite3_column_int(holder_->stmt, index);
}

std::int64_t SqlResult::getInt64(std::string_view column) const {
  if (!holder_ || holder_->stmt == nullptr) { return 0; }
  int index = doublemint_sql_detail::findColumn(*holder_, column);
  return index < 0 ? 0 : static_cast<std::int64_t>(sqlite3_column_int64(holder_->stmt, index));
}

double SqlResult::getDouble(std::string_view column) const {
  if (!holder_ || holder_->stmt == nullptr) { return 0.0; }
  int index = doublemint_sql_detail::findColumn(*holder_, column);
  return index < 0 ? 0.0 : sqlite3_column_double(holder_->stmt, index);
}

bool SqlResult::isNull(std::string_view column) const {
  if (!holder_ || holder_->stmt == nullptr) { return true; }
  int index = doublemint_sql_detail::findColumn(*holder_, column);
  return index < 0 || sqlite3_column_type(holder_->stmt, index) == SQLITE_NULL;
}

int SqlResult::columnCount() const {
  if (!holder_ || holder_->stmt == nullptr) { return 0; }
  return static_cast<int>(holder_->columnNames.size());
}

std::string SqlResult::columnName(int index) const {
  if (!holder_ || index < 0 || index >= static_cast<int>(holder_->columnNames.size())) { return std::string(); }
  return holder_->columnNames[static_cast<std::size_t>(index)];
}

std::string SqlResult::error() const {
  return holder_ ? holder_->lastError : std::string();
}

void SqlResult::close() const {
  if (!holder_) { return; }
  if (holder_->stmt != nullptr) {
    sqlite3_finalize(holder_->stmt);
    holder_->stmt = nullptr;
  }
}

Database::Database() : holder_(std::make_shared<doublemint_sql_detail::DatabaseHolder>()) {}

bool Database::open(std::string_view path) const {
  if (holder_->db != nullptr) { sqlite3_close(holder_->db); holder_->db = nullptr; }
  std::string p(path);
  int rc = sqlite3_open(p.c_str(), &holder_->db);
  if (rc != SQLITE_OK) {
    holder_->lastError = sqlite3_errmsg(holder_->db);
    sqlite3_close(holder_->db);
    holder_->db = nullptr;
    return false;
  }
  holder_->lastError.clear();
  return true;
}

bool Database::openMemory() const {
  return open(":memory:");
}

void Database::close() const {
  if (holder_->db != nullptr) {
    sqlite3_close(holder_->db);
    holder_->db = nullptr;
  }
}

bool Database::exec(std::string_view sql) const {
  if (holder_->db == nullptr) { holder_->lastError = "Database not open"; return false; }
  char* err = nullptr;
  std::string s(sql);
  int rc = sqlite3_exec(holder_->db, s.c_str(), nullptr, nullptr, &err);
  if (rc != SQLITE_OK) {
    holder_->lastError = err == nullptr ? std::string() : std::string(err);
    if (err) { sqlite3_free(err); }
    return false;
  }
  holder_->lastError.clear();
  return true;
}

bool Database::execParams(std::string_view sql, const std::vector<std::string_view>& params) const {
  if (holder_->db == nullptr) { holder_->lastError = "Database not open"; return false; }
  sqlite3_stmt* stmt = nullptr;
  std::string s(sql);
  int rc = sqlite3_prepare_v2(holder_->db, s.c_str(), -1, &stmt, nullptr);
  if (rc != SQLITE_OK) {
    holder_->lastError = sqlite3_errmsg(holder_->db);
    return false;
  }
  if (!doublemint_sql_detail::bindParams(stmt, params)) {
    holder_->lastError = "bind failed";
    sqlite3_finalize(stmt);
    return false;
  }
  rc = sqlite3_step(stmt);
  sqlite3_finalize(stmt);
  if (rc != SQLITE_DONE && rc != SQLITE_ROW) {
    holder_->lastError = sqlite3_errmsg(holder_->db);
    return false;
  }
  holder_->lastError.clear();
  return true;
}

SqlResult Database::query(std::string_view sql) const {
  return queryParams(sql, {});
}

SqlResult Database::queryParams(std::string_view sql, const std::vector<std::string_view>& params) const {
  auto result = std::make_shared<doublemint_sql_detail::ResultHolder>();
  if (holder_->db == nullptr) {
    result->lastError = "Database not open";
    return SqlResult(result);
  }
  std::string s(sql);
  int rc = sqlite3_prepare_v2(holder_->db, s.c_str(), -1, &result->stmt, nullptr);
  if (rc != SQLITE_OK) {
    result->lastError = sqlite3_errmsg(holder_->db);
    return SqlResult(result);
  }
  if (!doublemint_sql_detail::bindParams(result->stmt, params)) {
    result->lastError = "bind failed";
    sqlite3_finalize(result->stmt);
    result->stmt = nullptr;
    return SqlResult(result);
  }
  doublemint_sql_detail::populateColumnNames(*result);
  result->currentStatus = sqlite3_step(result->stmt);
  if (result->currentStatus != SQLITE_ROW && result->currentStatus != SQLITE_DONE) {
    result->lastError = sqlite3_errmsg(holder_->db);
  }
  return SqlResult(result);
}

std::int64_t Database::lastInsertRowId() const {
  if (holder_->db == nullptr) { return 0; }
  return static_cast<std::int64_t>(sqlite3_last_insert_rowid(holder_->db));
}

int Database::changes() const {
  if (holder_->db == nullptr) { return 0; }
  return sqlite3_changes(holder_->db);
}

std::string Database::error() const { return holder_->lastError; }
