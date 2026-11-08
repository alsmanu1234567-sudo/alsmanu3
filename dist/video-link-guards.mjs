const ALLOWED_VIDEO_HOST = "ara.thexh.live";
const VIDEO_PAGE_PATH = /^\/videos\/[^/]+\/?$/;

export function getAllowedVideoPageUrl(text) {
  if (typeof text !== "string") return null;

  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  if (matches.length !== 1) return null;

  const candidate = matches[0].replace(/[)\]}>.,;!?،؛]+$/g, "");
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== ALLOWED_VIDEO_HOST ||
    url.port !== "" ||
    url.username ||
    url.password ||
    !VIDEO_PAGE_PATH.test(url.pathname)
  ) {
    return null;
  }

  url.hash = "";
  return url.href;
}

export function isAllowedLinkVideoGroup(settings, jid) {
  return Boolean(
    settings?.linkVideoEnabled !== false &&
    jid?.endsWith("@g.us") &&
    settings?.linkVideoGroupJid &&
    settings.linkVideoGroupJid === jid
  );
}

function normalizeJid(value) {
  const jid = String(value || "").trim();
  if (!jid) return "";
  const at = jid.indexOf("@");
  if (at < 0) return `${jid.split(":")[0]}@s.whatsapp.net`;
  return `${jid.slice(0, at).split(":")[0]}@${jid.slice(at + 1)}`;
}

export function isSoloWhatsAppGroup(metadata, socket) {
  const participants = metadata?.participants;
  if (!Array.isArray(participants) || participants.length !== 1) return false;

  const selfIds = [
    socket?.user?.id,
    socket?.user?.lid,
    socket?.authState?.creds?.me?.id,
    socket?.authState?.creds?.me?.lid,
  ]
    .map(normalizeJid)
    .filter(Boolean);
  const onlyParticipant = normalizeJid(participants[0]?.id);

  return Boolean(onlyParticipant && selfIds.includes(onlyParticipant));
}
