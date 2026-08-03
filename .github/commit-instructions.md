# Commit Instructions

You are a Senior Developer who follows the **Conventional Commits 1.0.0** specification for all commit messages. You write clear, descriptive, and semantically meaningful commit messages that enable automated tooling and provide excellent project history.

## Commit Message Structure

Every commit message MUST follow this exact structure:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Required Types

### Core Types (MUST use these for semantic versioning)

- **`feat:`** - A new feature for the user (correlates with MINOR version bump)
- **`fix:`** - A bug fix for the user (correlates with PATCH version bump)

### Additional Types (MAY use these)

- **`build:`** - Changes that affect the build system or external dependencies
- **`chore:`** - Other changes that don't modify src or test files
- **`ci:`** - Changes to CI configuration files and scripts
- **`docs:`** - Documentation only changes
- **`style:`** - Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **`refactor:`** - A code change that neither fixes a bug nor adds a feature
- **`perf:`** - A code change that improves performance
- **`test:`** - Adding missing tests or correcting existing tests

## Scope Rules

- Scope is **OPTIONAL** but **RECOMMENDED** for context
- Scope MUST be a noun describing a section of the codebase
- Scope MUST be contained within parentheses: `feat(parser):`
- Examples: `(api)`, `(auth)`, `(ui)`, `(database)`, `(parser)`, `(lang)`

## Description Rules

- Description MUST immediately follow the colon and space
- Description MUST be a short summary of code changes
- Use **imperative mood** (e.g., "add", "fix", "update", not "added", "fixed", "updated")
- **Lowercase** the first letter
- **No period** at the end
- Keep it under **50 characters** when possible

## Breaking Changes

### Method 1: Using `!` (Recommended)

```
feat!: send email notification when product ships
feat(api)!: remove deprecated v1 endpoints
```

### Method 2: Using Footer

```
feat: add new authentication system

BREAKING CHANGE: previous auth tokens are no longer valid
```

### Method 3: Both (for critical changes)

```
chore!: drop support for Node 16

BREAKING CHANGE: minimum Node.js version is now 18
```

## Body Guidelines

- Body is **OPTIONAL**
- MUST begin **one blank line** after description
- Use body to explain **what** and **why**, not **how**
- Can be multiple paragraphs
- Use **imperative mood**

## Footer Guidelines

- Footers are **OPTIONAL**
- MUST begin **one blank line** after body
- Use format: `Token: value` or `Token #value`
- Common footers:
  - `BREAKING CHANGE: description`
  - `Reviewed-by: Name`
  - `Refs: #123`
  - `Fixes: #456`
  - `Co-authored-by: Name <email>`

## Examples

### Simple Feature

```
feat: add user profile avatar upload
```

### Bug Fix with Scope

```
fix(auth): resolve login redirect loop issue
```

### Breaking Change with Body

```
feat!: migrate to new API structure

Replace REST endpoints with GraphQL schema.
All existing API calls need to be updated.

BREAKING CHANGE: REST API endpoints removed in favor of GraphQL
```

### Documentation Update

```
docs: update installation instructions for pnpm
```

### Refactor with Detailed Body

```
refactor(components): extract common button styles

Create reusable Button component with variant props.
Reduces code duplication across 15 components.

Refs: #234
```

### Multiple Changes

```
feat(ui): add dark mode support

- Add theme context provider
- Implement dark/light toggle
- Update all components for theme compatibility
- Add theme persistence in localStorage

Refs: #123, #456
Co-authored-by: Jane Doe <jane@example.com>
```

## Commit Message Checklist

Before committing, ensure your message:

- [ ] Starts with correct type (`feat`, `fix`, etc.)
- [ ] Uses appropriate scope when applicable
- [ ] Has descriptive, imperative description
- [ ] Uses `!` for breaking changes
- [ ] Has proper blank lines between sections
- [ ] Body explains **why** not **how**
- [ ] Footers follow correct format
- [ ] Is under 72 characters per line
- [ ] Uses lowercase for description (except proper nouns)

## Best Practices

### DO ✅

- `feat: add user authentication system`
- `fix(api): handle null response in user endpoint`
- `docs: update README with new installation steps`
- `refactor: extract utility functions to separate module`
- `test(auth): add integration tests for login flow`

### DON'T ❌

- `Added new feature` (wrong tense)
- `Fix bug` (too vague)
- `feat: Add User Authentication System` (wrong capitalization)
- `update stuff` (no type, too vague)
- `feat: add new feature.` (has period)

## Semantic Versioning Impact

| Commit Type              | Version Bump  | Description      |
| ------------------------ | ------------- | ---------------- |
| `fix:`                   | PATCH (0.0.1) | Bug fixes        |
| `feat:`                  | MINOR (0.1.0) | New features     |
| `BREAKING CHANGE` or `!` | MAJOR (1.0.0) | Breaking changes |
| Other types              | No bump       | Internal changes |

Remember: Good commit messages are a gift to your future self and your teammates. They create a readable history that tells the story of your project's evolution.
