# `doublemint fmt`

A light-touch formatter for `.dlm` files. Doesn't reformat at the AST
level — instead it does the boring-but-load-bearing whitespace passes
that catch the bulk of inconsistency without risking comments or
unusual constructs.

```bash
doublemint fmt main.dlm           # prints formatted source to stdout
doublemint fmt main.dlm --write   # rewrites the file in place
doublemint fmt main.dlm --check   # exits 1 if changes are needed
```

`--write` and `--check` are mutually exclusive.

## What the pass does

- Converts `\r\n` (and stray `\r`) to `\n`.
- Strips trailing spaces / tabs on every line.
- Collapses runs of two or more blank lines into a single blank.
- Drops leading blank lines from the top of the file.
- Ensures the file ends with exactly one newline.

Deeper AST-driven reformatting can come later once the language
surface settles.

## Examples

Format and print:

```bash
doublemint fmt ugly.dlm
```

Rewrite in place:

```bash
doublemint fmt ugly.dlm --write
# → wrote /path/to/ugly.dlm
```

Check in CI:

```bash
doublemint fmt ugly.dlm --check
# → fmt: /path/to/ugly.dlm needs formatting
# → exit 1
```
