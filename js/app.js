const MANIFEST_PATH = 'resources/manifest.json';
const CATEGORIES_DIR = 'resources/categories/';
const PREVIEW_CACHE_KEY = 'resource-tracker-previews-v2';

const CATEGORY_ICONS = {
  'ai-agents': '🤖',
  llm: '🧠',
  'llm-inference': '⚡',
  rag: '📚',
  graphrag: '🕸',
  cuda: '🔧',
  kubernetes: '☸',
  pytorch: '🔥',
  'computer-vision': '👁',
  'deep-learning': '📊',
  'distributed-system': '🌐',
  'system-design': '🏗',
  github: '⌘',
  linkedin: 'in',
  default: '🔗',
};

/** @typedef {{ title: string, url: string, description?: string, tags?: string[] }} Resource */
/** @typedef {{ name: string, slug: string, resources: Resource[] }} Subsection */
/** @typedef {{ name: string, slug: string, subsections: Subsection[], resources: Resource[] }} Category */

/**
 * Parse a category markdown file:
 *
 * # Category Name
 * ## Subsection (optional)
 * - [Title](url)
 *   description
 *   tags: a, b
 * - https://bare-url.com
 */
function parseCategoryMarkdown(text) {
  let categoryName = '';
  const subsections = [];
  let currentSub = null;

  const ensureSub = (name) => {
    if (!currentSub || currentSub.name !== name) {
      currentSub = { name, slug: slugify(name), resources: [] };
      subsections.push(currentSub);
    }
    return currentSub;
  };

  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      categoryName = h1[1].trim();
      i++;
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      currentSub = null;
      ensureSub(h2[1].trim());
      i++;
      continue;
    }

    const linkMatch = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s*(.*)$/);
    const urlMatch = line.match(/^-\s+(https?:\/\/\S+)\s*(.*)$/);
    const bareUrl = line.match(/^(?:-\s*)?(https?:\/\/\S+)\s*$/);

    if (linkMatch || urlMatch || bareUrl) {
      if (!currentSub) ensureSub('General');

      let title, url, inlineDesc;
      if (linkMatch) {
        [, title, url, inlineDesc] = linkMatch;
      } else if (urlMatch) {
        url = urlMatch[1];
        title = '';
        inlineDesc = urlMatch[2] || '';
      } else {
        url = bareUrl[1];
        title = '';
        inlineDesc = '';
      }

      const resource = {
        title: title.trim(),
        url: url.trim(),
        description: inlineDesc.trim() || undefined,
        tags: [],
      };

      i++;
      while (i < lines.length && /^\s{2,}/.test(lines[i]) && !lines[i].match(/^[-#]/)) {
        const extra = lines[i].trim();
        const tagsMatch = extra.match(/^tags?:\s*(.+)$/i);
        if (tagsMatch) {
          resource.tags = tagsMatch[1].split(',').map((t) => t.trim()).filter(Boolean);
        } else if (extra && !resource.description) {
          resource.description = extra;
        } else if (extra) {
          resource.description += ' ' + extra;
        }
        i++;
      }

      currentSub.resources.push(resource);
      continue;
    }

    i++;
  }

  const resources = subsections.flatMap((s) => s.resources);

  return {
    name: categoryName,
    slug: slugify(categoryName),
    subsections,
    resources,
  };
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0];
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v') || u.pathname.split('/').pop();
    }
  } catch {
    /* ignore */
  }
  return null;
}

function getGitHubRepo(url) {
  try {
    const m = new URL(url).pathname.match(/^\/([^/]+\/[^/]+)/);
    return m ? m[1].replace(/\.git$/, '') : null;
  } catch {
    return null;
  }
}

