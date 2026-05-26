# `init`, `info`, `version`

Three small commands that don't need their own page.

## `init`

```bash
doublemint init my-app
```

Creates the target directory (if missing) and drops a `main.dlm`
hello-world template using the directory name as the embedded
greeting. Refuses to overwrite an existing `main.dlm`.

`doublemint init` (no argument) scaffolds into the current directory.

Output:

```text
wrote /work/my-app/main.dlm
next: doublemint build /work/my-app/main.dlm --out /work/my-app/my-app.exe
```

## `info`

```bash
doublemint info
```

Walks the live builtin manifest and prints every `mint:*` module with
the kind of each thing it exports. Safe to run outside any project.

Example slice:

```text
mint:io  ->  IO (namespace), print (function), println (function)
mint:json  ->  Json (namespace)
mint:http  ->  HeaderMap (class), HttpResponse (class), ...
mint:sql  ->  SqlResult (class), Database (class)
```

## `version`

All three are equivalent:

```bash
doublemint version
doublemint --version
doublemint -v
```

Output:

```text
doublemint 0.0.1-dev-32
```

The version walks a small list of candidate `package.json` paths
(relative to the running module) and uses whichever one has
`name === "doublemint"`. Falls back to `0.0.0-unknown` if none is
found rather than crashing.
