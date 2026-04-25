# Upstream Sync Procedure

This fork tracks [OpenCoworkAI/open-codesign](https://github.com/OpenCoworkAI/open-codesign).

All i18n customizations live on the `feat/i18n` branch. `main` mirrors upstream exactly — never commit directly to `main`.

## Syncing upstream changes

```bash
git fetch upstream
git checkout main
git merge upstream/main        # should always be fast-forward
git checkout feat/i18n
git rebase main
```

If the rebase has conflicts, they will only occur in UI component files where upstream changed logic and `feat/i18n` also modified that file (e.g., added a `t()` call). Resolution: keep upstream's logic, re-apply the `t()` wrapper.

## Re-running translations after upstream adds new strings

```bash
pnpm convert:zh-tw
git add packages/i18n/src/locales/zh-TW.json
git commit -m "feat(i18n): sync zh-TW translations with upstream"
```

`pnpm convert:zh-tw` reads `zh-CN.json` and converts new keys to Traditional Chinese using OpenCC. It is safe to re-run — it overwrites `zh-TW.json` with a fresh full conversion each time.

## Daily cheatsheet

```bash
# Sync upstream + rebase i18n branch
git fetch upstream
git checkout main && git merge upstream/main
git checkout feat/i18n && git rebase main

# Refresh zh-TW translations after upstream adds new UI strings
pnpm convert:zh-tw
git add packages/i18n/src/locales/zh-TW.json && git commit -m "feat(i18n): sync zh-TW translations"
```

## Branch protection rules

- `main` — pure upstream mirror, never push custom commits here
- `feat/i18n` — all i18n work lives here, rebase onto updated `main` after each upstream sync
- `upstream` remote push URL is set to `no_push` to prevent accidental pushes to the original repo
