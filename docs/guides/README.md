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
