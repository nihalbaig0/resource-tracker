# Moved to category files

Resources now live in **`resources/categories/`** — one markdown file per topic.

See `resources/manifest.json` for the list. To add a new category:

1. Copy `resources/categories/_template.md` → `your-topic.md`
2. Add an entry to `resources/manifest.json`
3. Refresh the site

To re-import from `resource.md` at the project root:

```bash
node scripts/build-resources.mjs
```
