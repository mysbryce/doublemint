// mint:schema: tiny JSON parser + structural validator.
// Designed to be useful both standalone and against ctx.body from mint:http.

namespace doublemint_schema_detail {

enum class JsonKind {
  Null,
  Bool,
  Int,
  Double,
  String,
  Array,
  Object
};

struct JsonValue {
  JsonKind kind = JsonKind::Null;
  bool boolValue = false;
  std::int64_t intValue = 0;
  double doubleValue = 0.0;
  std::string stringValue;
  std::vector<JsonValue> arrayValue;
  std::unordered_map<std::string, JsonValue> objectValue;
};

class JsonParser {
 public:
  explicit JsonParser(std::string_view input) : input_(input), pos_(0) {}

  bool parse(JsonValue& out) {
    skipWs();
    if (!parseValue(out)) { return false; }
    skipWs();
    return pos_ == input_.size();
  }

 private:
  std::string_view input_;
  std::size_t pos_;

  void skipWs() {
    while (pos_ < input_.size()) {
      char c = input_[pos_];
      if (c == ' ' || c == '\t' || c == '\n' || c == '\r') { ++pos_; continue; }
      break;
    }
  }

  bool parseValue(JsonValue& out) {
    skipWs();
    if (pos_ >= input_.size()) { return false; }
    char c = input_[pos_];
    if (c == '{') { return parseObject(out); }
    if (c == '[') { return parseArray(out); }
    if (c == '"') { return parseString(out); }
    if (c == 't' || c == 'f') { return parseBool(out); }
    if (c == 'n') { return parseNull(out); }
    if (c == '-' || (c >= '0' && c <= '9')) { return parseNumber(out); }
    return false;
  }

  bool parseObject(JsonValue& out) {
    if (input_[pos_] != '{') { return false; }
    ++pos_;
    out.kind = JsonKind::Object;
    skipWs();
    if (pos_ < input_.size() && input_[pos_] == '}') { ++pos_; return true; }
    while (pos_ < input_.size()) {
      skipWs();
      JsonValue key;
      if (!parseString(key)) { return false; }
      skipWs();
      if (pos_ >= input_.size() || input_[pos_] != ':') { return false; }
      ++pos_;
      JsonValue value;
      if (!parseValue(value)) { return false; }
      out.objectValue.emplace(key.stringValue, std::move(value));
      skipWs();
      if (pos_ < input_.size() && input_[pos_] == ',') { ++pos_; continue; }
      if (pos_ < input_.size() && input_[pos_] == '}') { ++pos_; return true; }
      return false;
    }
    return false;
  }

  bool parseArray(JsonValue& out) {
    if (input_[pos_] != '[') { return false; }
    ++pos_;
    out.kind = JsonKind::Array;
    skipWs();
    if (pos_ < input_.size() && input_[pos_] == ']') { ++pos_; return true; }
    while (pos_ < input_.size()) {
      JsonValue value;
      if (!parseValue(value)) { return false; }
      out.arrayValue.push_back(std::move(value));
      skipWs();
      if (pos_ < input_.size() && input_[pos_] == ',') { ++pos_; continue; }
      if (pos_ < input_.size() && input_[pos_] == ']') { ++pos_; return true; }
      return false;
    }
    return false;
  }

  bool parseString(JsonValue& out) {
    if (input_[pos_] != '"') { return false; }
    ++pos_;
    out.kind = JsonKind::String;
    std::string s;
    while (pos_ < input_.size()) {
      char c = input_[pos_++];
      if (c == '"') { out.stringValue = std::move(s); return true; }
      if (c == '\\' && pos_ < input_.size()) {
        char next = input_[pos_++];
        switch (next) {
          case 'n': s += '\n'; break;
          case 't': s += '\t'; break;
          case 'r': s += '\r'; break;
          case '\\': s += '\\'; break;
          case '"': s += '"'; break;
          case '/': s += '/'; break;
          default: s += next; break;
        }
      } else {
        s += c;
      }
    }
    return false;
  }

