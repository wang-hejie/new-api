# Built-in Guide Documents

Files in this directory are embedded into the application and exposed through the built-in docs page.

Add public guide documents as Markdown files directly under `docs/guides/`. Each public file should use frontmatter:

```yaml
---
slug: example-guide
title: Example Guide
order: 100
category: General
---
```

Rules:

- `slug` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- `title` is shown in the docs navigation.
- `category` groups documents in the navigation; missing values fall back to `通用`.
- `order` sorts documents inside a category; missing values fall back to `1000`.
- `README.md`, `README.*.md`, and Markdown files whose names start with `_` are maintainer files and are not listed publicly.

API guide organization:

- Prefer one operation page for each primary API endpoint. Keep overview pages short and avoid placing many SDK examples there.
- Structure operation pages around `Authorizations`, the method/path heading, request body, success response, errors, and usage notes.
- Mark the main request and response fenced code blocks with meta such as `request`, `response`, `method=POST`, `path="/v1/..."`, `status=200`, and `title="..."`. The docs UI can use this metadata to select the right-side request/response example cards.
- Put SDK and curl cookbook snippets in a separate examples page, and mark those fenced code blocks as `example` so they are not treated as primary operation examples.
