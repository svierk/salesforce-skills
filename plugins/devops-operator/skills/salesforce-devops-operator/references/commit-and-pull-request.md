# Commit and pull request

## Commit

Goal: one commit that holds exactly the story's changes, with a message a reviewer understands.

1. **Check the branch.** Never commit on an environment branch - the hook blocks it. If the user is on one with uncommitted changes, move them to a work branch first; uncommitted changes come along:

   ```bash
   git switch -c feature/ABC-123-discount-approval
   ```

2. **Choose what goes in.** List the changes as components (`git status --short`), say which belong to the story and which look unrelated, and stage the chosen ones by path - not with `git add -A` or `git add .`:

   ```bash
   git add force-app/main/default/flows/Discount_Approval.flow-meta.xml \
           force-app/main/default/objects/Opportunity/fields/Discount_Percent__c.field-meta.xml
   git diff --cached --stat
   ```

3. **Write the message** from what actually changed, following `commits.style` and `commits.item`:

   - `conventional`: `type: subject`, with an optional scope for the business area. Types that fit Salesforce work: `feat` (new behaviour - fields, flows, components), `fix` (wrong behaviour corrected), `refactor` (same behaviour, cleaner), `test`, `docs`, `chore` (housekeeping such as API version bumps).
   - `plain`: one imperative sentence.
   - Subject at most about 72 characters, in the imperative ("add", not "added"), saying **what changed for the business** rather than which files: `feat: route discounts above 20% to the sales manager`.
   - Story key per `commits.item`: in the subject (`feat: ABC-123 route discounts ...`), as a footer (`Refs: ABC-123`), or not at all. Without the config file, follow the recent commits; if they show no pattern, use the footer - it is the schema's default.

   Show the message, adjust it with the user, then commit.

4. **Several logical changes?** Two unrelated changes make two commits, so each can be reviewed and reverted on its own.

## Pull request

Goal: the work in front of a reviewer, with the checks running.

1. **Find the target.** Usually `base`. The exceptions:

   - **B2 story promotion / release bundle:** the work branch starts from `main`, but its first stop is the lowest stage through a promotion, not a pull request into `main` - see [promote.md](promote.md). The pull request into `main` comes last, after sign-off.
   - **B2 release train:** into `integration`.
   - **B5:** into `uat`.

2. **Bring the branch up to date** if the target moved on (`git log --oneline HEAD..origin/<target>` shows what is missing) - see [update-and-conflicts.md](update-and-conflicts.md). A pull request that is behind often cannot be merged anyway.
3. **Push** the branch - confirm first:

   ```bash
   git push -u origin feature/ABC-123-discount-approval
   ```

4. **Write the description.** If the repository has `.github/PULL_REQUEST_TEMPLATE.md`, fill in its sections. Otherwise: what changed and why, in business terms; the story (link from `items.url`, or `Closes #123` for GitHub issues so the issue closes on merge); how it was tested; anything a reviewer must know (a manual step after deployment, a dependency on another story).
5. **Open it** - confirm first. Use a draft when the user wants early feedback but is not done:

   ```bash
   gh pr create --base main --title "<the commit subject, or a summary of several>" --body-file <description file>
   gh pr create --draft ...       # not ready for review yet
   ```

6. **Hand over the link** and say what happens now: the checks start (usually a few minutes), a reviewer is requested, and - per blueprint - what merging will mean. Offer to watch the checks: `gh pr checks --watch`.

**Updating an open pull request** is just another commit and push on the same branch - the pull request and its checks update by themselves.