  bool parseBool(JsonValue& out) {
    if (input_.substr(pos_, 4) == "true") {
      out.kind = JsonKind::Bool;
      out.boolValue = true;
      pos_ += 4;
      return true;
    }
    if (input_.substr(pos_, 5) == "false") {
      out.kind = JsonKind::Bool;
      out.boolValue = false;
      pos_ += 5;
      return true;
    }
    return false;
  }

  bool parseNull(JsonValue& out) {
    if (input_.substr(pos_, 4) == "null") {
      out.kind = JsonKind::Null;
      pos_ += 4;
      return true;
    }
    return false;
  }

  bool parseNumber(JsonValue& out) {
    std::size_t start = pos_;
    if (input_[pos_] == '-') { ++pos_; }
    bool isFloat = false;
    while (pos_ < input_.size()) {
      char c = input_[pos_];
      if (c >= '0' && c <= '9') { ++pos_; continue; }
      if (c == '.' || c == 'e' || c == 'E') { isFloat = true; ++pos_; continue; }
      if (c == '+' || c == '-') { ++pos_; continue; }
      break;
    }
    if (pos_ == start) { return false; }
    std::string s(input_.substr(start, pos_ - start));
    try {
      if (isFloat) { out.kind = JsonKind::Double; out.doubleValue = std::stod(s); }
      else { out.kind = JsonKind::Int; out.intValue = std::stoll(s); }
      return true;
    } catch (...) {
      return false;
    }
  }
};

enum class RuleKind { Primitive, Array, Object };

struct FieldRule {
  std::string name;
  RuleKind kind = RuleKind::Primitive;
  std::string primitiveType;
  std::string elementType;
  std::shared_ptr<SchemaHolder> subSchema;
  bool required = true;
  bool hasMin = false;
  std::int64_t minValue = 0;
  bool hasMax = false;
  std::int64_t maxValue = 0;
  bool hasMinItems = false;
  std::int64_t minItems = 0;
  bool hasMaxItems = false;
  std::int64_t maxItems = 0;
  std::vector<std::string> oneOf;
  bool hasPattern = false;
  std::string pattern;
};

struct SchemaHolder {
  std::vector<FieldRule> rules;
};

struct ValidationData {
  bool ok = false;
  std::string error;
  std::unordered_map<std::string, JsonValue> values;
};

[[maybe_unused]] static bool matchesPrimitive(const JsonValue& value, std::string_view typeKind, std::string& err) {
  if (typeKind == "string") {
    if (value.kind != JsonKind::String) { err = "expected string"; return false; }
    return true;
  }
  if (typeKind == "int" || typeKind == "int64") {
    if (value.kind != JsonKind::Int) { err = "expected integer"; return false; }
    return true;
  }
  if (typeKind == "double" || typeKind == "float" || typeKind == "number") {
    if (value.kind != JsonKind::Double && value.kind != JsonKind::Int) {
      err = "expected number"; return false;
    }
    return true;
  }
  if (typeKind == "bool") {
    if (value.kind != JsonKind::Bool) { err = "expected boolean"; return false; }
    return true;
  }
  err = std::string("unknown primitive type: ") + std::string(typeKind);
  return false;
}

[[maybe_unused]] static bool validateAgainst(
    const SchemaHolder& schema, const JsonValue& root, ValidationData& out, const std::string& pathPrefix);

[[maybe_unused]] static bool applyConstraints(
    const FieldRule& rule, const JsonValue& value, std::string& err, const std::string& fieldPath) {
  if (rule.kind == RuleKind::Primitive) {
    if (rule.primitiveType == "string") {
      auto length = static_cast<std::int64_t>(value.stringValue.size());
      if (rule.hasMin && length < rule.minValue) {
        err = fieldPath + ": length " + std::to_string(length) + " is below min " + std::to_string(rule.minValue);
        return false;
      }
      if (rule.hasMax && length > rule.maxValue) {
        err = fieldPath + ": length " + std::to_string(length) + " exceeds max " + std::to_string(rule.maxValue);
        return false;
      }
      if (!rule.oneOf.empty()) {
        bool match = false;
        for (const auto& candidate : rule.oneOf) {
          if (candidate == value.stringValue) { match = true; break; }
        }
        if (!match) {
          err = fieldPath + ": value not in allowed set";
          return false;
        }
      }
      if (rule.hasPattern) {
        try {
          std::regex re(rule.pattern);
          if (!std::regex_match(value.stringValue, re)) {
            err = fieldPath + ": value does not match pattern";
            return false;
          }
        } catch (...) {
          err = fieldPath + ": invalid pattern";
          return false;
        }
      }
    } else if (rule.primitiveType == "int" || rule.primitiveType == "int64") {
      auto v = value.intValue;
      if (rule.hasMin && v < rule.minValue) {
        err = fieldPath + ": value " + std::to_string(v) + " is below min " + std::to_string(rule.minValue);
        return false;
      }
      if (rule.hasMax && v > rule.maxValue) {
        err = fieldPath + ": value " + std::to_string(v) + " exceeds max " + std::to_string(rule.maxValue);
        return false;
      }
    } else if (rule.primitiveType == "double" || rule.primitiveType == "float" || rule.primitiveType == "number") {
      double v = value.kind == JsonKind::Double ? value.doubleValue : static_cast<double>(value.intValue);
      if (rule.hasMin && v < static_cast<double>(rule.minValue)) {
        err = fieldPath + ": value below min";
        return false;
      }
      if (rule.hasMax && v > static_cast<double>(rule.maxValue)) {
        err = fieldPath + ": value exceeds max";
        return false;
      }
    }
  } else if (rule.kind == RuleKind::Array) {
    auto count = static_cast<std::int64_t>(value.arrayValue.size());
    if (rule.hasMinItems && count < rule.minItems) {
      err = fieldPath + ": " + std::to_string(count) + " items, requires at least " + std::to_string(rule.minItems);
      return false;
    }
    if (rule.hasMaxItems && count > rule.maxItems) {
      err = fieldPath + ": " + std::to_string(count) + " items, allows at most " + std::to_string(rule.maxItems);
      return false;
    }
  }
  return true;
}

[[maybe_unused]] static bool validateField(
    const FieldRule& rule, const JsonValue& value, std::string& err, const std::string& fieldPath) {
  if (rule.kind == RuleKind::Primitive) {
    std::string localErr;
    if (!matchesPrimitive(value, rule.primitiveType, localErr)) {
      err = fieldPath + ": " + localErr;
      return false;
    }
    if (!applyConstraints(rule, value, err, fieldPath)) { return false; }
    return true;
  }
  if (rule.kind == RuleKind::Array) {
    if (value.kind != JsonKind::Array) {
      err = fieldPath + ": expected array";
      return false;
    }
    for (std::size_t index = 0; index < value.arrayValue.size(); ++index) {
      std::string localErr;
      if (!matchesPrimitive(value.arrayValue[index], rule.elementType, localErr)) {
        err = fieldPath + "[" + std::to_string(index) + "]: " + localErr;
        return false;
      }
    }
    if (!applyConstraints(rule, value, err, fieldPath)) { return false; }
    return true;
  }
  if (rule.kind == RuleKind::Object) {
    if (value.kind != JsonKind::Object) {
      err = fieldPath + ": expected object";
      return false;
    }
    ValidationData throwaway;
    if (rule.subSchema && !validateAgainst(*rule.subSchema, value, throwaway, fieldPath)) {
      err = throwaway.error;
      return false;
    }
    return true;
  }
  err = fieldPath + ": unsupported rule";
  return false;
}

[[maybe_unused]] static bool validateAgainst(
    const SchemaHolder& schema, const JsonValue& root, ValidationData& out, const std::string& pathPrefix) {
  if (root.kind != JsonKind::Object) {
    out.error = pathPrefix.empty() ? std::string("root must be an object") : (pathPrefix + ": expected object");
    return false;
  }
  for (const auto& rule : schema.rules) {
    auto entry = root.objectValue.find(rule.name);
    std::string fieldPath = pathPrefix.empty() ? rule.name : pathPrefix + "." + rule.name;
    if (entry == root.objectValue.end()) {
      if (rule.required) {
        out.error = fieldPath + ": missing required field";
        return false;
      }
      continue;
    }
    std::string err;
    if (!validateField(rule, entry->second, err, fieldPath)) {
      out.error = err;
      return false;
    }
    if (pathPrefix.empty()) {
      out.values[rule.name] = entry->second;
    }
  }
  return true;
}

}  // namespace doublemint_schema_detail

