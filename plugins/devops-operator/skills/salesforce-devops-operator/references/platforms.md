# Git platforms

Git works the same everywhere: branches, commits, merges, conflicts and undo need nothing from this page. What differs between GitHub, GitLab, Azure DevOps and Bitbucket is everything around Git - pull requests, checks, pipelines and work items. This page maps each step of the flows onto the platform the project lives on.

## Find the platform

1. **`platform` in `.github/salesforce-devops.yml`** decides, if it is set. The file keeps that path on every platform.
2. **Otherwise the remote:** `git remote get-url origin`.

| Remote host contains                      | Platform     | Tool                                                                                           |
| ----------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `github.com`, or a GitHub Enterprise host | GitHub       | `gh`                                                                                           |
| `gitlab`                                  | GitLab       | `glab`                                                                                         |
| `dev.azure.com`, `visualstudio.com`       | Azure DevOps | `az` with the `azure-devops` extension                                                         |
| `bitbucket.org`                           | Bitbucket    | The REST API with `curl` - there is no official CLI for it                                     |
| anything else                             | Unknown      | Ask: self-hosted GitLab, Bitbucket Data Center, Azure DevOps Server, GitHub Enterprise, Gitea? |

A self-hosted server often has a host name that says nothing. Ask once, and suggest the pipeline owner sets `platform` in the configuration file, so nobody has to ask again.

**Say "pull request" or "merge request" the way the platform does** - GitLab calls them merge requests, everyone else pull requests. This skill says pull request; use the platform's word with the user.

## Signed in?

| Platform     | Check                                                   | If not                                                                                                                                           |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub       | `gh auth status`                                        | `gh auth login`                                                                                                                                  |
| GitLab       | `glab auth status`                                      | `glab auth login`, with `--hostname` for a self-hosted server                                                                                    |
| Azure DevOps | `az devops configure --list` - organization and project | `az extension add --name azure-devops`, `az login` or `az devops login`, then `az devops configure --defaults organization=<url> project=<name>` |
| Bitbucket    | `curl` and a token in the environment                   | The user creates an API token in their Atlassian account and puts it into an environment variable themselves                                     |

The user signs in in their own terminal - never ask for a token, password or key in the conversation, and never print one. For Bitbucket, read the token from an environment variable the user set (`"$BITBUCKET_API_TOKEN"`), never from the command line text. App passwords are being retired in favour of API tokens.

**No tool and no wish to install one?** Every step below also works in the platform's web interface. Say where to click instead of pushing an installation - for an admin who builds in Setup, a link to the pull request page is often the better answer anyway.

## The steps per platform

Flags change between releases. Check `--help` of the installed version before relying on one - the table shows what each step needs, not every option.

| Step                      | GitHub                                                | GitLab                                                                   | Azure DevOps                                                                               |
| ------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Read a work item          | `gh issue view <n> --json title,url`                  | `glab issue view <n>`                                                    | `az boards work-item show --id <n>`                                                        |
| Open a pull request       | `gh pr create --base <t> --title ... --body-file <f>` | `glab mr create --target-branch <t> --title ... --description ... --yes` | `az repos pr create --source-branch <b> --target-branch <t> --title ... --description ...` |
| ...as a draft             | `--draft`                                             | `--draft`                                                                | `--draft`                                                                                  |
| ...linked to a work item  | `Closes #<n>` in the body                             | `Closes #<n>` in the description                                         | `--work-items <id>`                                                                        |
| Pull requests of a branch | `gh pr status`, `gh pr list --base <t>`               | `glab mr list --target-branch <t>`, `glab mr view <branch>`              | `az repos pr list --source-branch <b>`, `az repos pr show --id <n>`                        |
| State of the checks       | `gh pr checks`, `--watch` to follow                   | `glab ci status`, `--branch <b>`, `--live` to follow                     | `az repos pr policy list --id <n>`, `az pipelines runs list --branch <b>`                  |
| Jobs of one run           | `gh run view <run-id>`                                | `glab ci get --with-job-details --output json`                           | `az pipelines runs show --id <run-id>`                                                     |
| Log of what failed        | `gh run view <run-id> --log-failed`                   | `glab ci trace <job-id or name>`                                         | No log command - the web UI, or `az devops invoke` on the build logs API                   |
| Run a failed job again    | `gh run rerun <run-id> --failed`                      | `glab ci retry <job-id or name>`                                         | `az repos pr policy queue --id <n> --evaluation-id <id>` for a build validation            |
| Start a pipeline by hand  | `gh workflow run <file> -f key=value`                 | `glab ci run --branch <b> --variables key:value`                         | `az pipelines run --name <pipeline> --branch <b> --parameters key=value`                   |
| Merge                     | `gh pr merge <n>`                                     | `glab mr merge <n>`                                                      | `az repos pr update --id <n> --status completed`                                           |

