const TOKEN_KEY = 'resource-tracker-gh-token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
  };
}

function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export async function fetchFileFromGitHub(config, token, filePath) {
  const { owner, repo, branch } = config.github;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error (${res.status})`);
  }
  const data = await res.json();
  const content = new TextDecoder().decode(
    Uint8Array.from(atob(data.content.replace(/\n/g, '')), (c) => c.charCodeAt(0))
  );
  return { content, sha: data.sha };
}

export async function saveFileToGitHub(config, token, filePath, content, sha, message) {
  const { owner, repo, branch } = config.github;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: toBase64Utf8(content),
      sha,
      branch,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to save (${res.status})`);
  }
  return res.json();
}

export async function verifyToken(config, token) {
  const res = await fetch(
    `https://api.github.com/repos/${config.github.owner}/${config.github.repo}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error('Token cannot access this repository. Needs repo contents write access.');
  return true;
}
