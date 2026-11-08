// dist/services/groups/group-compare-service.mjs
// Phase 9: Service Layer Extraction
// SRP: تحليل بيانات مجموعات واتساب (الأعضاء، المقارنة)
// Extracted from: state-switch-handler.mjs (awaiting_bridge_active_group, awaiting_bridge_compare_g2)
// لا تعتمد على dist/index.mjs — جميع الاعتماديات تُمرَّر كمعاملات

/**
 * جلب أعضاء مجموعة واتساب عبر Baileys socket
 * @param {object} sock - Baileys socket
 * @param {string} groupId - معرّف المجموعة (JID)
 * @returns {Array} قائمة المشاركين
 */
export async function getGroupMembers(sock, groupId) {
  const meta = await sock.groupMetadata?.(groupId);
  return (meta?.participants || []);
}

/**
 * مقارنة عضوية مجموعتَي واتساب
 * @param {object} sock - Baileys socket
 * @param {string} groupId1 - معرّف المجموعة الأولى
 * @param {string} groupId2 - معرّف المجموعة الثانية
 * @returns {{ common: string[], only1: string[], only2: string[] }}
 */
export async function compareGroups(sock, groupId1, groupId2) {
  const [m1, m2] = await Promise.all([
    sock.groupMetadata?.(groupId1),
    sock.groupMetadata?.(groupId2),
  ]);
  const ids1 = new Set((m1?.participants || []).map(p => p.id));
  const ids2 = new Set((m2?.participants || []).map(p => p.id));
  const common = [...ids1].filter(id => ids2.has(id));
  const only1  = [...ids1].filter(id => !ids2.has(id));
  const only2  = [...ids2].filter(id => !ids1.has(id));
  return { common, only1, only2 };
}

/**
 * تنسيق قائمة أعضاء لعرضها في تيليجرام
 * @param {Array} members - قائمة المشاركين
 * @param {number} maxDisplay - الحد الأقصى للعرض
 * @returns {string}
 */
export function formatMembersList(members, maxDisplay = 20) {
  const displayed = members.slice(0, maxDisplay);
  const remaining = members.length - maxDisplay;
  let text = displayed.map(p => `• +${p.id.split('@')[0]}`).join('\n');
  if (remaining > 0) text += `\n... و ${remaining} آخرين`;
  return text;
}