ValidationResult::ValidationResult() : data_(std::make_shared<doublemint_schema_detail::ValidationData>()) {}
ValidationResult::ValidationResult(std::shared_ptr<doublemint_schema_detail::ValidationData> data) : data_(std::move(data)) {}

bool ValidationResult::ok() const { return data_ && data_->ok; }
std::string ValidationResult::error() const { return data_ ? data_->error : std::string("uninitialized"); }
bool ValidationResult::has(std::string_view name) const {
  if (!data_) { return false; }
  return data_->values.find(std::string(name)) != data_->values.end();
}

std::string ValidationResult::getString(std::string_view name) const {
  if (!data_) { return std::string(); }
  auto entry = data_->values.find(std::string(name));
  if (entry == data_->values.end()) { return std::string(); }
  if (entry->second.kind == doublemint_schema_detail::JsonKind::String) { return entry->second.stringValue; }
  return std::string();
}

int ValidationResult::getInt(std::string_view name) const {
  return static_cast<int>(getInt64(name));
}

std::int64_t ValidationResult::getInt64(std::string_view name) const {
  if (!data_) { return 0; }
  auto entry = data_->values.find(std::string(name));
  if (entry == data_->values.end()) { return 0; }
  const auto& value = entry->second;
  if (value.kind == doublemint_schema_detail::JsonKind::Int) { return value.intValue; }
  if (value.kind == doublemint_schema_detail::JsonKind::Double) { return static_cast<std::int64_t>(value.doubleValue); }
  return 0;
}

