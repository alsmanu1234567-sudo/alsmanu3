// dist/handlers/github-handler.mjs
// Domain: GitHub — gh_* callbacks + github text input (dev only)

export const pluginManifest = {
  name: 'github',
  version: '1.0.0',
  type: 'handler',
  description: 'مزامنة GitHub: gh_* callbacks + dev text input',
  textOrder: 18,
  cbOrder: 17,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  // GitHub text input يُعالَج في text-handler.mjs كـ early handler
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (data.startsWith('gh_') || data === 'dev_github') {
    const { handleGithubCallback } = await _deps._mod_github();
    await handleGithubCallback(bot, chatId, userId, data);
    return true;
  }

  return false;
}
