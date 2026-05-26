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

const genericType = (name: string, typeArgs: TypeNode[]): TypeNode => ({
  type: "GenericType",
  name,
  typeArgs,
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
    "mint:sql",
    {
      builtin: true,
      builtinIncludes: ["<cstdint>", "<memory>", "<string>", "<string_view>", "<vector>"],
      builtinNative: {
        vendorDirs: ["sqlite"],
        sources: [
          { vendorDir: "sqlite", patterns: ["sqlite3.c"] }
        ],
        defines: {
          win32: ["SQLITE_THREADSAFE=0", "SQLITE_OMIT_LOAD_EXTENSION=1", "SQLITE_DEFAULT_MEMSTATUS=0"],
          linux: ["SQLITE_THREADSAFE=0", "SQLITE_OMIT_LOAD_EXTENSION=1", "SQLITE_DEFAULT_MEMSTATUS=0"],
          darwin: ["SQLITE_THREADSAFE=0", "SQLITE_OMIT_LOAD_EXTENSION=1", "SQLITE_DEFAULT_MEMSTATUS=0"]
        }
      },
      program: emptyProgram("mint:sql"),
      imports: [],
      exports: new Map([
        [
          "SqlResult",
          classExport("SqlResult", [
            method("hasNext", [], namedType("bool")),
            method("next", [], namedType("void")),
            method("getString", [namedType("string")], namedType("string")),
            method("getInt", [namedType("string")], namedType("int")),
            method("getInt64", [namedType("string")], namedType("int64")),
            method("getDouble", [namedType("string")], namedType("double")),
            method("isNull", [namedType("string")], namedType("bool")),
            method("columnCount", [], namedType("int")),
            method("columnName", [namedType("int")], namedType("string")),
            property("error", namedType("string")),
            method("close", [], namedType("void"))
          ])
        ],
        [
          "Database",
          classExport("Database", [
            method("open", [namedType("string")], namedType("bool")),
            method("openMemory", [], namedType("bool")),
            method("close", [], namedType("void")),
            method("exec", [namedType("string")], namedType("bool")),
            method("execParams", [namedType("string"), arrayType(namedType("string"))], namedType("bool")),
            method("query", [namedType("string")], namedType("SqlResult")),
            method("queryParams", [namedType("string"), arrayType(namedType("string"))], namedType("SqlResult")),
            method("lastInsertRowId", [], namedType("int64")),
            method("changes", [], namedType("int")),
            property("error", namedType("string"))
          ])
        ]
      ])
    }
  ],
  [
    "mint:test",
    {
      builtin: true,
      builtinIncludes: ["<exception>", "<functional>", "<iostream>", "<string>", "<string_view>", "<vector>"],
      program: emptyProgram("mint:test"),
      imports: [],
      exports: new Map([
        [
          "Test",
          namespaceExport("Test", [
            functionMember("run", [namedType("string"), functionType([], namedType("void"))], namedType("void"), "__doublemint_test_run"),
            functionMember("expectTrue", [namedType("bool"), namedType("string")], namedType("void"), "__doublemint_test_expect_true"),
            functionMember("expectInt", [namedType("int"), namedType("int"), namedType("string")], namedType("void"), "__doublemint_test_expect_int"),
            functionMember("expectString", [namedType("string"), namedType("string"), namedType("string")], namedType("void"), "__doublemint_test_expect_string"),
            functionMember("expectBool", [namedType("bool"), namedType("bool"), namedType("string")], namedType("void"), "__doublemint_test_expect_bool"),
            functionMember("report", [], namedType("int"), "__doublemint_test_report"),
            functionMember("passed", [], namedType("int"), "__doublemint_test_passed"),
            functionMember("failed", [], namedType("int"), "__doublemint_test_failed")
          ])
        ]
      ])
    }
  ],
  [
    "mint:base64",
    {
      builtin: true,
      builtinIncludes: ["<string>", "<string_view>", "<vector>"],
      program: emptyProgram("mint:base64"),
      imports: [],
      exports: new Map([
        [
          "Base64",
          namespaceExport("Base64", [
            functionMember("encode", [namedType("string")], namedType("string"), "__doublemint_base64_encode"),
            functionMember("decode", [namedType("string")], namedType("string"), "__doublemint_base64_decode"),
            functionMember("encodeBytes", [arrayType(namedType("int"))], namedType("string"), "__doublemint_base64_encode_bytes"),
            functionMember("decodeBytes", [namedType("string")], arrayType(namedType("int")), "__doublemint_base64_decode_bytes")
          ])
        ]
      ])
    }
  ],
  [
    "mint:array",
    {
      builtin: true,
      builtinIncludes: ["<algorithm>", "<functional>", "<type_traits>", "<vector>"],
      program: emptyProgram("mint:array"),
      imports: [],
      exports: new Map([
        [
          "Array",
          namespaceExport("Array", [
            functionMember(
              "map",
              [arrayType(namedType("T")), functionType([namedType("T")], namedType("U"))],
              arrayType(namedType("U")),
              "__doublemint_array_map"
            ),
            functionMember(
              "filter",
              [arrayType(namedType("T")), functionType([namedType("T")], namedType("bool"))],
              arrayType(namedType("T")),
              "__doublemint_array_filter"
            ),
            functionMember(
              "reduce",
              [arrayType(namedType("T")), namedType("U"), functionType([namedType("U"), namedType("T")], namedType("U"))],
              namedType("U"),
              "__doublemint_array_reduce"
            ),
            functionMember(
              "findIndex",
              [arrayType(namedType("T")), functionType([namedType("T")], namedType("bool"))],
              namedType("int"),
              "__doublemint_array_find_index"
            ),
            functionMember(
              "any",
              [arrayType(namedType("T")), functionType([namedType("T")], namedType("bool"))],
              namedType("bool"),
              "__doublemint_array_any"
            ),
            functionMember(
              "all",
              [arrayType(namedType("T")), functionType([namedType("T")], namedType("bool"))],
              namedType("bool"),
              "__doublemint_array_all"
            ),
            functionMember("reverse", [arrayType(namedType("T"))], arrayType(namedType("T")), "__doublemint_array_reverse"),
            functionMember("sort", [arrayType(namedType("T"))], arrayType(namedType("T")), "__doublemint_array_sort"),
            functionMember(
              "sortBy",
              [arrayType(namedType("T")), functionType([namedType("T"), namedType("T")], namedType("bool"))],
              arrayType(namedType("T")),
              "__doublemint_array_sort_by"
            ),
            functionMember("length", [arrayType(namedType("T"))], namedType("int"), "__doublemint_array_length"),
            functionMember(
              "concat",
              [arrayType(namedType("T")), arrayType(namedType("T"))],
              arrayType(namedType("T")),
              "__doublemint_array_concat"
            ),
            functionMember(
              "slice",
              [arrayType(namedType("T")), namedType("int"), namedType("int")],
              arrayType(namedType("T")),
              "__doublemint_array_slice"
            ),
            functionMember("contains", [arrayType(namedType("T")), namedType("T")], namedType("bool"), "__doublemint_array_contains"),
            functionMember("indexOf", [arrayType(namedType("T")), namedType("T")], namedType("int"), "__doublemint_array_index_of")
          ])
        ]
      ])
    }
  ],
  [
    "mint:string",
    {
      builtin: true,
      builtinIncludes: ["<algorithm>", "<string>", "<string_view>", "<vector>"],
      program: emptyProgram("mint:string"),
      imports: [],
      exports: new Map([
        [
          "String",
          namespaceExport("String", [
            functionMember("upper", [namedType("string")], namedType("string"), "__doublemint_string_upper"),
            functionMember("lower", [namedType("string")], namedType("string"), "__doublemint_string_lower"),
            functionMember("trim", [namedType("string")], namedType("string"), "__doublemint_string_trim"),
            functionMember("split", [namedType("string"), namedType("string")], arrayType(namedType("string")), "__doublemint_string_split"),
            functionMember("replace", [namedType("string"), namedType("string"), namedType("string")], namedType("string"), "__doublemint_string_replace"),
            functionMember("contains", [namedType("string"), namedType("string")], namedType("bool"), "__doublemint_string_contains"),
            functionMember("startsWith", [namedType("string"), namedType("string")], namedType("bool"), "__doublemint_string_starts_with"),
            functionMember("endsWith", [namedType("string"), namedType("string")], namedType("bool"), "__doublemint_string_ends_with"),
            functionMember("indexOf", [namedType("string"), namedType("string")], namedType("int"), "__doublemint_string_index_of"),
            functionMember("lastIndexOf", [namedType("string"), namedType("string")], namedType("int"), "__doublemint_string_last_index_of"),
            functionMember("substring", [namedType("string"), namedType("int"), namedType("int")], namedType("string"), "__doublemint_string_substring"),
            functionMember("length", [namedType("string")], namedType("int"), "__doublemint_string_length"),
            functionMember("repeat", [namedType("string"), namedType("int")], namedType("string"), "__doublemint_string_repeat"),
            functionMember("padLeft", [namedType("string"), namedType("int"), namedType("string")], namedType("string"), "__doublemint_string_pad_left"),
            functionMember("padRight", [namedType("string"), namedType("int"), namedType("string")], namedType("string"), "__doublemint_string_pad_right"),
            functionMember("join", [arrayType(namedType("string")), namedType("string")], namedType("string"), "__doublemint_string_join"),
            functionMember("reverse", [namedType("string")], namedType("string"), "__doublemint_string_reverse"),
            functionMember("fromInt", [namedType("int")], namedType("string"), "__doublemint_string_from_int"),
            functionMember("toInt", [namedType("string")], namedType("int"), "__doublemint_string_to_int")
          ])
        ]
      ])
    }
  ],
  [
    "mint:math",
    {
      builtin: true,
      builtinIncludes: ["<algorithm>", "<cmath>", "<cstdlib>", "<limits>", "<numbers>"],
      program: emptyProgram("mint:math"),
      imports: [],
      exports: new Map([
        [
          "Math",
          namespaceExport("Math", [
            valueMember("PI", namedType("double"), "std::numbers::pi"),
            valueMember("E", namedType("double"), "std::numbers::e"),
            valueMember("INFINITY", namedType("double"), "std::numeric_limits<double>::infinity()"),
            functionMember("sin", [namedType("double")], namedType("double"), "std::sin"),
            functionMember("cos", [namedType("double")], namedType("double"), "std::cos"),
            functionMember("tan", [namedType("double")], namedType("double"), "std::tan"),
            functionMember("asin", [namedType("double")], namedType("double"), "std::asin"),
            functionMember("acos", [namedType("double")], namedType("double"), "std::acos"),
            functionMember("atan", [namedType("double")], namedType("double"), "std::atan"),
            functionMember("atan2", [namedType("double"), namedType("double")], namedType("double"), "std::atan2"),
            functionMember("sqrt", [namedType("double")], namedType("double"), "std::sqrt"),
            functionMember("cbrt", [namedType("double")], namedType("double"), "std::cbrt"),
            functionMember("pow", [namedType("double"), namedType("double")], namedType("double"), "std::pow"),
            functionMember("exp", [namedType("double")], namedType("double"), "std::exp"),
            functionMember("log", [namedType("double")], namedType("double"), "std::log"),
            functionMember("log2", [namedType("double")], namedType("double"), "std::log2"),
            functionMember("log10", [namedType("double")], namedType("double"), "std::log10"),
            functionMember("floor", [namedType("double")], namedType("double"), "std::floor"),
            functionMember("ceil", [namedType("double")], namedType("double"), "std::ceil"),
            functionMember("round", [namedType("double")], namedType("double"), "std::round"),
            functionMember("trunc", [namedType("double")], namedType("double"), "std::trunc"),
            functionMember("absInt", [namedType("int")], namedType("int"), "std::abs"),
            functionMember("absFloat", [namedType("double")], namedType("double"), "std::fabs"),
            functionMember("minInt", [namedType("int"), namedType("int")], namedType("int"), "std::min<int>"),
            functionMember("maxInt", [namedType("int"), namedType("int")], namedType("int"), "std::max<int>"),
            functionMember("minFloat", [namedType("double"), namedType("double")], namedType("double"), "std::fmin"),
            functionMember("maxFloat", [namedType("double"), namedType("double")], namedType("double"), "std::fmax"),
            functionMember("clampInt", [namedType("int"), namedType("int"), namedType("int")], namedType("int"), "std::clamp<int>"),
            functionMember("clampFloat", [namedType("double"), namedType("double"), namedType("double")], namedType("double"), "std::clamp<double>"),
            functionMember("roundToInt", [namedType("double")], namedType("int"), "std::lround"),
            functionMember("floorToInt", [namedType("double")], namedType("int"), "__doublemint_math_floor_to_int"),
            functionMember("ceilToInt", [namedType("double")], namedType("int"), "__doublemint_math_ceil_to_int"),
            functionMember("truncToInt", [namedType("double")], namedType("int"), "__doublemint_math_trunc_to_int"),
            functionMember("intToFloat", [namedType("int")], namedType("double"), "__doublemint_math_int_to_float"),
            functionMember("signInt", [namedType("int")], namedType("int"), "__doublemint_math_sign_int"),
            functionMember("signFloat", [namedType("double")], namedType("int"), "__doublemint_math_sign_float")
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
      builtinIncludes: ["<array>", "<cstdlib>", "<cstdio>", "<memory>", "<string>", "<string_view>", "<vector>"],
      program: emptyProgram("mint:os"),
      imports: [],
      exports: new Map([
        [
          "OS",
          namespaceExport("OS", [
            functionMember("isLinux", [], namedType("bool"), "__doublemint_os_is_linux"),
            functionMember("isWindows", [], namedType("bool"), "__doublemint_os_is_windows"),
            functionMember("execute", [namedType("string")], namedType("string"), "__doublemint_os_execute"),
            functionMember("runOutput", [namedType("string")], namedType("string"), "__doublemint_os_run_output"),
            functionMember("runExitCode", [namedType("string")], namedType("int"), "__doublemint_os_run_exit_code"),
            functionMember("argsQuote", [namedType("string")], namedType("string"), "__doublemint_os_args_quote"),
            functionMember("argsJoin", [arrayType(namedType("string"))], namedType("string"), "__doublemint_os_args_join")
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
      builtinIncludes: ["<cstdint>", "<cstring>", "<iomanip>", "<sstream>", "<string>", "<string_view>", "<vector>"],
      program: emptyProgram("mint:crypto"),
      imports: [],
      exports: new Map([
        [
          "Crypto",
          namespaceExport("Crypto", [
            functionMember("hashFnv1a", [namedType("string")], namedType("int"), "__doublemint_crypto_fnv1a"),
            functionMember("xorCipher", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_crypto_xor"),
            functionMember("toHex", [namedType("int")], namedType("string"), "__doublemint_crypto_to_hex"),
            functionMember("sha256", [namedType("string")], namedType("string"), "__doublemint_crypto_sha256"),
            functionMember("md5", [namedType("string")], namedType("string"), "__doublemint_crypto_md5"),
            functionMember("hmacSha256", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_crypto_hmac_sha256"),
            functionMember("hmacMd5", [namedType("string"), namedType("string")], namedType("string"), "__doublemint_crypto_hmac_md5")
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
            functionMember("run", [functionType([], namedType("T"))], genericType("Future", [namedType("T")]), "__doublemint_async_run"),
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
        "<unordered_map>",
        "<utility>",
        "<vector>"
      ],
      builtinLinkLibraries: {
        win32: ["ws2_32", "iphlpapi", "psapi", "userenv", "advapi32", "dbghelp", "ole32", "uuid", "shell32"]
      },
      builtinNative: {
        vendorDirs: ["libuv/include", "libuv/src", "uSockets/src", "uWebSockets/src"],
        sources: [
          {
            vendorDir: "libuv/src",
            patterns: [
              "fs-poll.c", "idna.c", "inet.c", "random.c", "strscpy.c", "strtok.c",
              "thread-common.c", "threadpool.c", "timer.c", "uv-common.c",
              "uv-data-getter-setters.c", "version.c"
            ]
          },
          {
            vendorDir: "libuv/src/win",
            patterns: ["*.c"],
            platforms: ["win32"]
          },
          {
            vendorDir: "uSockets/src",
            patterns: ["bsd.c", "context.c", "loop.c", "socket.c", "udp.c"]
          },
          {
            vendorDir: "uSockets/src/eventing",
            patterns: ["libuv.c"]
          }
        ],
        defines: {
          win32: ["LIBUS_USE_LIBUV=1", "LIBUS_NO_SSL=1", "UWS_NO_ZLIB=1", "WIN32_LEAN_AND_MEAN", "_WIN32_WINNT=0x0602", "NDEBUG"],
          linux: ["LIBUS_USE_LIBUV=1", "LIBUS_NO_SSL=1", "UWS_NO_ZLIB=1", "_FILE_OFFSET_BITS=64", "_LARGEFILE_SOURCE", "_GNU_SOURCE"],
          darwin: ["LIBUS_USE_LIBUV=1", "LIBUS_NO_SSL=1", "UWS_NO_ZLIB=1", "_DARWIN_UNLIMITED_SELECT=1"]
        },
        linkLibraries: {
          linux: ["pthread", "dl", "rt"],
          darwin: ["pthread"]
        }
      },
      program: emptyProgram("mint:http"),
      imports: [],
      exports: new Map([
        [
          "HeaderMap",
          classExport("HeaderMap", [])
        ],
        [
          "HttpResponse",
          classExport("HttpResponse", [
            property("status", namedType("int")),
            property("body", namedType("string")),
            property("ok", namedType("bool")),
            property("error", namedType("string")),
            property("headers", namedType("HeaderMap")),
            method("header", [namedType("string")], namedType("string"))
          ])
        ],
        [
          "Fetch",
          namespaceExport("Fetch", [
            functionMember("get", [namedType("string")], namedType("HttpResponse"), "__doublemint_fetch_get"),
            functionMember("post", [namedType("string"), namedType("string"), namedType("string")], namedType("HttpResponse"), "__doublemint_fetch_post"),
            functionMember("request", [namedType("string"), namedType("string"), namedType("string"), namedType("string")], namedType("HttpResponse"), "__doublemint_fetch_request")
          ])
        ],
        [
          "WebSocket",
          classExport("WebSocket", [
            method("send", [namedType("string")], namedType("void")),
            method("sendBinary", [arrayType(namedType("int"))], namedType("void")),
            method("close", [], namedType("void")),
            method("closeWithCode", [namedType("int"), namedType("string")], namedType("void")),
            method("remoteAddress", [], namedType("string"))
          ])
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
            method(
              "ws",
              [
                namedType("string"),
                functionType([namedType("WebSocket")], namedType("void")),
                functionType([namedType("WebSocket"), namedType("string")], namedType("void")),
                functionType([namedType("WebSocket")], namedType("void"))
              ],
              namedType("void")
            ),
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
