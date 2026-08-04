# Changesets

Changesets manage package versions, release notes, and npm publishing.

For every pull request that changes package code, run:

```bash
bunx changeset
```

Select `chat-adapter-wati`, choose the appropriate semantic version bump, and
commit the generated markdown file with the pull request.

After CI succeeds on `main`, the release workflow opens or updates a Changesets
release pull request. Merging that pull request publishes the package to npm.

## npm trusted publishing

The release workflow follows Vercel Chat and uses npm trusted publishing (OIDC),
not a long-lived `NPM_TOKEN`. After the package exists on npm, configure its
trusted publisher with:

- GitHub user or organization: `krypt0nate`
- Repository: `wati-adapter`
- Workflow filename: `release.yml`
- Allowed action: `npm publish`

Because `chat-adapter-wati` has not been published yet, bootstrap version
`0.1.0` once with an authenticated manual `npm publish` from
`packages/adapter-wati`. Then configure the trusted publisher before relying on
the automated release workflow.
