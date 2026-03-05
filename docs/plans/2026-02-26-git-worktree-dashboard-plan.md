# Git Worktree Dashboard (`wt`) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `wt` shell function to ~/.zshrc that lets you fuzzy-search and jump into any git worktree across ~/Developer/.

**Architecture:** Single zsh function that iterates ~/Developer/*/, runs `git worktree list` + `git status --porcelain` on each, formats results, pipes to fzf, and cd's to the selection.

**Tech Stack:** zsh, git, fzf (Homebrew)

---

### Task 1: Install fzf

**Step 1: Install fzf via Homebrew**

Run: `brew install fzf`
Expected: fzf installs successfully

**Step 2: Verify installation**

Run: `fzf --version`
Expected: Version number printed (e.g. `0.x.x`)

**Step 3: Commit — N/A** (system-level install, nothing to commit)

---

### Task 2: Write the `wt` function and add to ~/.zshrc

**Files:**
- Modify: `~/.zshrc` (append function at end of file)

**Step 1: Append the `wt()` function to ~/.zshrc**

Add the following to the end of `~/.zshrc`:

```zsh
# Git Worktree Dashboard — fuzzy-search and jump into any worktree across ~/Developer
wt() {
  local dev_dir="$HOME/Developer"
  local entries=()

  for repo_dir in "$dev_dir"/*/; do
    # Skip non-git directories
    [ -d "$repo_dir/.git" ] || [ -f "$repo_dir/.git" ] || continue

    local repo_name="${repo_dir%/}"
    repo_name="${repo_name##*/}"

    # Get worktrees for this repo
    while IFS= read -r line; do
      local wt_path wt_branch
      wt_path="$(echo "$line" | awk '{print $1}')"
      wt_branch="$(echo "$line" | sed -n 's/.*\[\(.*\)\]/\1/p')"

      [ -z "$wt_path" ] && continue
      [ -z "$wt_branch" ] && wt_branch="(detached)"

      # Check dirty status
      local changed
      changed="$(git -C "$wt_path" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

      local icon=" "
      local suffix=""
      if [ "$changed" -gt 0 ] 2>/dev/null; then
        icon="✗"
        suffix=" ($changed modified)"
      fi

      entries+=("${icon} ${repo_name} │ ${wt_branch}${suffix}\t${wt_path}")
    done < <(git -C "$repo_dir" worktree list 2>/dev/null)
  done

  if [ ${#entries[@]} -eq 0 ]; then
    echo "No git worktrees found in $dev_dir"
    return 1
  fi

  local selected
  selected="$(printf '%s\n' "${entries[@]}" | column -t -s $'\t' | fzf --ansi --header='Git Worktrees — Enter to cd, Esc to cancel' --no-multi)"

  [ -z "$selected" ] && return 0

  # Extract the path (everything after the last whitespace-separated token that starts with /)
  local target
  target="$(printf '%s\n' "${entries[@]}" | grep -F "$(echo "$selected" | sed 's/ *$//')" | head -1 | awk -F'\t' '{print $2}')"

  if [ -d "$target" ]; then
    cd "$target" || return 1
    echo "→ $target"
  else
    echo "Directory not found: $target"
    return 1
  fi
}
```

**Step 2: Source .zshrc to load the function**

Run: `source ~/.zshrc`
Expected: No errors

**Step 3: Commit — N/A** (personal dotfile, not in a project repo)

---

### Task 3: Smoke test the function

**Step 1: Run `wt` and verify the picker appears**

Run: `wt`
Expected: fzf picker shows entries like:
```
  vegas-tournament-planner │ main
✗ vegas-tournament-planner │ claude/elastic-haibt (2 modified)
  QRBook                   │ main
```

**Step 2: Select a worktree and verify cd works**

Pick any entry, press Enter.
Expected: Shell changes to that worktree directory, prints `→ /path/to/worktree`

**Step 3: Test cancel behavior**

Run `wt`, press Escape.
Expected: Returns to prompt, stays in current directory.

**Step 4: Test with no worktrees (edge case)**

Temporarily point `dev_dir` to an empty dir and verify the "No git worktrees found" message appears.
