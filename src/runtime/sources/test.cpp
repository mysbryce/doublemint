namespace doublemint_test_detail {

struct TestRegistry {
  int passed = 0;
  int failed = 0;
  std::vector<std::string> failures;
  std::string currentTest;
};

[[maybe_unused]] static TestRegistry& registry() {
  static TestRegistry instance;
  return instance;
}

}  // namespace doublemint_test_detail

[[maybe_unused]] static void __doublemint_test_run(std::string_view name, const std::function<void()>& body) {
  auto& reg = doublemint_test_detail::registry();
  reg.currentTest = std::string(name);
  int failuresBefore = reg.failed;
  std::cout << "  " << name << " ... " << std::flush;
  try {
    body();
  } catch (const std::exception& e) {
    reg.failed += 1;
    reg.failures.push_back(std::string(name) + ": threw " + e.what());
    std::cout << "FAIL (threw)" << std::endl;
    reg.currentTest.clear();
    return;
  } catch (...) {
    reg.failed += 1;
    reg.failures.push_back(std::string(name) + ": threw unknown");
    std::cout << "FAIL (threw)" << std::endl;
    reg.currentTest.clear();
    return;
  }
  if (reg.failed > failuresBefore) {
    std::cout << "FAIL" << std::endl;
  } else {
    reg.passed += 1;
    std::cout << "ok" << std::endl;
  }
  reg.currentTest.clear();
}

[[maybe_unused]] static void __doublemint_test_expect_true(bool value, std::string_view label) {
  auto& reg = doublemint_test_detail::registry();
  if (!value) {
    reg.failed += 1;
    reg.failures.push_back(reg.currentTest + ": expected true (" + std::string(label) + ")");
  }
}

[[maybe_unused]] static void __doublemint_test_expect_int(int actual, int expected, std::string_view label) {
  auto& reg = doublemint_test_detail::registry();
  if (actual != expected) {
    reg.failed += 1;
    reg.failures.push_back(reg.currentTest + ": expected " + std::to_string(expected) + " got " + std::to_string(actual) + " (" + std::string(label) + ")");
  }
}

[[maybe_unused]] static void __doublemint_test_expect_string(std::string_view actual, std::string_view expected, std::string_view label) {
  auto& reg = doublemint_test_detail::registry();
  if (actual != expected) {
    reg.failed += 1;
    reg.failures.push_back(reg.currentTest + ": expected \"" + std::string(expected) + "\" got \"" + std::string(actual) + "\" (" + std::string(label) + ")");
  }
}

[[maybe_unused]] static void __doublemint_test_expect_bool(bool actual, bool expected, std::string_view label) {
  auto& reg = doublemint_test_detail::registry();
  if (actual != expected) {
    reg.failed += 1;
    reg.failures.push_back(reg.currentTest + ": expected " + (expected ? "true" : "false") + " got " + (actual ? "true" : "false") + " (" + std::string(label) + ")");
  }
}

[[maybe_unused]] static int __doublemint_test_report() {
  auto& reg = doublemint_test_detail::registry();
  std::cout << std::endl;
  for (const auto& failure : reg.failures) { std::cout << "  - " << failure << std::endl; }
  std::cout << reg.passed << " passed, " << reg.failed << " failed" << std::endl;
  return reg.failed == 0 ? 0 : 1;
}

[[maybe_unused]] static int __doublemint_test_passed() { return doublemint_test_detail::registry().passed; }
[[maybe_unused]] static int __doublemint_test_failed() { return doublemint_test_detail::registry().failed; }
