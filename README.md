# Resource Tracker

A static site for your saved links (LinkedIn, blogs, GitHub repos, courses). One markdown file per category — no backend. Deploy on GitHub Pages.

## Your resources (62 links, 16 categories)

Imported from `resource.md` into `resources/categories/`:

| Category | File |
|----------|------|
| AI Agents | `ai-agents.md` |
| LLM | `llm.md` |
| LLM Inference | `llm-inference.md` |
| RAG, GraphRAG, CUDA, … | see `resources/manifest.json` |

## Add links from the website

Click **Add link** in the header:

1. Paste the URL (title optional — auto-detected for Medium, GitHub, etc.)
2. Pick **Category** and **Subcategory** (Blogs, Projects, …)
3. Check **Create new subcategory** to add a new `##` section
4. Click **Connect** once with a [GitHub Personal Access Token](https://github.com/settings/tokens/new?scopes=repo&description=Resource%20Tracker) (`repo` scope)
5. **Add link** — saves directly to your repo and redeploys via GitHub Actions

## Add links to an existing category (manual)

Open the matching file, e.g. `resources/categories/llm.md`:

```markdown
# LLM

## Blogs

- [Flash Attention explainer](https://medium.com/...)
  Optional note
  tags: attention, gpu

- https://new-article.com
```

Use `## Subsection` for groups (Blogs, Projects, Learning Resources, etc.).

## Add a new category

1. Copy `resources/categories/_template.md` → `my-topic.md`
2. Edit the `#` title and add links
3. Register it in `resources/manifest.json`:

```json
{
  "name": "My Topic",
  "file": "my-topic.md",
  "count": 0
}
```

(`count` is informational only.)

4. Refresh the site.

## Re-import from resource.md

If you edit the master `resource.md` and want to regenerate all category files:

```bash
node scripts/build-resources.mjs
```

This overwrites files in `resources/categories/` and updates `manifest.json`.

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy to GitHub Pages

1. Push to GitHub
2. **Settings → Pages** → branch `main`, folder `/ (root)`
3. Site: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## Structure

```
resources/
  manifest.json          ← category list & order
  categories/
    ai-agents.md         ← one topic per file
    llm.md
    _template.md
resource.md              ← optional master list (run build script)
```