function loadPreviewCache() {
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePreviewCache(cache) {
  try {
    localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

async function fetchPreview(url, cache) {
  if (cache[url]) return cache[url];

  const ytId = getYouTubeId(url);
  if (ytId) {
    const preview = {
      title: null,
      description: null,
      image: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      domain: 'youtube.com',
    };
    cache[url] = preview;
    return preview;
  }

  const ghRepo = getGitHubRepo(url);
  if (ghRepo && url.includes('github.com')) {
    try {
      const res = await fetch(`https://api.github.com/repos/${ghRepo}`);
      if (res.ok) {
        const data = await res.json();
        const preview = {
          title: data.full_name,
          description: data.description || '',
          image: data.owner?.avatar_url,
          domain: 'github.com',
        };
        cache[url] = preview;
        return preview;
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl);
    if (res.ok) {
      const { data } = await res.json();
      const preview = {
        title: data.title || null,
        description: data.description || null,
        image: data.image?.url || data.logo?.url || null,
        domain: data.publisher || getDomain(url),
      };
      cache[url] = preview;
      return preview;
    }
  } catch {
    /* network */
  }

  return {
    title: null,
    description: null,
    image: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(getDomain(url))}&sz=128`,
    domain: getDomain(url),
  };
}

function iconForCategory(slug) {
  if (CATEGORY_ICONS[slug]) return CATEGORY_ICONS[slug];
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (slug.includes(key)) return icon;
  }
  return CATEGORY_ICONS.default;
}

function createCard(resource, preview) {
  const title = resource.title || preview?.title || getDomain(resource.url);
  const desc = resource.description || preview?.description || '';
  const domain = preview?.domain || getDomain(resource.url);
  const image = preview?.image;
  const isFaviconOnly = image?.includes('favicons');

  const card = document.createElement('a');
  card.className = 'card';
  card.href = resource.url;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  const previewEl = document.createElement('div');
  previewEl.className = 'card-preview';

  if (image && !isFaviconOnly) {
    const img = document.createElement('img');
    img.src = image;
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = () => {
      img.remove();
      showPlaceholder(previewEl);
    };
    previewEl.appendChild(img);
  } else if (image && isFaviconOnly) {
    previewEl.style.display = 'flex';
    previewEl.style.alignItems = 'center';
    previewEl.style.justifyContent = 'center';
    previewEl.style.background = 'var(--accent-soft)';
    const img = document.createElement('img');
    img.src = image;
    img.alt = '';
    img.style.width = '64px';
    img.style.height = '64px';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '8px';
    previewEl.appendChild(img);
  } else {
    showPlaceholder(previewEl);
  }

  const body = document.createElement('div');
  body.className = 'card-body';
  body.innerHTML = `
    <span class="card-domain">${escapeHtml(domain)}</span>
    <h3 class="card-title">${escapeHtml(title)}</h3>
    ${desc ? `<p class="card-desc">${escapeHtml(desc)}</p>` : ''}
    ${resource.tags?.length ? `<div class="card-tags">${resource.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  `;

  card.append(previewEl, body);
  return card;
}

function showPlaceholder(el) {
  const ph = document.createElement('span');
  ph.className = 'placeholder';
  ph.textContent = '🔗';
  el.appendChild(ph);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function filterCategory(cat, query) {
  const q = query.trim().toLowerCase();
  if (!q) return cat;

  const subsections = cat.subsections
    .map((sub) => ({
      ...sub,
      resources: sub.resources.filter((r) => {
        const hay = [r.title, r.url, r.description, sub.name, ...(r.tags || [])]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      }),
    }))
    .filter((sub) => sub.resources.length > 0);

  const resources = subsections.flatMap((s) => s.resources);
  return { ...cat, subsections, resources };
}

function render(categories, activeSlug, query) {
  const content = document.getElementById('content');
  const nav = document.getElementById('categories');
  content.innerHTML = '';
  nav.innerHTML = '';

  const filtered = categories
    .map((cat) => filterCategory(cat, query))
    .filter((cat) => cat.resources.length > 0);

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `cat-btn${!activeSlug ? ' active' : ''}`;
  allBtn.textContent = 'All';
  allBtn.dataset.slug = '';
  nav.appendChild(allBtn);

  for (const cat of categories) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cat-btn${activeSlug === cat.slug ? ' active' : ''}`;
    btn.dataset.slug = cat.slug;
    btn.innerHTML = `${escapeHtml(cat.name)} <span class="count">${cat.resources.length}</span>`;
    nav.appendChild(btn);
  }

  const toShow = activeSlug
    ? filtered.filter((c) => c.slug === activeSlug)
    : filtered;

  if (toShow.length === 0) {
    content.innerHTML = '<p class="empty-state">No resources match your search.</p>';
    return;
  }

  for (const cat of toShow) {
    const section = document.createElement('section');
    section.className = 'section';
    section.id = cat.slug;

    const subsectionsHtml = cat.subsections
      .filter((sub) => sub.resources.length > 0)
      .map(
        (sub) => `
        <div class="subsection" data-cat="${cat.slug}" data-sub="${sub.slug}">
          ${sub.name !== 'General' ? `<h3 class="subsection-title">${escapeHtml(sub.name)}</h3>` : ''}
          <div class="card-grid" data-cat="${cat.slug}" data-sub="${sub.slug}"></div>
        </div>`
      )
      .join('');

    section.innerHTML = `
      <div class="section-header">
        <span class="section-icon">${iconForCategory(cat.slug)}</span>
        <h2 class="section-title">${escapeHtml(cat.name)}</h2>
        <span class="section-count">${cat.resources.length} link${cat.resources.length === 1 ? '' : 's'}</span>
      </div>
      ${subsectionsHtml}
    `;

    content.appendChild(section);
  }
}

async function hydratePreviews(categories) {
  const cache = loadPreviewCache();
  const tasks = [];

  for (const cat of categories) {
    for (const sub of cat.subsections) {
      for (const resource of sub.resources) {
        tasks.push(
          fetchPreview(resource.url, cache).then((preview) => ({
            cat: cat.slug,
            sub: sub.slug,
            resource,
            preview,
          }))
        );
      }
    }
  }

  const results = await Promise.all(tasks);
  savePreviewCache(cache);

  const grids = new Set();
  for (const { cat, sub, resource, preview } of results) {
    const grid = document.querySelector(
      `.card-grid[data-cat="${cat}"][data-sub="${sub}"]`
    );
    if (!grid) continue;
    const key = `${cat}:${sub}`;
    if (!grids.has(key)) {
      grid.innerHTML = '';
      grids.add(key);
    }
    grid.appendChild(createCard(resource, preview));
  }
}

async function loadAllCategories() {
  const manifestRes = await fetch(MANIFEST_PATH);
  if (!manifestRes.ok) {
    throw new Error(`Could not load ${MANIFEST_PATH} (${manifestRes.status})`);
  }
  const { categories: manifest } = await manifestRes.json();

  const loaded = await Promise.all(
    manifest.map(async (entry) => {
      const res = await fetch(`${CATEGORIES_DIR}${entry.file}`);
      if (!res.ok) throw new Error(`Could not load ${entry.file} (${res.status})`);
      const text = await res.text();
      return parseCategoryMarkdown(text);
    })
  );

  return loaded.filter((c) => c.resources.length > 0);
}

let categoriesData = [];
let activeCategory = '';

async function init() {
  const loading = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const content = document.getElementById('content');

  try {
    categoriesData = await loadAllCategories();

    if (categoriesData.length === 0) {
      throw new Error('No categories found. Add a file under resources/categories/');
    }

    loading.classList.add('hidden');
    content.classList.remove('hidden');

    const searchInput = document.getElementById('search');
    const doRender = () => {
      render(categoriesData, activeCategory, searchInput.value);
      hydratePreviews(
        activeCategory
          ? categoriesData.filter((c) => c.slug === activeCategory)
          : categoriesData
      );
    };

    doRender();

    document.getElementById('categories').addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-btn');
      if (!btn) return;
      activeCategory = btn.dataset.slug || '';
      doRender();
      if (activeCategory) {
        document.getElementById(activeCategory)?.scrollIntoView({ behavior: 'smooth' });
      }
    });

    searchInput.addEventListener('input', doRender);
  } catch (err) {
    loading.classList.add('hidden');
    errorEl.textContent = err.message || 'Failed to load resources.';
    errorEl.classList.remove('hidden');
  }
}

init();