Opening a pull request and starting a pipeline leave the machine - confirm first, as for a push. Merging is the reviewer's or release manager's step, not this skill's: the hook asks before every merge on all four platforms, and before Azure DevOps' `--auto-complete`, which merges by itself once the policies pass.

### Bitbucket

Bitbucket Cloud has no official CLI - Atlassian's `acli` covers Jira, not Bitbucket - so the steps are calls to its REST API. Third-party CLIs exist; use one only if the team already does. The base is `https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>`, authenticated as `-u "$BITBUCKET_EMAIL:$BITBUCKET_API_TOKEN"`, both set by the user:

| Step                    | Call                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open a pull request     | `POST .../pullrequests` with `title`, `description`, `source.branch.name`, `destination.branch.name`, optionally `draft` and `close_source_branch`                                    |
| Pull requests           | `GET .../pullrequests?q=source.branch.name="<b>"`, `GET .../pullrequests/<id>`                                                                                                        |
| State of the checks     | `GET .../pullrequests/<id>/statuses` - the build statuses of its head commit                                                                                                          |
| Pipeline runs           | `GET .../pipelines?target.branch=<b>&sort=-created_on`, then `GET .../pipelines/<uuid>/steps`                                                                                         |
| Log of a failed step    | `GET .../pipelines/<uuid>/steps/<step-uuid>/log`                                                                                                                                      |
| Start a custom pipeline | `POST .../pipelines` with `target` (`ref_type: branch`, `type: pipeline_ref_target`, `ref_name`, `selector` with `type: custom` and the pipeline's name as `pattern`) and `variables` |
| Merge                   | `POST .../pullrequests/<id>/merge` - not this skill's step                                                                                                                            |

Write the JSON body into a file and send it with `--data @<file>`; pipe the answer through `node -e` or `python3 -m json.tool` rather than pasting raw JSON at the user. **Bitbucket Data Center** (self-hosted) has a different API under `<server>/rest/api/latest/projects/<key>/repos/<repo>/pull-requests` and build statuses under `/rest/build-status/latest/commits/<commit>`, with an HTTP access token as `Authorization: Bearer` - check the REST documentation of the server's version.

Jira is the usual tracker next to Bitbucket: read a work item in Jira, not in Bitbucket, and put its key in the branch name and the title - Jira links them by the key.

## What else differs

| Topic                      | GitHub                                                                       | GitLab                                                                                                                                                 | Azure DevOps                                                                 | Bitbucket                                                                    |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Pipeline file              | `.github/workflows/*.yml`                                                    | `.gitlab-ci.yml`                                                                                                                                       | `azure-pipelines.yml` or any YAML a pipeline points to                       | `bitbucket-pipelines.yml`                                                    |
| Pull request template      | `.github/PULL_REQUEST_TEMPLATE.md`                                           | `.gitlab/merge_request_templates/*.md`                                                                                                                 | `.azuredevops/pull_request_template.md` (also `.vsts/`, `docs/` or the root) | A default description in the repository settings, if one is set              |
| Push to a protected branch | `GH006: Protected branch update failed`, `GH013: Repository rule violations` | `You are not allowed to push code to protected branches`                                                                                               | `TF402455: Pushes to this branch are not permitted`                          | A message about the branch's restrictions or permissions                     |
| Required checks are called | Required status checks, rulesets                                             | Pipelines must succeed, approval rules                                                                                                                 | Branch policies: build validation, reviewers, linked work items              | Merge checks: successful builds, approvals                                   |
| Merge methods to watch     | Squash, merge commit or rebase per repository                                | **Fast-forward merge** needs an up-to-date branch: use the merge request's rebase (`glab mr rebase`), which runs on the server and needs no force push | Squash, rebase or semi-linear, limited by branch policy                      | Merge strategy per pull request: merge commit, squash, fast forward and more |

A rejected push to a protected branch is the platform working, not a fault - the messages above all mean the same: open a pull request. Where a fast-forward-only setting asks for a rebase, take the platform's own rebase button or command: it rewrites the branch on the server and leaves nothing to force-push locally. Pull the result before the next commit (`git fetch` and `git merge --ff-only origin/<branch>`).

## The pipeline behind the checks

The DevOps Builder and the Salesforce DevOps Starter Kit are built for GitHub Actions. On the other platforms the team's pipeline is its own - sfdx-hardis, a vendor template or hand-written jobs - with its own job names. The Salesforce part of a failure reads the same everywhere: the error translation in [checks.md](checks.md) applies to any check-only deployment, test run or code review, whatever ran it. What does not carry over are the kit's step names and its `promote.yml`: read the job names from the run, and promote with pull requests or the team's tool ([promote.md](promote.md)).
