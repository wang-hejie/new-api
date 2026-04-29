# gpt-image-2 Playground E2E

This suite implements the root `plan.md` integration-test plan for the `gpt-image-2` playground generations/edits feature.

Run from `web/`:

```bash
NEW_API_BASE_URL=http://127.0.0.1:9991 bunx playwright test ../scripts/e2e/gpt-image-2 --reporter=list
```
