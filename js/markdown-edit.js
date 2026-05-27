/** @param {{ title?: string, url: string, description?: string, tags?: string[] }} resource */
export function formatResourceEntry(resource) {
  const lines = [];
  if (resource.title?.trim()) {
    lines.push(`- [${resource.title.trim()}](${resource.url.trim()})`);
  } else {
    lines.push(`- ${resource.url.trim()}`);
  }
  if (resource.description?.trim()) {
    lines.push(`  ${resource.description.trim()}`);
  }
  if (resource.tags?.length) {
    lines.push(`  tags: ${resource.tags.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Insert a resource block under ## subsection (or after # if General / missing).
 */
export function insertResourceIntoMarkdown(content, subsectionName, entryBlock) {
  const lines = content.split('\n');
  const name = subsectionName.trim();
  const isGeneral = !name || name === 'General';

  if (isGeneral) {
    const h1Idx = lines.findIndex((l) => /^#\s+/.test(l));
    let insertAt = lines.length;
    for (let i = (h1Idx >= 0 ? h1Idx : 0) + 1; i < lines.length; i++) {
      if (/^##\s+/.test(lines[i])) {
        insertAt = i;
        break;
      }
    }
    const block = entryBlock.split('\n');
    lines.splice(insertAt, 0, '', ...block, '');
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  const header = `## ${name}`;
  let subIdx = lines.findIndex((l) => l.trim().toLowerCase() === header.toLowerCase());

  if (subIdx === -1) {
    return `${content.trimEnd()}\n\n${header}\n\n${entryBlock}\n`;
  }

  let insertAt = lines.length;
  for (let i = subIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      insertAt = i;
      break;
    }
  }

  const block = entryBlock.split('\n');
  lines.splice(insertAt, 0, '', ...block, '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function getSubsectionNames(category) {
  const names = category.subsections.map((s) => s.name);
  return names.length ? [...new Set(names)] : ['General'];
}
