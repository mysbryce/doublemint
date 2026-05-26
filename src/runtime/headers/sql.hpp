namespace doublemint_sql_detail {
struct DatabaseHolder;
struct ResultHolder;
}

class SqlResult {
 private:
  std::shared_ptr<doublemint_sql_detail::ResultHolder> holder_;

 public:
  explicit SqlResult(std::shared_ptr<doublemint_sql_detail::ResultHolder> holder) noexcept
      : holder_(std::move(holder)) {}
  bool hasNext() const;
  void next() const;
  std::string getString(std::string_view column) const;
  int getInt(std::string_view column) const;
  std::int64_t getInt64(std::string_view column) const;
  double getDouble(std::string_view column) const;
  bool isNull(std::string_view column) const;
  int columnCount() const;
  std::string columnName(int index) const;
  std::string error() const;
  void close() const;
};

class Database {
 private:
  std::shared_ptr<doublemint_sql_detail::DatabaseHolder> holder_;

 public:
  Database();
  bool open(std::string_view path) const;
  bool openMemory() const;
  void close() const;
  bool exec(std::string_view sql) const;
  bool execParams(std::string_view sql, const std::vector<std::string_view>& params) const;
  SqlResult query(std::string_view sql) const;
  SqlResult queryParams(std::string_view sql, const std::vector<std::string_view>& params) const;
  std::int64_t lastInsertRowId() const;
  int changes() const;
  std::string error() const;
};