double ValidationResult::getFloat(std::string_view name) const {
  if (!data_) { return 0.0; }
  auto entry = data_->values.find(std::string(name));
  if (entry == data_->values.end()) { return 0.0; }
  const auto& value = entry->second;
  if (value.kind == doublemint_schema_detail::JsonKind::Double) { return value.doubleValue; }
  if (value.kind == doublemint_schema_detail::JsonKind::Int) { return static_cast<double>(value.intValue); }
  return 0.0;
}

bool ValidationResult::getBool(std::string_view name) const {
  if (!data_) { return false; }
  auto entry = data_->values.find(std::string(name));
  if (entry == data_->values.end()) { return false; }
  return entry->second.kind == doublemint_schema_detail::JsonKind::Bool && entry->second.boolValue;
}

Schema::Schema() : holder_(std::make_shared<doublemint_schema_detail::SchemaHolder>()) {}

void Schema::required(std::string_view name, std::string_view typeKind) {
  doublemint_schema_detail::FieldRule rule;
  rule.name = std::string(name);
  rule.kind = doublemint_schema_detail::RuleKind::Primitive;
  rule.primitiveType = std::string(typeKind);
  rule.required = true;
  holder_->rules.push_back(std::move(rule));
}

void Schema::optional(std::string_view name, std::string_view typeKind) {
  doublemint_schema_detail::FieldRule rule;
  rule.name = std::string(name);
  rule.kind = doublemint_schema_detail::RuleKind::Primitive;
  rule.primitiveType = std::string(typeKind);
  rule.required = false;
  holder_->rules.push_back(std::move(rule));
}

