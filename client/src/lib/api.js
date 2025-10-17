export async function postJSON(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export const generatePrompt = (paragraph, style, bypassCache = false) =>
  postJSON('/api/generate-prompt', { paragraph, style, bypassCache });

export const generateImage = (scenePrompt, style) =>
  postJSON('/api/generate-image', { scenePrompt, style });
