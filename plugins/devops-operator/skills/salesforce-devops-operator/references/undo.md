# Undo

Goal: fix the mistake without losing anything, and without rewriting history that already left the machine.

First find out **where the mistake lives**: only in the working copy, in a local commit, or already pushed (`git status --short --branch` shows `ahead` for unpushed commits). The fix differs.

Several commands below discard changes. The hook asks for confirmation before each of them - say beforehand what will be lost, so the confirmation is an informed one.

## Not committed yet

| Mistake                            | Fix                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Staged a file that does not belong | `git restore --staged <file>` - unstages it, the change stays                                    |
| Retrieved something unrelated      | `git restore <file>` - throws that file's change away (confirm)                                  |
| A new file that should not exist   | Delete it, or `git clean -n` to list untracked files, then remove the ones named                 |
| Started on the wrong branch        | `git switch -c <right branch>` - the changes come along; or `git stash`, switch, `git stash pop` |

## Committed, not pushed

| Mistake                                        | Fix                                                         |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Typo in the last commit message                | `git commit --amend -m "<new message>"`                     |
| Forgot a file in the last commit               | `git add <file>` then `git commit --amend --no-edit`        |
| Last commit should not exist, keep the changes | `git reset HEAD~1` - the changes return to the working copy |
| Committed on an environment branch             | See below                                                   |

**Committed on an environment branch** (usually only possible without the hooks): move the commit to a work branch and reset the environment branch to GitHub's state, keeping the work:

```bash
git branch feature/ABC-123-discount-approval     # the commit now lives here too
git reset --keep origin/main                     # main back to GitHub's state
git switch feature/ABC-123-discount-approval
```

`--keep` refuses to run if it would lose uncommitted changes, unlike `--hard`.

## Already pushed

Never rewrite pushed history - others may have it, and the force push it needs is blocked.

| Mistake                               | Fix                                                                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A pushed commit was wrong             | `git revert <commit>` - a new commit that undoes it; push normally                                                                                                                                 |
| Wrong message on a pushed commit      | Leave it - or, if the pull request is squash-merged, fix the pull request title instead                                                                                                            |
| Pushed to the wrong branch name       | Push to the right name, open the pull request from there; deleting the wrong branch on GitHub needs a confirmation                                                                                 |
| A merged pull request broke something | A revert pull request: `gh pr view <number>` for the merge commit, `git revert` on a new branch, pull request into the same target - and tell the team, because the change may already be deployed |

Reverting code does not undo a **deployment**: Salesforce has no rollback. A revert deploys the previous state again through the pipeline - for data changes or deleted fields that may not be enough. Say so when a merged change already reached an org.

## Work seems lost

Almost nothing committed is ever lost. `git reflog` lists every state the branch was in, with time:

```bash
git reflog -20
git branch rescue/<what> <commit from the reflog>
```

Stashed work: `git stash list`, then `git stash show -p stash@{n}` to look before applying it.

Uncommitted changes that were discarded cannot be recovered by Git - but if they were built in the org, they are still there and can be retrieved again.
