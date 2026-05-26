import type { SourceLocation } from "../lexer/token.js";
import type { Program, TypeNode } from "../parser/ast.js";
import type {
  BuiltinClassMethod,
  BuiltinNamespaceMember,
  ModuleExport,
  ResolvedModule
} from "../resolver/moduleGraph.js";

const builtinLocation: SourceLocation = {
  filepath: "<builtin>",
  line: 1,
  column: 1,
  offset: 0,
  sourceLine: ""
};

const emptyProgram = (filepath: string): Program => ({
  type: "Program",
  sourceFile: filepath,
  body: []
});

const namedType = (name: string): TypeNode => ({
  type: "NamedType",
  name,
  location: builtinLocation
});

const arrayType = (elementType: TypeNode): TypeNode => ({
  type: "ArrayType",
  elementType,
  location: builtinLocation
});

const functionType = (params: TypeNode[], returnType: TypeNode): TypeNode => ({
  type: "FunctionType",
  params,
  returnType,
  location: builtinLocation
});

const namespaceExport = (
  name: string,
  members: BuiltinNamespaceMember[]
): ModuleExport => ({
  name,
  kind: "value",
  builtin: true,
  namespaceMembers: new Map(members.map((member) => [member.name, member])),
  location: builtinLocation
});

const functionMember = (
  name: string,
  params: TypeNode[],
  returnType: TypeNode,
  nativeName: string
): BuiltinNamespaceMember => ({
  name,
  kind: "function",
  params,
  returnType,
  nativeName,
  location: builtinLocation
});

const valueMember = (
  name: string,
  valueType: TypeNode,
  nativeName: string
): BuiltinNamespaceMember => ({
  name,
  kind: "value",
  valueType,
  nativeName,
  location: builtinLocation
});

const topLevelFunctionExport = (
  name: string,
  params: TypeNode[],
  returnType: TypeNode,
  nativeName: string
): ModuleExport => ({
  name,
  kind: "value",
  builtin: true,
  functionType: { params, returnType },
  nativeName,
  location: builtinLocation
});

const classExport = (name: string, methods: BuiltinClassMethod[] = []): ModuleExport => ({
  name,
  kind: "value",
  builtin: true,
  classMethods: new Map(methods.map((method) => [method.name, method])),
  location: builtinLocation
});

const method = (
  name: string,
  params: TypeNode[],
  returnType: TypeNode
): BuiltinClassMethod => ({
  name,
  params,
  returnType,
  location: builtinLocation
});

const property = (name: string, returnType: TypeNode): BuiltinClassMethod => ({
  name,
  params: [],
  returnType,
  property: true,
  location: builtinLocation
});

