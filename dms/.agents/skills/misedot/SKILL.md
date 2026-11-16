---
name: misedot
description: >-
  Add a file to mise-managed dotfiles. Use when the user wants to add/register
  a config file under mise dotfiles, make a file managed by `mise dot`, or asks
  how dotfiles are tracked on this machine.
---

# misedot — adding files to mise dotfiles

Dotfiles on this machine are managed by `mise dot` (`[dotfiles]` section in
`~/.config/mise/config.toml`). Canonical sources live in the repo at
`~/dot/dms/<path-after-~>`; the live file in the home directory is a symlink
into the repo.

## 1. Add a file

Always pass the **home/live path**, never the repo path:

```bash
mise dot add ~/.config/foo/bar
```

This moves the file to `~/dot/dms/.config/foo/bar` and creates the symlink
`~/.config/foo/bar -> ~/dot/dms/.config/foo/bar`.

**Warning:** never pass the `~/dot/dms/...` repo path — mise then treats the
repo file as a live file, registers the wrong key in `[dotfiles]`, and seeds a
bogus source tree under `~/dot/dms/dot/`.

## 2. Verify

```bash
mise dot status | grep foo
```

The entry must read like the others, e.g.:

```
~/.config/foo/bar   symlink   ~/dot/dms/.config/foo/bar   ~/.config/mise/config.toml   applied
```

If it shows the live path as anything other than `~/...` resolving to a
symlink into `~/dot/dms/...`, or the source path contains `/dot/`, the add was
wrong.
