import {
  formatResourceEntry,
  insertResourceIntoMarkdown,
  getSubsectionNames,
} from './markdown-edit.js';
import {
  getStoredToken,
  setStoredToken,
  fetchFileFromGitHub,
  saveFileToGitHub,
  verifyToken,
} from './github-save.js';

const CATEGORIES_DIR = 'resources/categories/';

export function initAddResource({ categories, manifest, config, onSaved }) {
  const modal = document.getElementById('add-modal');
  const form = document.getElementById('add-form');
  const openBtn = document.getElementById('add-resource-btn');
  const closeBtn = document.getElementById('add-modal-close');
  const cancelBtn = document.getElementById('add-cancel-btn');
  const backdrop = document.getElementById('add-modal-backdrop');
  const categorySelect = document.getElementById('add-category');
  const subcategorySelect = document.getElementById('add-subcategory');
  const newSubWrap = document.getElementById('new-subcategory-wrap');
  const newSubInput = document.getElementById('add-new-subcategory');
  const newSubCheck = document.getElementById('add-new-subcategory-check');
  const tokenInput = document.getElementById('gh-token-input');
  const tokenSaveBtn = document.getElementById('gh-token-save');
  const tokenStatus = document.getElementById('gh-token-status');
  const submitBtn = document.getElementById('add-submit-btn');
  const formError = document.getElementById('add-form-error');
  const formSuccess = document.getElementById('add-form-success');

  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const fileBySlug = new Map(manifest.map((m) => [slugify(m.name), m.file]));
  categories.forEach((c) => {
    c.file = c.file || fileBySlug.get(c.slug);
  });

  function openModal() {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    populateCategories();
    updateTokenStatus();
    formError.textContent = '';
    formSuccess.textContent = '';
  }

  function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    form.reset();
    newSubWrap.classList.add('hidden');
    subcategorySelect.disabled = false;
  }

  function populateCategories() {
    categorySelect.innerHTML = categories
      .map(
        (c) =>
          `<option value="${c.slug}">${escapeAttr(c.name)}</option>`
      )
      .join('');
    onCategoryChange();
  }

  function onCategoryChange() {
    const cat = categories.find((c) => c.slug === categorySelect.value);
    if (!cat) return;

    const subs = getSubsectionNames(cat);
    subcategorySelect.innerHTML = subs
      .map((s) => `<option value="${escapeAttr(s)}">${escapeAttr(s)}</option>`)
      .join('');

  }

  function onNewSubToggle() {
    const useNew = newSubCheck.checked;
    newSubWrap.classList.toggle('hidden', !useNew);
    subcategorySelect.disabled = useNew;
    if (useNew) newSubInput.focus();
  }

  function updateTokenStatus() {
    const token = getStoredToken();
    if (token) {
      tokenStatus.textContent = 'GitHub connected — links save to your repo.';
      tokenStatus.className = 'token-status connected';
      tokenInput.placeholder = '••••••••••••••••';
    } else {
      tokenStatus.textContent = 'Connect GitHub once to save links permanently.';
      tokenStatus.className = 'token-status';
      tokenInput.placeholder = 'Paste Personal Access Token';
    }
  }

  function escapeAttr(s) {
    return s.replace(/"/g, '&quot;');
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  categorySelect.addEventListener('change', onCategoryChange);
  newSubCheck.addEventListener('change', onNewSubToggle);

  tokenSaveBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim() || getStoredToken();
    if (!token) {
      formError.textContent = 'Enter a GitHub token first.';
      return;
    }
    tokenSaveBtn.disabled = true;
    formError.textContent = '';
    try {
      await verifyToken(config, token);
      setStoredToken(token);
      tokenInput.value = '';
      updateTokenStatus();
      formSuccess.textContent = 'GitHub connected successfully.';
    } catch (e) {
      formError.textContent = e.message;
    } finally {
      tokenSaveBtn.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';
    formSuccess.textContent = '';

    const url = document.getElementById('add-url').value.trim();
    const title = document.getElementById('add-title').value.trim();
    const description = document.getElementById('add-description').value.trim();
    const tagsRaw = document.getElementById('add-tags').value.trim();

    if (!url || !/^https?:\/\//i.test(url)) {
      formError.textContent = 'Enter a valid URL starting with http:// or https://';
      return;
    }

    const cat = categories.find((c) => c.slug === categorySelect.value);
    if (!cat?.file) {
      formError.textContent = 'Category file not found.';
      return;
    }

    let subsection = subcategorySelect.value;
    if (newSubCheck.checked) {
      subsection = newSubInput.value.trim();
      if (!subsection) {
        formError.textContent = 'Enter a name for the new subcategory.';
        return;
      }
    }

    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const entry = formatResourceEntry({ title, url, description, tags });
    const filePath = `${CATEGORIES_DIR}${cat.file}`;
    const token = getStoredToken();

    if (!token) {
      formError.textContent =
        'Connect GitHub below to save permanently, or copy the snippet and add it manually.';
      await navigator.clipboard.writeText(
        `## ${subsection}\n\n${entry}`
      ).catch(() => {});
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const { content, sha } = await fetchFileFromGitHub(config, token, filePath);
      const updated = insertResourceIntoMarkdown(content, subsection, entry);
      await saveFileToGitHub(
        config,
        token,
        filePath,
        updated,
        sha,
        `Add resource to ${cat.name} › ${subsection}`
      );
      formSuccess.textContent = 'Saved! Site will update in ~1 minute after deploy.';
      form.reset();
      newSubWrap.classList.add('hidden');
      newSubCheck.checked = false;
      subcategorySelect.disabled = false;
      setTimeout(() => {
        closeModal();
        onSaved();
      }, 1200);
    } catch (err) {
      formError.textContent = err.message || 'Failed to save.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add link';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });
}