const builtinModules = new Map<string, Omit<ResolvedModule, "filepath">>([
  [
    "mint:fs",
    {
      builtin: true,
      builtinIncludes: ["<filesystem>", "<fstream>", "<iterator>", "<string>", "<vector>"],
      program: emptyProgram("mint:fs"),
      imports: [],
      exports: new Map([
        [
          "File",
          namespaceExport("File", [
            functionMember("exists", [namedType("string")], namedType("bool"), "std::filesystem::exists"),
            functionMember("readToString", [namedType("string")], namedType("string"), "__doublemint_file_read_to_string"),
            functionMember("readToBytes", [namedType("string")], arrayType(namedType("int")), "__doublemint_file_read_to_bytes"),
            functionMember("writeString", [namedType("string"), namedType("string")], namedType("void"), "__doublemint_file_write_string"),
            functionMember("appendString", [namedType("string"), namedType("string")], namedType("void"), "__doublemint_file_append_string")
          ])
        ],
        [
          "Path",
          namespaceExport("Path", [
            functionMember("join", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_path_join"),
            functionMember("basename", [namedType("string")], namedType("string"), "__doublemint_path_basename")
          ])
        ]
      ])
    }
  ],
  [
    "mint:math",
    {
      builtin: true,
      builtinIncludes: ["<cmath>", "<numbers>"],
      program: emptyProgram("mint:math"),
      imports: [],
      exports: new Map([
        [
          "Math",
          namespaceExport("Math", [
            valueMember("PI", namedType("double"), "std::numbers::pi"),
            functionMember("sin", [namedType("double")], namedType("double"), "std::sin"),
            functionMember("sqrt", [namedType("double")], namedType("double"), "std::sqrt"),
            functionMember(
              "pow",
              [namedType("double"), namedType("double")],
              namedType("double"),
              "std::pow"
            ),
            functionMember(
              "roundToInt",
              [namedType("double")],
              namedType("int"),
              "std::lround"
            )
          ])
        ]
      ])
    }
  ],
  [
    "mint:time",
    {
      builtin: true,
      builtinIncludes: ["<chrono>", "<string>", "<unordered_map>"],
      program: emptyProgram("mint:time"),
      imports: [],
      exports: new Map([
        [
          "Time",
          namespaceExport("Time", [
            functionMember("nowInMs", [], namedType("int"), "__doublemint_now_ms")
          ])
        ],
        [
          "Profiler",
          namespaceExport("Profiler", [
            functionMember("start", [namedType("string")], namedType("void"), "__doublemint_profiler_start"),
            functionMember("stop", [namedType("string")], namedType("int"), "__doublemint_profiler_stop")
          ])
        ]
      ])
    }
  ],
  [
    "mint:collections",
    {
      builtin: true,
      builtinIncludes: ["<queue>", "<stack>", "<stdexcept>", "<unordered_set>"],
      program: emptyProgram("mint:collections"),
      imports: [],
      exports: new Map([
        ["Queue", classExport("Queue", [method("push", [namedType("T")], namedType("void")), method("pop", [], namedType("T")), method("empty", [], namedType("bool")), method("size", [], namedType("int"))])],
        ["Set", classExport("Set", [method("add", [namedType("T")], namedType("void")), method("has", [namedType("T")], namedType("bool")), method("size", [], namedType("int"))])],
        ["Stack", classExport("Stack", [method("push", [namedType("T")], namedType("void")), method("pop", [], namedType("T")), method("empty", [], namedType("bool")), method("size", [], namedType("int"))])]
      ])
    }
  ],
  [
    "mint:os",
    {
      builtin: true,
      builtinIncludes: ["<array>", "<cstdlib>", "<cstdio>", "<memory>", "<string>"],
      program: emptyProgram("mint:os"),
      imports: [],
      exports: new Map([
        [
          "OS",
          namespaceExport("OS", [
            functionMember("isLinux", [], namedType("bool"), "__doublemint_os_is_linux"),
            functionMember("isWindows", [], namedType("bool"), "__doublemint_os_is_windows"),
            functionMember("execute", [namedType("string")], namedType("string"), "__doublemint_os_execute")
          ])
        ],
        [
          "Env",
          namespaceExport("Env", [
            functionMember("get", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_env_get")
          ])
        ]
      ])
    }
  ],
  [
    "mint:regex",
    {
      builtin: true,
      builtinIncludes: ["<regex>", "<string>", "<string_view>"],
      program: emptyProgram("mint:regex"),
      imports: [],
      exports: new Map([
        ["Regex", classExport("Regex", [method("test", [namedType("string")], namedType("bool")), method("replace", [namedType("string"), namedType("string")], namedType("string"))])]
      ])
    }
  ],
  [
    "mint:io",
    {
      builtin: true,
      builtinIncludes: ["<iostream>", "<string>", "<string_view>"],
      program: emptyProgram("mint:io"),
      imports: [],
      exports: new Map([
        [
          "IO",
          namespaceExport("IO", [
            functionMember("readLine", [namedType("string")], namedType("string"), "__doublemint_read_line")
          ])
        ],
        ["print", topLevelFunctionExport("print", [], namedType("void"), "__doublemint_print")],
        ["println", topLevelFunctionExport("println", [], namedType("void"), "__doublemint_println")]
      ])
    }
  ],
  [
    "mint:json",
    {
      builtin: true,
      builtinIncludes: ["<cstdlib>", "<sstream>", "<string>", "<string_view>"],
      program: emptyProgram("mint:json"),
      imports: [],
      exports: new Map([
        [
          "Json",
          namespaceExport("Json", [
            functionMember("stringify", [namedType("string")], namedType("string"), "__doublemint_json_stringify"),
            functionMember("stringifyInt", [namedType("int")], namedType("string"), "__doublemint_json_stringify_int"),
            functionMember("stringifyBool", [namedType("bool")], namedType("string"), "__doublemint_json_stringify_bool"),
            functionMember("parseInt", [namedType("string")], namedType("int"), "__doublemint_json_parse_int"),
            functionMember("parseString", [namedType("string")], namedType("string"), "__doublemint_json_parse_string")
          ])
        ]
      ])
    }
  ],
  [
    "mint:log",
    {
      builtin: true,
      builtinIncludes: ["<iostream>", "<string>", "<string_view>"],
      program: emptyProgram("mint:log"),
      imports: [],
      exports: new Map([
        [
          "Log",
          namespaceExport("Log", [
            functionMember("info", [namedType("string")], namedType("void"), "__doublemint_log_info"),
            functionMember("warn", [namedType("string")], namedType("void"), "__doublemint_log_warn"),
            functionMember("error", [namedType("string")], namedType("void"), "__doublemint_log_error"),
            functionMember("debug", [namedType("string")], namedType("void"), "__doublemint_log_debug")
          ])
        ]
      ])
    }
  ],
  [
    "mint:crypto",
    {
      builtin: true,
      builtinIncludes: ["<cstdint>", "<iomanip>", "<sstream>", "<string>", "<string_view>"],
      program: emptyProgram("mint:crypto"),
      imports: [],
      exports: new Map([
        [
          "Crypto",
          namespaceExport("Crypto", [
            functionMember("hashFnv1a", [namedType("string")], namedType("int"), "__doublemint_crypto_fnv1a"),
            functionMember("xorCipher", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_crypto_xor"),
            functionMember("toHex", [namedType("int")], namedType("string"), "__doublemint_crypto_to_hex")
          ])
        ]
      ])
    }
  ],
  [
    "mint:net",
    {
      builtin: true,
      builtinIncludes: ["<sstream>", "<string>", "<string_view>"],
      program: emptyProgram("mint:net"),
      imports: [],
      exports: new Map([
        [
          "Url",
          namespaceExport("Url", [
            functionMember("scheme", [namedType("string")], namedType("string"), "__doublemint_url_scheme"),
            functionMember("host", [namedType("string")], namedType("string"), "__doublemint_url_host"),
            functionMember("path", [namedType("string")], namedType("string"), "__doublemint_url_path"),
            functionMember("encodeComponent", [namedType("string")], namedType("string"), "__doublemint_url_encode")
          ])
        ],
        [
          "Http",
          namespaceExport("Http", [
            functionMember("buildGet", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_http_build_get")
          ])
        ]
      ])
    }
  ],
  [
    "mint:async",
    {
      builtin: true,
      builtinIncludes: [
        "<algorithm>",
        "<atomic>",
        "<chrono>",
        "<condition_variable>",
        "<cstddef>",
        "<cstdint>",
        "<functional>",
        "<memory>",
        "<mutex>",
        "<numeric>",
        "<queue>",
        "<string>",
        "<thread>",
        "<unordered_map>",
        "<utility>",
        "<vector>"
      ],
      program: emptyProgram("mint:async"),
      imports: [],
      exports: new Map([
        [
          "Async",
          namespaceExport("Async", [
            functionMember("sleepMs", [namedType("int")], namedType("void"), "__doublemint_async_sleep_ms"),
            functionMember("parallelSum", [arrayType(namedType("int"))], namedType("int"), "__doublemint_async_parallel_sum"),
            functionMember("parallelMax", [arrayType(namedType("int"))], namedType("int"), "__doublemint_async_parallel_max"),
            functionMember("parallelMin", [arrayType(namedType("int"))], namedType("int"), "__doublemint_async_parallel_min"),
            functionMember("hardwareThreads", [], namedType("int"), "__doublemint_async_hardware_threads"),
            functionMember("spawn", [functionType([], namedType("void"))], namedType("int"), "__doublemint_async_spawn"),
            functionMember("join", [namedType("int")], namedType("void"), "__doublemint_async_join"),
            functionMember("detach", [namedType("int")], namedType("void"), "__doublemint_async_detach"),
            functionMember("parallelFor", [namedType("int"), functionType([namedType("int")], namedType("void"))], namedType("void"), "__doublemint_async_parallel_for"),
            functionMember("createMutex", [], namedType("int"), "__doublemint_async_mutex_create"),
            functionMember("lock", [namedType("int")], namedType("void"), "__doublemint_async_mutex_lock"),
            functionMember("unlock", [namedType("int")], namedType("void"), "__doublemint_async_mutex_unlock"),
            functionMember("tryLock", [namedType("int")], namedType("bool"), "__doublemint_async_mutex_try_lock"),
            functionMember("destroyMutex", [namedType("int")], namedType("void"), "__doublemint_async_mutex_destroy"),
            functionMember("createAtomic", [namedType("int64")], namedType("int"), "__doublemint_async_atomic_create"),
            functionMember("atomicLoad", [namedType("int")], namedType("int64"), "__doublemint_async_atomic_load"),
            functionMember("atomicStore", [namedType("int"), namedType("int64")], namedType("void"), "__doublemint_async_atomic_store"),
            functionMember("atomicAdd", [namedType("int"), namedType("int64")], namedType("int64"), "__doublemint_async_atomic_add"),
            functionMember("atomicCas", [namedType("int"), namedType("int64"), namedType("int64")], namedType("bool"), "__doublemint_async_atomic_cas"),
            functionMember("destroyAtomic", [namedType("int")], namedType("void"), "__doublemint_async_atomic_destroy"),
            functionMember("createChannel", [], namedType("int"), "__doublemint_async_channel_create"),
            functionMember("channelSend", [namedType("int"), namedType("string")], namedType("void"), "__doublemint_async_channel_send"),
            functionMember("channelReceive", [namedType("int")], namedType("string"), "__doublemint_async_channel_receive"),
            functionMember("channelTryReceive", [namedType("int")], namedType("string"), "__doublemint_async_channel_try_receive"),
            functionMember("channelClose", [namedType("int")], namedType("void"), "__doublemint_async_channel_close"),
            functionMember("destroyChannel", [namedType("int")], namedType("void"), "__doublemint_async_channel_destroy")
          ])
        ]
      ])
    }
  ],
  [
    "mint:memory",
    {
      builtin: true,
      builtinIncludes: ["<atomic>", "<cstdint>"],
      program: emptyProgram("mint:memory"),
      imports: [],
      exports: new Map([
        [
          "Memory",
          namespaceExport("Memory", [
            functionMember("recordAlloc", [namedType("int")], namedType("void"), "__doublemint_memory_record_alloc"),
            functionMember("recordFree", [namedType("int")], namedType("void"), "__doublemint_memory_record_free"),
            functionMember("bytesUsed", [], namedType("int"), "__doublemint_memory_bytes_used"),
            functionMember("peakBytes", [], namedType("int"), "__doublemint_memory_peak_bytes"),
            functionMember("reset", [], namedType("void"), "__doublemint_memory_reset")
          ])
        ]
      ])
    }
  ],
  [
    "mint:simd",
    {
      builtin: true,
      builtinIncludes: ["<algorithm>", "<cstddef>", "<numeric>", "<vector>"],
      program: emptyProgram("mint:simd"),
      imports: [],
      exports: new Map([
        [
          "Simd",
          namespaceExport("Simd", [
            functionMember("addArrays", [arrayType(namedType("int")), arrayType(namedType("int"))], arrayType(namedType("int")), "__doublemint_simd_add"),
            functionMember("scaleArray", [arrayType(namedType("int")), namedType("int")], arrayType(namedType("int")), "__doublemint_simd_scale"),
            functionMember("dotProduct", [arrayType(namedType("int")), arrayType(namedType("int"))], namedType("int"), "__doublemint_simd_dot"),
            functionMember("sum", [arrayType(namedType("int"))], namedType("int"), "__doublemint_simd_sum")
          ])
        ]
      ])
    }
  ],
  [
    "mint:db",
    {
      builtin: true,
      builtinIncludes: ["<string>", "<string_view>", "<unordered_map>"],
      program: emptyProgram("mint:db"),
      imports: [],
      exports: new Map([
        [
          "KV",
          namespaceExport("KV", [
            functionMember("set", [namedType("string"), namedType("string")], namedType("void"), "__doublemint_kv_set"),
            functionMember("get", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_kv_get"),
            functionMember("has", [namedType("string")], namedType("bool"), "__doublemint_kv_has"),
            functionMember("remove", [namedType("string")], namedType("void"), "__doublemint_kv_remove"),
            functionMember("size", [], namedType("int"), "__doublemint_kv_size"),
            functionMember("clear", [], namedType("void"), "__doublemint_kv_clear")
          ])
        ]
      ])
    }
  ],
  [
    "mint:term",
    {
      builtin: true,
      builtinIncludes: ["<iostream>", "<sstream>", "<string>", "<string_view>"],
      program: emptyProgram("mint:term"),
      imports: [],
      exports: new Map([
        [
          "Terminal",
          namespaceExport("Terminal", [
            functionMember("clear", [], namedType("void"), "__doublemint_term_clear"),
            functionMember("moveCursor", [namedType("int"), namedType("int")], namedType("void"), "__doublemint_term_move_cursor"),
            functionMember("setColor", [namedType("int")], namedType("void"), "__doublemint_term_set_color"),
            functionMember("resetColor", [], namedType("void"), "__doublemint_term_reset_color"),
            functionMember("bold", [namedType("string")], namedType("string"), "__doublemint_term_bold"),
            functionMember("colorize", [namedType("string"), namedType("int")], namedType("string"), "__doublemint_term_colorize")
          ])
        ]
      ])
    }
  ],
  [
    "mint:process",
    {
      builtin: true,
      builtinIncludes: ["<cstdint>", "<string>", "<vector>"],
      program: emptyProgram("mint:process"),
      imports: [],
      exports: new Map([
        [
          "Process",
          namespaceExport("Process", [
            functionMember("openByName", [namedType("string")], namedType("int64"), "__doublemint_process_open_by_name"),
            functionMember("openByPid", [namedType("int")], namedType("int64"), "__doublemint_process_open_by_pid"),
            functionMember("close", [namedType("int64")], namedType("void"), "__doublemint_process_close"),
            functionMember("readBytes", [namedType("int64"), namedType("int64"), namedType("int")], arrayType(namedType("int")), "__doublemint_process_read_bytes"),
            functionMember("readInt", [namedType("int64"), namedType("int64")], namedType("int"), "__doublemint_process_read_int"),
            functionMember("readInt64", [namedType("int64"), namedType("int64")], namedType("int64"), "__doublemint_process_read_int64"),
            functionMember("writeBytes", [namedType("int64"), namedType("int64"), arrayType(namedType("int"))], namedType("bool"), "__doublemint_process_write_bytes"),
            functionMember("writeInt", [namedType("int64"), namedType("int64"), namedType("int")], namedType("bool"), "__doublemint_process_write_int"),
            functionMember("writeInt64", [namedType("int64"), namedType("int64"), namedType("int64")], namedType("bool"), "__doublemint_process_write_int64"),
            functionMember("findModule", [namedType("int64"), namedType("string")], namedType("int64"), "__doublemint_process_find_module"),
            functionMember("moduleSize", [namedType("int64"), namedType("string")], namedType("int"), "__doublemint_process_module_size"),
            functionMember("aobScan", [namedType("int64"), namedType("string")], namedType("int64"), "__doublemint_process_aob_scan"),
            functionMember("aobScanModule", [namedType("int64"), namedType("string"), namedType("string")], namedType("int64"), "__doublemint_process_aob_scan_module"),
            functionMember("pointerChain", [namedType("int64"), namedType("int64"), arrayType(namedType("int"))], namedType("int64"), "__doublemint_process_pointer_chain"),
            functionMember("findWindowByClass", [namedType("string")], namedType("int64"), "__doublemint_process_find_window_by_class"),
            functionMember("findWindowByTitle", [namedType("string")], namedType("int64"), "__doublemint_process_find_window_by_title"),
            functionMember("findChildWindow", [namedType("int64"), namedType("string")], namedType("int64"), "__doublemint_process_find_child_window"),
            functionMember("getWindowText", [namedType("int64")], namedType("string"), "__doublemint_process_get_window_text")
          ])
        ]
      ])
    }
  ],
  [
    "mint:schema",
    {
      builtin: true,
      builtinIncludes: [
        "<cstdint>",
        "<memory>",
        "<regex>",
        "<string>",
        "<string_view>",
        "<unordered_map>",
        "<vector>"
      ],
      program: emptyProgram("mint:schema"),
      imports: [],
      exports: new Map([
        [
          "ValidationResult",
          classExport("ValidationResult", [
            property("ok", namedType("bool")),
            property("error", namedType("string")),
            method("has", [namedType("string")], namedType("bool")),
            method("getString", [namedType("string")], namedType("string")),
            method("getInt", [namedType("string")], namedType("int")),
            method("getInt64", [namedType("string")], namedType("int64")),
            method("getFloat", [namedType("string")], namedType("double")),
            method("getBool", [namedType("string")], namedType("bool"))
          ])
        ],
        [
          "Schema",
          classExport("Schema", [
            method("required", [namedType("string"), namedType("string")], namedType("void")),
            method("optional", [namedType("string"), namedType("string")], namedType("void")),
            method("requiredArray", [namedType("string"), namedType("string")], namedType("void")),
            method("optionalArray", [namedType("string"), namedType("string")], namedType("void")),
            method("requiredObject", [namedType("string"), namedType("Schema")], namedType("void")),
            method("optionalObject", [namedType("string"), namedType("Schema")], namedType("void")),
            method("min", [namedType("string"), namedType("int64")], namedType("void")),
            method("max", [namedType("string"), namedType("int64")], namedType("void")),
            method("minItems", [namedType("string"), namedType("int64")], namedType("void")),
            method("maxItems", [namedType("string"), namedType("int64")], namedType("void")),
            method("oneOf", [namedType("string"), arrayType(namedType("string"))], namedType("void")),
            method("pattern", [namedType("string"), namedType("string")], namedType("void")),
            method("validate", [namedType("string")], namedType("ValidationResult"))
          ])
        ]
      ])
    }
  ],
  [
    "mint:http",
    {
      builtin: true,
      builtinIncludes: [
        "<cstdint>",
        "<functional>",
        "<memory>",
        "<mutex>",
        "<string>",
        "<string_view>",
        "<unordered_map>"
      ],
      builtinLinkLibraries: {
        win32: ["ws2_32"]
      },
      program: emptyProgram("mint:http"),
      imports: [],
      exports: new Map([
        [
          "HeaderMap",
          classExport("HeaderMap", [])
        ],
        [
          "Context",
          classExport("Context", [
            property("method", namedType("string")),
            property("path", namedType("string")),
            property("body", namedType("string")),
            property("headers", namedType("HeaderMap")),
            property("params", namedType("HeaderMap")),
            property("query", namedType("HeaderMap")),
            method("header", [namedType("string")], namedType("string")),
            method("param", [namedType("string")], namedType("string")),
            method("queryParam", [namedType("string")], namedType("string")),
            method("setStatus", [namedType("int")], namedType("void")),
            method("setHeader", [namedType("string"), namedType("string")], namedType("void")),
            method("text", [namedType("string")], namedType("void")),
            method("json", [namedType("string")], namedType("void")),
            method("html", [namedType("string")], namedType("void")),
            method("send", [namedType("int"), namedType("string"), namedType("string")], namedType("void"))
          ])
        ],
        [
          "Http",
          classExport("Http", [
            method("get", [namedType("string"), functionType([namedType("Context")], namedType("void"))], namedType("void")),
            method("post", [namedType("string"), functionType([namedType("Context")], namedType("void"))], namedType("void")),
            method("put", [namedType("string"), functionType([namedType("Context")], namedType("void"))], namedType("void")),
            method("del", [namedType("string"), functionType([namedType("Context")], namedType("void"))], namedType("void")),
            method("patch", [namedType("string"), functionType([namedType("Context")], namedType("void"))], namedType("void")),
            method("options", [namedType("string"), functionType([namedType("Context")], namedType("void"))], namedType("void")),
            method("listen", [namedType("string"), namedType("int")], namedType("bool")),
            method("stop", [], namedType("void"))
          ])
        ]
      ])
    }
  ]
]);

export function isBuiltinModuleSource(source: string): boolean {
  return source.startsWith("mint:");
}

export function resolveBuiltinModule(source: string): ResolvedModule | null {
  const module = builtinModules.get(source);
  if (!module) {
    return null;
  }

  return {
    filepath: source,
    ...module
  };
}

function formatTypeNode(node: TypeNode): string {
  switch (node.type) {
    case "NamedType":
      return node.name;
    case "GenericType":
      return `${node.name}<${node.typeArgs.map(formatTypeNode).join(", ")}>`;
    case "ArrayType":
      return `${formatTypeNode(node.elementType)}[]`;
    case "TupleType":
      return `(${node.elements.map(formatTypeNode).join(", ")})`;
    case "FunctionType":
      return `fn(${node.params.map(formatTypeNode).join(", ")}): ${formatTypeNode(node.returnType)}`;
    case "PointerType":
      return `${formatTypeNode(node.pointee)}*`;
    case "ReferenceType":
      return `${formatTypeNode(node.referent)}&`;
    case "ConstType":
      return `const ${formatTypeNode(node.valueType)}`;
    case "OptionalType":
      return `${formatTypeNode(node.valueType)}?`;
    case "UnionType":
      return node.options.map(formatTypeNode).join(" | ");
    default:
      return "unknown";
  }
}

export interface BuiltinManifestMember {
  name: string;
  kind: "function" | "value";
  params?: string[];
  returnType?: string;
  valueType?: string;
}

export interface BuiltinManifestExport {
  name: string;
  kind: "namespace" | "function" | "class" | "type";
  members?: BuiltinManifestMember[];
  params?: string[];
  returnType?: string;
}

export interface BuiltinManifest {
  modules: Record<string, { exports: BuiltinManifestExport[] }>;
}

export function buildBuiltinManifest(): BuiltinManifest {
  const manifest: BuiltinManifest = { modules: {} };

  for (const [source, module] of builtinModules) {
    const exports: BuiltinManifestExport[] = [];

    for (const [, moduleExport] of module.exports) {
      if (!moduleExport.builtin) {
        continue;
      }

      if (moduleExport.namespaceMembers) {
        exports.push({
          name: moduleExport.name,
          kind: "namespace",
          members: [...moduleExport.namespaceMembers.values()].map((member) => ({
            name: member.name,
            kind: member.kind,
            params: member.params?.map(formatTypeNode),
            returnType: member.returnType ? formatTypeNode(member.returnType) : undefined,
            valueType: member.valueType ? formatTypeNode(member.valueType) : undefined
          }))
        });
        continue;
      }

      if (moduleExport.classMethods) {
        exports.push({
          name: moduleExport.name,
          kind: "class",
          members: [...moduleExport.classMethods.values()].map((method) => ({
            name: method.name,
            kind: "function",
            params: method.params.map(formatTypeNode),
            returnType: formatTypeNode(method.returnType)
          }))
        });
        continue;
      }

      if (moduleExport.functionType) {
        exports.push({
          name: moduleExport.name,
          kind: "function",
          params: moduleExport.functionType.params.map(formatTypeNode),
          returnType: formatTypeNode(moduleExport.functionType.returnType)
        });
        continue;
      }
    }

    manifest.modules[source] = { exports };
  }

  return manifest;
}
