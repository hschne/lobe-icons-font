# Contributing

## Setup

```bash
mise install
mise run check
```

Without mise:

```bash
npm ci
npm run check
```

Tool versions live in `.node-version`, `.ruby-version`, and `package.json`.

## Updating icons

1. Update `@lobehub/icons` in `package.json` and `package-lock.json`.
2. Set this package version to the same version.
3. Run `npm run check`.
4. Review new entries appended to `codepoints.json`.
5. Commit the intentional changes.

Do not reassign existing codepoints. New icons append. Removed icons keep their
slot in `codepoints.json`.

## Generated files

Tracked generated artifacts:

- `dist/lobe-icons.ttf`
- `codepoints.json`

`npm run check` rebuilds and fails if either file changes during the rebuild.
