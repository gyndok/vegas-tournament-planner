# Git Worktree Dashboard (`wt`) — Design

## Overview

A single `wt()` shell function in `~/.zshrc` that provides an interactive fuzzy-searchable dashboard of all git worktrees across `~/Developer/`.

## Behavior

- `wt` with no args launches the interactive fzf picker
- Scans all directories in `~/Developer/` for git repos
- For each repo, discovers all worktrees via `git worktree list`
- Shows dirty/clean status per worktree via `git status --porcelain`
- On selection, `cd`s into the chosen worktree directory
- Escape/Ctrl-C cancels, stays in current directory
- If no worktrees found, prints a message and exits

## Display Format

```
  vegas-tournament-planner │ main
✗ vegas-tournament-planner │ claude/elastic-haibt (2 modified)
  QRBook                   │ main
```

- `✗` prefix = dirty (uncommitted changes)
- Blank prefix = clean
- `(N modified)` count shown only when dirty

## Dependencies

- `fzf` (install via `brew install fzf`)
- `git` (already present)

## Installation

- Single `wt()` function appended to `~/.zshrc`
- Approach: everything in one function, no external files

## Decisions

- **Scope:** Scans all repos in `~/Developer/`, not just current repo
- **Picker:** fzf (installed via Homebrew)
- **Invocation:** Shell function in .zshrc (required for `cd` to work)
- **Display:** Branch + repo name + dirty/clean status
