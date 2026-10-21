# Authentication

Every persistent org the pipeline talks to - sandboxes and production - gets its own credentials through the **JWT bearer flow**. The kit's reusable workflows expect exactly three secrets per org: `SFDX_CONSUMER_KEY`, `SFDX_JWT_SECRET_KEY`, `SFDX_USERNAME`. The SFDX Auth URL is for local experiments and throwaway orgs only. The kit's `docs/authentication.md` is the user-facing guide; this file is the procedure to walk someone through.

## 1. Integration user

- One dedicated user per org, never a personal account. A departing employee must not take the pipeline with them.
- Least privilege: deploy metadata, run tests, install packages where needed - not System Administrator for convenience. A permission set carries these rights and the app pre-authorisation.
- Name it so it is recognisable in audit trails, e.g. `ci.integration@<company>.com.uat` in a sandbox.

## 2. Certificate and key

Run locally, outside the repository:

```bash
mkdir -p ~/sf-jwt/uat && cd ~/sf-jwt/uat
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key -out server.crt -subj "/CN=ci-uat"
```

- One key pair per org keeps a leaked key's blast radius to one org.
- `-days 365` means the pipeline stops working in a year. Write the expiry date down where the pipeline owner will see it - see [team-enablement.md](team-enablement.md).
- `server.key` is the secret. It goes into a GitHub secret and a password manager, nowhere else.

## 3. App in the org

Create an app with OAuth enabled, upload `server.crt`, enable the JWT bearer flow, set "admin approved users are pre-authorized", and assign it to the integration user through the permission set.

Salesforce steers new setups from **connected apps** toward **external client apps**, and newer orgs may not allow creating connected apps by default. Both support the JWT bearer flow. Ask which one the org allows rather than assuming, and follow Salesforce's current guide for that app type.

The consumer key (client ID) becomes `SFDX_CONSUMER_KEY`.

## 4. Verify locally before storing anything

```bash
sf org login jwt \
  --client-id "<consumer key>" \
  --jwt-key-file ~/sf-jwt/uat/server.key \
  --username ci.integration@company.com.uat \
  --instance-url https://test.salesforce.com \
  --alias ci-uat
sf org display --target-org ci-uat
```

Use `https://login.salesforce.com` for production, `https://test.salesforce.com` for sandboxes, or the org's My Domain URL. A failure here is far easier to debug than the same failure in a CI log.

## 5. Store as secrets

Environment-scoped as soon as there is more than one org - see [github-setup.md](github-setup.md):

```bash
gh secret set SFDX_CONSUMER_KEY   --env uat --body "<consumer key>"
gh secret set SFDX_USERNAME       --env uat --body "ci.integration@company.com.uat"
gh secret set SFDX_JWT_SECRET_KEY --env uat < ~/sf-jwt/uat/server.key
```

Let the user type or paste the consumer key and username into their own terminal if they prefer not to share them in the conversation. Never ask for the key's content.

For scratch org flows, the Dev Hub's credentials are **repository** secrets, because `scratch-org-ci.yml` and `create-scratch-org.yml` read those.

## 6. Clean up

- Delete the local alias if it was only for the check: `sf org logout --target-org ci-uat --no-prompt`.
- Move `server.key` into the password manager and delete the local copy, or keep the folder outside any repository.
- Confirm the project's `.gitignore` covers `server.key`, `server.crt` and `authFile.json`.

## Rotation

Before the certificate expires: create a new key pair, replace the certificate on the app, update `SFDX_JWT_SECRET_KEY` right away and run one validation to confirm. The consumer key and username stay the same. Logins fail between the certificate swap and the secret update, so do it outside a deployment window.
