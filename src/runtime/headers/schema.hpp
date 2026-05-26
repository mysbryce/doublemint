namespace doublemint_schema_detail {
struct JsonValue;
struct SchemaHolder;
struct ValidationData;
}

class ValidationResult {
 private:
  std::shared_ptr<doublemint_schema_detail::ValidationData> data_;

 public:
  ValidationResult();
  explicit ValidationResult(std::shared_ptr<doublemint_schema_detail::ValidationData> data);
  bool ok() const;
  std::string error() const;
  std::string getString(std::string_view name) const;
  int getInt(std::string_view name) const;
  std::int64_t getInt64(std::string_view name) const;
  double getFloat(std::string_view name) const;
  bool getBool(std::string_view name) const;
  bool has(std::string_view name) const;
};

class Schema {
 private:
  std::shared_ptr<doublemint_schema_detail::SchemaHolder> holder_;

 public:
  Schema();
  void required(std::string_view name, std::string_view typeKind);
  void optional(std::string_view name, std::string_view typeKind);
  void requiredArray(std::string_view name, std::string_view elementTypeKind);
  void optionalArray(std::string_view name, std::string_view elementTypeKind);
  void requiredObject(std::string_view name, const Schema& sub);
  void optionalObject(std::string_view name, const Schema& sub);
  void min(std::string_view name, std::int64_t value);
  void max(std::string_view name, std::int64_t value);
  void minItems(std::string_view name, std::int64_t value);
  void maxItems(std::string_view name, std::int64_t value);
  void oneOf(std::string_view name, const std::vector<std::string_view>& options);
  void pattern(std::string_view name, std::string_view regex);
  ValidationResult validate(std::string_view json) const;
};