void Schema::requiredArray(std::string_view name, std::string_view elementTypeKind) {
  doublemint_schema_detail::FieldRule rule;
  rule.name = std::string(name);
  rule.kind = doublemint_schema_detail::RuleKind::Array;
  rule.elementType = std::string(elementTypeKind);
  rule.required = true;
  holder_->rules.push_back(std::move(rule));
}

void Schema::optionalArray(std::string_view name, std::string_view elementTypeKind) {
  doublemint_schema_detail::FieldRule rule;
  rule.name = std::string(name);
  rule.kind = doublemint_schema_detail::RuleKind::Array;
  rule.elementType = std::string(elementTypeKind);
  rule.required = false;
  holder_->rules.push_back(std::move(rule));
}

void Schema::requiredObject(std::string_view name, const Schema& sub) {
  doublemint_schema_detail::FieldRule rule;
  rule.name = std::string(name);
  rule.kind = doublemint_schema_detail::RuleKind::Object;
  rule.subSchema = sub.holder_;
  rule.required = true;
  holder_->rules.push_back(std::move(rule));
}

void Schema::optionalObject(std::string_view name, const Schema& sub) {
  doublemint_schema_detail::FieldRule rule;
  rule.name = std::string(name);
  rule.kind = doublemint_schema_detail::RuleKind::Object;
  rule.subSchema = sub.holder_;
  rule.required = false;
  holder_->rules.push_back(std::move(rule));
}

namespace doublemint_schema_detail {
[[maybe_unused]] static FieldRule* findRule(SchemaHolder& holder, std::string_view name) {
  for (auto& rule : holder.rules) {
    if (rule.name == name) { return &rule; }
  }
  return nullptr;
}
}  // namespace doublemint_schema_detail

void Schema::min(std::string_view name, std::int64_t value) {
  if (auto* rule = doublemint_schema_detail::findRule(*holder_, name)) {
    rule->hasMin = true;
    rule->minValue = value;
  }
}

void Schema::max(std::string_view name, std::int64_t value) {
  if (auto* rule = doublemint_schema_detail::findRule(*holder_, name)) {
    rule->hasMax = true;
    rule->maxValue = value;
  }
}

void Schema::minItems(std::string_view name, std::int64_t value) {
  if (auto* rule = doublemint_schema_detail::findRule(*holder_, name)) {
    rule->hasMinItems = true;
    rule->minItems = value;
  }
}

void Schema::maxItems(std::string_view name, std::int64_t value) {
  if (auto* rule = doublemint_schema_detail::findRule(*holder_, name)) {
    rule->hasMaxItems = true;
    rule->maxItems = value;
  }
}

void Schema::oneOf(std::string_view name, const std::vector<std::string_view>& options) {
  if (auto* rule = doublemint_schema_detail::findRule(*holder_, name)) {
    rule->oneOf.clear();
    rule->oneOf.reserve(options.size());
    for (auto value : options) { rule->oneOf.emplace_back(value); }
  }
}

void Schema::pattern(std::string_view name, std::string_view regex) {
  if (auto* rule = doublemint_schema_detail::findRule(*holder_, name)) {
    rule->hasPattern = true;
    rule->pattern = std::string(regex);
  }
}

ValidationResult Schema::validate(std::string_view json) const {
  auto data = std::make_shared<doublemint_schema_detail::ValidationData>();
  doublemint_schema_detail::JsonValue root;
  doublemint_schema_detail::JsonParser parser(json);
  if (!parser.parse(root)) {
    data->ok = false;
    data->error = "invalid JSON";
    return ValidationResult(data);
  }
  if (!doublemint_schema_detail::validateAgainst(*holder_, root, *data, std::string())) {
    data->ok = false;
    return ValidationResult(data);
  }
  data->ok = true;
  return ValidationResult(data);
}
