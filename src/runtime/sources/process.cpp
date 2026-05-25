#ifdef _WIN32
#include <windows.h>
#include <tlhelp32.h>
#endif

namespace doublemint_process_detail {

struct PatternByte {
  unsigned char value;
  bool wildcard;
};

[[maybe_unused]] static std::vector<PatternByte> parsePattern(std::string_view pattern) {
  std::vector<PatternByte> bytes;
  std::size_t index = 0;
  while (index < pattern.size()) {
    while (index < pattern.size() && (pattern[index] == ' ' || pattern[index] == '\t')) { ++index; }
    if (index >= pattern.size()) { break; }
    std::size_t end = index;
    while (end < pattern.size() && pattern[end] != ' ' && pattern[end] != '\t') { ++end; }
    std::string token(pattern.substr(index, end - index));
    if (token == "?" || token == "??") {
      bytes.push_back({0, true});
    } else if (token.size() == 2) {
      try {
        unsigned long value = std::stoul(token, nullptr, 16);
        bytes.push_back({static_cast<unsigned char>(value & 0xff), false});
      } catch (...) {
        bytes.clear();
        return bytes;
      }
    } else {
      bytes.clear();
      return bytes;
    }
    index = end;
  }
  return bytes;
}

[[maybe_unused]] static std::int64_t scanBuffer(
    const std::vector<unsigned char>& buffer,
    const std::vector<PatternByte>& pattern,
    std::int64_t base) {
  if (pattern.empty() || buffer.size() < pattern.size()) { return 0; }
  std::size_t limit = buffer.size() - pattern.size();
  for (std::size_t offset = 0; offset <= limit; ++offset) {
    bool match = true;
    for (std::size_t k = 0; k < pattern.size(); ++k) {
      if (!pattern[k].wildcard && buffer[offset + k] != pattern[k].value) { match = false; break; }
    }
    if (match) { return base + static_cast<std::int64_t>(offset); }
  }
  return 0;
}

#ifdef _WIN32
[[maybe_unused]] static DWORD pidFromHandle(HANDLE handle) {
  DWORD pid = ::GetProcessId(handle);
  return pid;
}
#endif

}  // namespace doublemint_process_detail

[[maybe_unused]] static std::int64_t __doublemint_process_open_by_pid(int pid) {
#ifdef _WIN32
  HANDLE handle = ::OpenProcess(PROCESS_ALL_ACCESS, FALSE, static_cast<DWORD>(pid));
  return handle == nullptr ? 0 : static_cast<std::int64_t>(reinterpret_cast<std::uintptr_t>(handle));
#else
  (void)pid;
  return 0;
#endif
}

[[maybe_unused]] static std::int64_t __doublemint_process_open_by_name(const std::string& name) {
#ifdef _WIN32
  HANDLE snapshot = ::CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) { return 0; }
  PROCESSENTRY32 entry{};
  entry.dwSize = sizeof(entry);
  DWORD pid = 0;
  if (::Process32First(snapshot, &entry)) {
    do {
      if (_stricmp(entry.szExeFile, name.c_str()) == 0) { pid = entry.th32ProcessID; break; }
    } while (::Process32Next(snapshot, &entry));
  }
  ::CloseHandle(snapshot);
  if (pid == 0) { return 0; }
  HANDLE handle = ::OpenProcess(PROCESS_ALL_ACCESS, FALSE, pid);
  return handle == nullptr ? 0 : static_cast<std::int64_t>(reinterpret_cast<std::uintptr_t>(handle));
#else
  (void)name;
  return 0;
#endif
}

[[maybe_unused]] static void __doublemint_process_close(std::int64_t handle) {
#ifdef _WIN32
  if (handle == 0) { return; }
  ::CloseHandle(reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)));
#else
  (void)handle;
#endif
}

[[maybe_unused]] static std::vector<int> __doublemint_process_read_bytes(
    std::int64_t handle, std::int64_t address, int size) {
  std::vector<int> result;
  if (handle == 0 || size <= 0) { return result; }
#ifdef _WIN32
  std::vector<unsigned char> buffer(static_cast<std::size_t>(size), 0);
  SIZE_T bytesRead = 0;
  BOOL ok = ::ReadProcessMemory(
      reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)),
      reinterpret_cast<LPCVOID>(static_cast<std::uintptr_t>(address)),
      buffer.data(),
      static_cast<SIZE_T>(size),
      &bytesRead);
  if (!ok) { return result; }
  result.reserve(bytesRead);
  for (SIZE_T index = 0; index < bytesRead; ++index) { result.push_back(static_cast<int>(buffer[index])); }
#else
  (void)address;
#endif
  return result;
}

[[maybe_unused]] static int __doublemint_process_read_int(std::int64_t handle, std::int64_t address) {
#ifdef _WIN32
  if (handle == 0) { return 0; }
  int value = 0;
  SIZE_T bytesRead = 0;
  ::ReadProcessMemory(
      reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)),
      reinterpret_cast<LPCVOID>(static_cast<std::uintptr_t>(address)),
      &value, sizeof(value), &bytesRead);
  return bytesRead == sizeof(value) ? value : 0;
#else
  (void)handle;
  (void)address;
  return 0;
#endif
}

[[maybe_unused]] static std::int64_t __doublemint_process_read_int64(std::int64_t handle, std::int64_t address) {
#ifdef _WIN32
  if (handle == 0) { return 0; }
  std::int64_t value = 0;
  SIZE_T bytesRead = 0;
  ::ReadProcessMemory(
      reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)),
      reinterpret_cast<LPCVOID>(static_cast<std::uintptr_t>(address)),
      &value, sizeof(value), &bytesRead);
  return bytesRead == sizeof(value) ? value : 0;
#else
  (void)handle;
  (void)address;
  return 0;
#endif
}

[[maybe_unused]] static bool __doublemint_process_write_bytes(
    std::int64_t handle, std::int64_t address, const std::vector<int>& data) {
#ifdef _WIN32
  if (handle == 0 || data.empty()) { return false; }
  std::vector<unsigned char> buffer(data.size());
  for (std::size_t index = 0; index < data.size(); ++index) {
    buffer[index] = static_cast<unsigned char>(data[index] & 0xff);
  }
  SIZE_T written = 0;
  BOOL ok = ::WriteProcessMemory(
      reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)),
      reinterpret_cast<LPVOID>(static_cast<std::uintptr_t>(address)),
      buffer.data(), buffer.size(), &written);
  return ok != 0 && written == buffer.size();
#else
  (void)handle;
  (void)address;
  (void)data;
  return false;
#endif
}

[[maybe_unused]] static bool __doublemint_process_write_int(std::int64_t handle, std::int64_t address, int value) {
#ifdef _WIN32
  if (handle == 0) { return false; }
  SIZE_T written = 0;
  BOOL ok = ::WriteProcessMemory(
      reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)),
      reinterpret_cast<LPVOID>(static_cast<std::uintptr_t>(address)),
      &value, sizeof(value), &written);
  return ok != 0 && written == sizeof(value);
#else
  (void)handle;
  (void)address;
  (void)value;
  return false;
#endif
}

[[maybe_unused]] static bool __doublemint_process_write_int64(std::int64_t handle, std::int64_t address, std::int64_t value) {
#ifdef _WIN32
  if (handle == 0) { return false; }
  SIZE_T written = 0;
  BOOL ok = ::WriteProcessMemory(
      reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)),
      reinterpret_cast<LPVOID>(static_cast<std::uintptr_t>(address)),
      &value, sizeof(value), &written);
  return ok != 0 && written == sizeof(value);
#else
  (void)handle;
  (void)address;
  (void)value;
  return false;
#endif
}

[[maybe_unused]] static std::int64_t __doublemint_process_find_module(std::int64_t handle, const std::string& name) {
#ifdef _WIN32
  if (handle == 0) { return 0; }
  DWORD pid = doublemint_process_detail::pidFromHandle(reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)));
  if (pid == 0) { return 0; }
  HANDLE snapshot = ::CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid);
  if (snapshot == INVALID_HANDLE_VALUE) { return 0; }
  MODULEENTRY32 entry{};
  entry.dwSize = sizeof(entry);
  std::int64_t base = 0;
  if (::Module32First(snapshot, &entry)) {
    do {
      if (_stricmp(entry.szModule, name.c_str()) == 0) {
        base = static_cast<std::int64_t>(reinterpret_cast<std::uintptr_t>(entry.modBaseAddr));
        break;
      }
    } while (::Module32Next(snapshot, &entry));
  }
  ::CloseHandle(snapshot);
  return base;
#else
  (void)handle;
  (void)name;
  return 0;
#endif
}

[[maybe_unused]] static int __doublemint_process_module_size(std::int64_t handle, const std::string& name) {
#ifdef _WIN32
  if (handle == 0) { return 0; }
  DWORD pid = doublemint_process_detail::pidFromHandle(reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)));
  if (pid == 0) { return 0; }
  HANDLE snapshot = ::CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid);
  if (snapshot == INVALID_HANDLE_VALUE) { return 0; }
  MODULEENTRY32 entry{};
  entry.dwSize = sizeof(entry);
  int size = 0;
  if (::Module32First(snapshot, &entry)) {
    do {
      if (_stricmp(entry.szModule, name.c_str()) == 0) {
        size = static_cast<int>(entry.modBaseSize);
        break;
      }
    } while (::Module32Next(snapshot, &entry));
  }
  ::CloseHandle(snapshot);
  return size;
#else
  (void)handle;
  (void)name;
  return 0;
#endif
}

[[maybe_unused]] static std::int64_t __doublemint_process_aob_scan_module(
    std::int64_t handle, const std::string& moduleName, const std::string& pattern) {
#ifdef _WIN32
  if (handle == 0) { return 0; }
  std::int64_t base = __doublemint_process_find_module(handle, moduleName);
  int size = __doublemint_process_module_size(handle, moduleName);
  if (base == 0 || size <= 0) { return 0; }
  std::vector<unsigned char> buffer(static_cast<std::size_t>(size), 0);
  SIZE_T bytesRead = 0;
  if (!::ReadProcessMemory(
          reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle)),
          reinterpret_cast<LPCVOID>(static_cast<std::uintptr_t>(base)),
          buffer.data(), buffer.size(), &bytesRead)) {
    return 0;
  }
  buffer.resize(bytesRead);
  auto parsed = doublemint_process_detail::parsePattern(pattern);
  return doublemint_process_detail::scanBuffer(buffer, parsed, base);
#else
  (void)handle;
  (void)moduleName;
  (void)pattern;
  return 0;
#endif
}

[[maybe_unused]] static std::int64_t __doublemint_process_aob_scan(std::int64_t handle, const std::string& pattern) {
#ifdef _WIN32
  if (handle == 0) { return 0; }
  auto parsed = doublemint_process_detail::parsePattern(pattern);
  if (parsed.empty()) { return 0; }
  HANDLE winHandle = reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(handle));
  SYSTEM_INFO sysInfo{};
  ::GetSystemInfo(&sysInfo);
  std::uintptr_t address = reinterpret_cast<std::uintptr_t>(sysInfo.lpMinimumApplicationAddress);
  std::uintptr_t end = reinterpret_cast<std::uintptr_t>(sysInfo.lpMaximumApplicationAddress);
  std::vector<unsigned char> buffer;
  while (address < end) {
    MEMORY_BASIC_INFORMATION info{};
    SIZE_T queried = ::VirtualQueryEx(winHandle, reinterpret_cast<LPCVOID>(address), &info, sizeof(info));
    if (queried == 0) { break; }
    bool readable = info.State == MEM_COMMIT
        && (info.Protect & (PAGE_EXECUTE_READ | PAGE_EXECUTE_READWRITE | PAGE_READONLY | PAGE_READWRITE | PAGE_EXECUTE_WRITECOPY | PAGE_WRITECOPY)) != 0
        && (info.Protect & PAGE_GUARD) == 0;
    if (readable) {
      buffer.assign(info.RegionSize, 0);
      SIZE_T bytesRead = 0;
      if (::ReadProcessMemory(winHandle, info.BaseAddress, buffer.data(), info.RegionSize, &bytesRead)) {
        buffer.resize(bytesRead);
        std::int64_t base = static_cast<std::int64_t>(reinterpret_cast<std::uintptr_t>(info.BaseAddress));
        std::int64_t hit = doublemint_process_detail::scanBuffer(buffer, parsed, base);
        if (hit != 0) { return hit; }
      }
    }
    address = reinterpret_cast<std::uintptr_t>(info.BaseAddress) + info.RegionSize;
  }
  return 0;
#else
  (void)handle;
  (void)pattern;
  return 0;
#endif
}

[[maybe_unused]] static std::int64_t __doublemint_process_pointer_chain(
    std::int64_t handle, std::int64_t base, const std::vector<int>& offsets) {
#ifdef _WIN32
  if (handle == 0 || base == 0) { return 0; }
  std::int64_t current = base;
  for (std::size_t index = 0; index + 1 < offsets.size(); ++index) {
    current = __doublemint_process_read_int64(handle, current + offsets[index]);
    if (current == 0) { return 0; }
  }
  if (offsets.empty()) { return current; }
  return current + offsets.back();
#else
  (void)handle;
  (void)base;
  (void)offsets;
  return 0;
#endif
}
