// dist/my-msgs.mjs — قسم رسائلي مفصول عن الحزمة الرئيسية

import {
  resolveActiveNumber,
  getNumberSettings,
  setNumberSettings,
} from './lib/number-profiles.mjs';

let _deps = {};

export function setDeps(d) { _deps = d; }

const DEFAULTS = {
  profilePicCmd: "/mg",
  exportMembersCmd: "/gm",
  copyCmd: "/copy",
  imgCmd: "/img",
  vidCmd: "/vid",
  tiktokCmd: "/tiktok",
  songCmd: "/song",
  aiCmd: "/ai",
  delCmd: "/del",
  aiImgCmd: "/\u0635\u0648\u0631\u0629",
  filmCmd: "/film",
  statusCopyCmd: "/\u062D\u0627\u0644\u0629",
  statusAutoSave: false,
  profilePicEnabled: true,
  exportMembersEnabled: true,
  copyEnabled: true,
  imgEnabled: true,
  vidEnabled: true,
  tiktokEnabled: true,
  songEnabled: true,
  aiEnabled: true,
  delEnabled: true,
  aiImgEnabled: true,
  filmEnabled: true,
  statusCopyEnabled: true,
  statusAutoSave: false,
  codEnabled: true,
  tagEnabled: false,
  tagCmd: "!tag",
  sttEnabled: true,
  sttCmd: "/\u0646\u0635",
  ttsEnabled: true,
  ttsCmd: "/\u0635\u0648\u062A",
  locateCmd: "/locate",
  locateEnabled: false,
  linkVideoEnabled: true,
  linkVideoGroupJid: null,
};

export function getMyMsgsSettings(user) {
  // حاول القراءة من إعدادات الرقم النشط أولًا
  const activeNum = resolveActiveNumber(user);
  if (activeNum) {
    const numSettings = getNumberSettings(user, activeNum);
    if (numSettings !== null) {
      return { ...DEFAULTS, ...numSettings };
    }
    // الرقم موجود لكن إعداداته فارغة:
    // ترحيل لمرة واحدة — انقل الإعدادات العامة القديمة للرقم ثم احذفها
    // (نتحقق أن myMsgsSettings ليست فارغة كي لا يُعاد الترحيل)
    const legacy = user.myMsgsSettings;
    if (legacy && typeof legacy === 'object' && Object.keys(legacy).length > 0) {
      setNumberSettings(user, activeNum, legacy);
      // ضع {} لتعطيل إعادة الترحيل مستقبلاً (لن يحمل بعد الآن قيمًا)
      user.myMsgsSettings = {};
      try {
        _deps.saveUser(user.telegramId, {
          whatsappNumbers: user.whatsappNumbers,
          myMsgsSettings: {},
        });
      } catch {}
      return { ...DEFAULTS, ...legacy };
    }
  }
  // Fallback: لا رقم نشط أو لا رقم مربوط → إعدادات افتراضية فقط
  return { ...DEFAULTS };
}

/**
 * [HOTFIX-MULTINUM] اقرأ إعدادات "رسائلي" لرقم مُحدَّد صراحةً بدل الاعتماد على
 * "الرقم النشط" العالمي في تيليجرام — يُستخدم عند معالجة رسالة واردة فعلياً على
 * سوكت رقم بعينه، حتى لا يُستبدَل سلوك الرقم الأول بإعدادات آخر رقم رُبط.
 */
export function getMyMsgsSettingsForNumber(user, phoneNumber) {
  if (!phoneNumber) return { ...DEFAULTS };
  const numSettings = getNumberSettings(user, phoneNumber);
  if (numSettings !== null) {
    return { ...DEFAULTS, ...numSettings };
  }
  // ترحيل لمرة واحدة من الإعدادات العامة القديمة — فقط إذا هذا هو الرقم الوحيد المرتبط
  // (تجنّباً لنسخ إعدادات رقم على رقم آخر خطأً عند وجود أرقام متعددة)
  const nums = user.whatsappNumbers || [];
  if (nums.length === 1 && nums[0].number === phoneNumber) {
    const legacy = user.myMsgsSettings;
    if (legacy && typeof legacy === 'object' && Object.keys(legacy).length > 0) {
      setNumberSettings(user, phoneNumber, legacy);
      user.myMsgsSettings = {};
      try {
        _deps.saveUser(user.telegramId, {
          whatsappNumbers: user.whatsappNumbers,
          myMsgsSettings: {},
        });
      } catch {}
      return { ...DEFAULTS, ...legacy };
    }
  }
  return { ...DEFAULTS };
}

export function saveMyMsgsSettings(userId, settings) {
  const user = _deps.getUser(userId);
  const updated = { ...getMyMsgsSettings(user), ...settings };
  const activeNum = resolveActiveNumber(user);
  if (activeNum) {
    // تحقق أن الرقم النشط موجود فعلاً في المصفوفة قبل الحفظ
    const entry = (user.whatsappNumbers || []).find(n => n.number === activeNum);
    if (entry) {
      setNumberSettings(user, activeNum, updated);
      _deps.saveUser(userId, { whatsappNumbers: user.whatsappNumbers });
      return updated;
    }
    // الرقم النشط لم يُعد صالحًا (حُذف بعد الاختيار) → Fallback آمن
  }
  // Fallback: لا رقم نشط أو لا رقم صالح → تجاهل الحفظ بدل الضياع الصامت
  // (في حالة غير متوقعة فقط)
  return updated;
}

export function saveMyMsgsSettingsForNumber(userId, phoneNumber, settings) {
  const user = _deps.getUser(userId);
  if (!user || !phoneNumber) return null;
  const entry = (user.whatsappNumbers || []).find((n) => n.number === phoneNumber);
  if (!entry) return null;
  const updated = { ...getMyMsgsSettingsForNumber(user, phoneNumber), ...settings };
  setNumberSettings(user, phoneNumber, updated);
  _deps.saveUser(userId, { whatsappNumbers: user.whatsappNumbers });
  return updated;
}

export function myMsgsMenuKeyboard(s) {
  const f = (en, name, cd) => ({ text: `${en ? "\uD83D\uDFE2" : "\uD83D\uDD34"} ${name}`, callback_data: cd });
  return {
    inline_keyboard: [
      [f(s.profilePicEnabled, "\uD83D\uDCF8 \u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644", "mymsgs_show_pic"), f(s.exportMembersEnabled, "\uD83D\uDC65 \u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0623\u0639\u0636\u0627\u0621", "mymsgs_show_gm")],
      [f(s.copyEnabled, "\uD83D\uDD04 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644", "mymsgs_show_copy"), f(s.imgEnabled, "\uD83D\uDDBC\uFE0F \u0628\u062D\u062B \u0635\u0648\u0631", "mymsgs_show_img")],
      [f(s.vidEnabled, "\uD83C\uDFAC \u0641\u064A\u062F\u064A\u0648 \u064A\u0648\u062A\u064A\u0648\u0628", "mymsgs_show_vid"), f(s.tiktokEnabled, "\uD83D\uDCF1 \u062A\u064A\u0643 \u062A\u0648\u0643", "mymsgs_show_tiktok")],
      [f(s.linkVideoEnabled, "تنزيل فيديوهات من رابط", "mymsgs_show_linkvid")],
      [f(s.songEnabled, "\uD83C\uDFB5 \u0623\u063A\u0627\u0646\u064A", "mymsgs_show_song"), f(s.filmEnabled, "\uD83C\uDFA5 \u062A\u0646\u0632\u064A\u0644 \u0641\u064A\u0644\u0645", "mymsgs_show_film")],
      [f(s.aiEnabled, "\uD83E\uDD16 \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A", "mymsgs_show_ai"), f(s.aiImgEnabled, "\uD83C\uDFA8 \u062A\u0648\u0644\u064A\u062F \u0635\u0648\u0631\u0629 AI", "mymsgs_show_aiimg")],
      [f(s.delEnabled, "\uD83D\uDDD1\uFE0F \u062D\u0630\u0641 \u0627\u0644\u0631\u0633\u0627\u0626\u0644", "mymsgs_show_del"), f(s.statusCopyEnabled, "\uD83D\uDCF2 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629", "mymsgs_show_statuscp")],
      [f(s.statusAutoSave ?? false, "\uD83D\uDCBE \u062D\u0641\u0638 \u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0644\u062D\u0627\u0644\u0627\u062A", "mymsgs_show_statusas")],
      [f(s.spamEnabled ?? false, "\uD83D\uDCA3 \u0633\u0628\u0627\u0645/\u0641\u0644\u0648\u062F", "mymsgs_show_spam"), f(s.weatherEnabled ?? false, "\uD83C\uDF24\uFE0F \u0637\u0642\u0633", "mymsgs_show_weather")],
      [f(s.translateEnabled ?? false, "\uD83C\uDF10 \u062A\u0631\u062C\u0645\u0629", "mymsgs_show_translate"), f(s.jokeEnabled ?? false, "\uD83D\uDE02 \u0646\u0643\u062A\u0629", "mymsgs_show_joke")],
      [f(s.fortuneEnabled ?? false, "\u2728 \u062D\u0638\u0643 \u0627\u0644\u064A\u0648\u0645", "mymsgs_show_fortune"), f(s.wikiEnabled ?? false, "\uD83D\uDCDA \u0648\u064A\u0643\u064A\u0628\u064A\u062F\u064A\u0627", "mymsgs_show_wiki")],
      [f(s.prayerEnabled ?? false, "\uD83D\uDD4C \u0645\u0648\u0627\u0642\u064A\u062A \u0627\u0644\u0635\u0644\u0627\u0629", "mymsgs_show_prayer"), f(s.currencyEnabled ?? false, "\uD83D\uDCB1 \u062A\u062D\u0648\u064A\u0644 \u0639\u0645\u0644\u0629", "mymsgs_show_currency")],
      [f(s.stickerEnabled ?? false, "\uD83C\uDFAD \u0633\u062A\u064A\u0643\u0631", "mymsgs_show_sticker"), f(s.newsEnabled ?? false, "\uD83D\uDCF0 \u0623\u062E\u0628\u0627\u0631", "mymsgs_show_news")],
      [f(s.locateEnabled ?? false, "\uD83D\uDD75\uFE0F \u062A\u062A\u0628\u0639 \u0627\u0644\u0645\u0648\u0642\u0639", "mymsgs_show_locate"), f(s.sttEnabled ?? true, "\uD83C\uDFA4 \u0635\u0648\u062A\u2190\u0646\u0635", "mymsgs_show_stt")],
      [f(s.ttsEnabled ?? true, "\uD83D\uDD0A \u0646\u0635\u2190\u0635\u0648\u062A", "mymsgs_show_tts"), { text: "\uD83D\uDCCC \u0627\u0644\u0645\u064A\u0632\u0627\u062A \u0643\u0644\u0647\u0627", callback_data: "menu_mymsgs" }],
      [{ text: "\u{1F517} \u0631\u0645\u0632 \u0631\u0628\u0637 \u0631\u0642\u0645", callback_data: "mymsgs_show_codes" }],
      [{ text: "\u{1F512} \u0623\u062F\u0627\u0629 \u0627\u0644\u0645\u0637\u0648\u0631: \u0645\u0648\u0627\u0642\u0639 \u0645\u0624\u0642\u062A\u0629", callback_data: "mymsgs_show_sitegen" }],
      [{ text: "\u{1F517} \u0631\u0645\u0632 \u0631\u0628\u0637 \u0631\u0642\u0645", callback_data: "mymsgs_show_cod" }, { text: "\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", callback_data: "home" }]
    ]
  };
}

export function myMsgsFeatureSubMenu(s, feature) {
  const map = {
    pic:      { en: s.profilePicEnabled,         cmd: s.profilePicCmd,    name: "\uD83D\uDCF8 \u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644",   tog: "mymsgs_toggle_pic",       edit: "mymsgs_edit_pic_cmd" },
    gm:       { en: s.exportMembersEnabled,       cmd: s.exportMembersCmd, name: "\uD83D\uDC65 \u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0623\u0639\u0636\u0627\u0621",    tog: "mymsgs_toggle_gm",        edit: "mymsgs_edit_gm_cmd" },
    copy:     { en: s.copyEnabled,               cmd: s.copyCmd,          name: "\uD83D\uDD04 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644",    tog: "mymsgs_toggle_copy",      edit: "mymsgs_edit_copy_cmd" },
    img:      { en: s.imgEnabled,                cmd: s.imgCmd,           name: "\uD83D\uDDBC\uFE0F \u0628\u062D\u062B \u0635\u0648\u0631",          tog: "mymsgs_toggle_img",       edit: "mymsgs_edit_img_cmd" },
    vid:      { en: s.vidEnabled,                cmd: s.vidCmd,           name: "\uD83C\uDFAC \u0641\u064A\u062F\u064A\u0648 \u064A\u0648\u062A\u064A\u0648\u0628",     tog: "mymsgs_toggle_vid",       edit: "mymsgs_edit_vid_cmd" },
    linkvid:  { en: s.linkVideoEnabled,           cmd: null,                name: "تنزيل فيديوهات من رابط",                       tog: "mymsgs_toggle_linkvid",    edit: null },
    tiktok:   { en: s.tiktokEnabled,             cmd: s.tiktokCmd,        name: "\uD83D\uDCF1 \u062A\u064A\u0643 \u062A\u0648\u0643",           tog: "mymsgs_toggle_tiktok",    edit: "mymsgs_edit_tiktok_cmd" },
    song:     { en: s.songEnabled,               cmd: s.songCmd,          name: "\uD83C\uDFB5 \u0623\u063A\u0627\u0646\u064A",             tog: "mymsgs_toggle_song",      edit: "mymsgs_edit_song_cmd" },
    film:     { en: s.filmEnabled,               cmd: s.filmCmd,          name: "\uD83C\uDFA5 \u062A\u0646\u0632\u064A\u0644 \u0641\u064A\u0644\u0645",       tog: "mymsgs_toggle_film",      edit: "mymsgs_edit_film_cmd" },
    ai:       { en: s.aiEnabled,                 cmd: s.aiCmd,            name: "\uD83E\uDD16 \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A",     tog: "mymsgs_toggle_ai",        edit: "mymsgs_edit_ai_cmd" },
    aiimg:    { en: s.aiImgEnabled,              cmd: s.aiImgCmd,         name: "\uD83C\uDFA8 \u062A\u0648\u0644\u064A\u062F \u0635\u0648\u0631\u0629 AI",    tog: "mymsgs_toggle_aiimg",     edit: "mymsgs_edit_aiimg_cmd" },
    del:      { en: s.delEnabled,                cmd: s.delCmd,           name: "\uD83D\uDDD1\uFE0F \u062D\u0630\u0641 \u0627\u0644\u0631\u0633\u0627\u0626\u0644",      tog: "mymsgs_toggle_del",       edit: "mymsgs_edit_del_cmd" },
    statuscp: { en: s.statusCopyEnabled,         cmd: s.statusCopyCmd,    name: "\uD83D\uDCF2 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629",     tog: "mymsgs_toggle_statuscp",  edit: "mymsgs_edit_statuscp_cmd" },
    statusas: { en: s.statusAutoSave ?? false,   cmd: null,               name: "\uD83D\uDCBE \u062D\u0641\u0638 \u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0644\u062D\u0627\u0644\u0627\u062A", tog: "mymsgs_toggle_statusas",  edit: null },
    spam:     { en: s.spamEnabled ?? false,      cmd: s.spamCmd ?? "!sp", name: "\uD83D\uDCA3 \u0633\u0628\u0627\u0645/\u0641\u0644\u0648\u062F",         tog: "mymsgs_toggle_spam",      edit: "mymsgs_edit_spam_cmd" },
    weather:  { en: s.weatherEnabled ?? false,   cmd: s.weatherCmd ?? "!w",name: "\uD83C\uDF24\uFE0F \u0637\u0642\u0633",              tog: "mymsgs_toggle_weather",   edit: "mymsgs_edit_weather_cmd" },
    translate:{ en: s.translateEnabled ?? false, cmd: s.translateCmd ?? "!tr",name: "\uD83C\uDF10 \u062A\u0631\u062C\u0645\u0629",             tog: "mymsgs_toggle_translate", edit: "mymsgs_edit_translate_cmd" },
    joke:     { en: s.jokeEnabled ?? false,      cmd: s.jokeCmd ?? "!joke",name: "\uD83D\uDE02 \u0646\u0643\u062A\u0629",              tog: "mymsgs_toggle_joke",      edit: "mymsgs_edit_joke_cmd" },
    fortune:  { en: s.fortuneEnabled ?? false,   cmd: s.fortuneCmd ?? "!fortune",name: "\u2728 \u062D\u0638 \u0627\u0644\u064A\u0648\u0645",          tog: "mymsgs_toggle_fortune",   edit: "mymsgs_edit_fortune_cmd" },
    wiki:     { en: s.wikiEnabled ?? false,      cmd: s.wikiCmd ?? "!wiki",name: "\uD83D\uDCDA \u0648\u064A\u0643\u064A\u0628\u064A\u062F\u064A\u0627",         tog: "mymsgs_toggle_wiki",      edit: "mymsgs_edit_wiki_cmd" },
    prayer:   { en: s.prayerEnabled ?? false,    cmd: s.prayerCmd ?? "!prayer",name: "\uD83D\uDD4C \u0645\u0648\u0627\u0642\u064A\u062A \u0627\u0644\u0635\u0644\u0627\u0629",    tog: "mymsgs_toggle_prayer",    edit: "mymsgs_edit_prayer_cmd" },
    currency: { en: s.currencyEnabled ?? false,  cmd: s.currencyCmd ?? "!cur",name: "\uD83D\uDCB1 \u062A\u062D\u0648\u064A\u0644 \u0639\u0645\u0644\u0629",       tog: "mymsgs_toggle_currency",  edit: "mymsgs_edit_currency_cmd" },
    sticker:  { en: s.stickerEnabled ?? false,   cmd: s.stickerCmd ?? "!sticker",name: "\uD83C\uDFAD \u0633\u062A\u064A\u0643\u0631",             tog: "mymsgs_toggle_sticker",   edit: "mymsgs_edit_sticker_cmd" },
    news:     { en: s.newsEnabled ?? false,      cmd: s.newsCmd ?? "!news",name: "\uD83D\uDCF0 \u0623\u062E\u0628\u0627\u0631",             tog: "mymsgs_toggle_news",      edit: "mymsgs_edit_news_cmd" },
    locate:   { en: s.locateEnabled ?? false,   cmd: s.locateCmd ?? "/locate", name: "\uD83D\uDD75\uFE0F \u062A\u062A\u0628\u0639 \u0627\u0644\u0645\u0648\u0642\u0639", tog: "mymsgs_toggle_locate", edit: "mymsgs_edit_locate_cmd" },
    cod:      { en: s.codEnabled !== false,      cmd: s.codCmd ?? "/cod",  name: "\uD83D\uDD17 \u0631\u0628\u0637 \u0631\u0642\u0645",                tog: "mymsgs_toggle_cod",       edit: "mymsgs_edit_cod_cmd" },
    stt:      { en: s.sttEnabled ?? true,        cmd: s.sttCmd ?? "/\u0646\u0635", name: "\uD83C\uDFA4 \u0635\u0648\u062A\u2190\u0646\u0635 (\u062A\u0641\u0631\u064A\u063A)", tog: "mymsgs_toggle_stt", edit: "mymsgs_edit_stt_cmd" },
    tts:      { en: s.ttsEnabled ?? true,        cmd: s.ttsCmd ?? "/\u0635\u0648\u062A", name: "\uD83D\uDD0A \u0646\u0635\u2190\u0635\u0648\u062A (\u0646\u0637\u0642)", tog: "mymsgs_toggle_tts", edit: "mymsgs_edit_tts_cmd" },
  };
  const feat = map[feature];
  if (!feat) return null;
  // [FIX-DESCRIPTIONS] وصف تفصيلي يوضح كيفية استخدام كل ميزة
  const _featureDescs = {
    pic:      `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd}\` \u0641\u064A \u0623\u064A \u0645\u062D\u0627\u062F\u062B\u0629 \u0648\u0627\u062A\u0633\u0627\u0628 \u0644\u062C\u0644\u0628 \u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644.`,
    gm:       `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd}\` \u062F\u0627\u062E\u0644 \u0645\u062C\u0645\u0648\u0639\u0629 \u0644\u062A\u0635\u062F\u064A\u0631 \u0623\u0631\u0642\u0627\u0645 \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0639\u0636\u0627\u0621 \u0643\u0645\u0644\u0641 \u0646\u0635\u064A.`,
    copy:     `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0631\u062F \u0639\u0644\u0649 \u0623\u064A \u0631\u0633\u0627\u0644\u0629 \u0628\u0640 \`${feat.cmd}\` \u0644\u0625\u0639\u0627\u062F\u0629 \u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u0628\u062F\u0648\u0646 \u0639\u0644\u0627\u0645\u0629 "\u0645\u062D\u0648\u0651\u0644\u0629 \u0645\u0646".`,
    img:      `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0643\u0644\u0645\u0629 \u0639\u062F\u062F\` \u0644\u0644\u0628\u062D\u062B \u0639\u0646 \u0635\u0648\u0631.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0642\u0637\u0637 5\``,
    vid:      `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0643\u0644\u0645\u0629 \u0639\u062F\u062F\` \u0644\u062A\u0646\u0632\u064A\u0644 \u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A \u064A\u0648\u062A\u064A\u0648\u0628.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0642\u0637\u0629 2\``,
    linkvid:  `\u0623\u0631\u0633\u0644 \u0631\u0627\u0628\u0637 \u0641\u064A\u062F\u064A\u0648 \u0645\u062F\u0639\u0648\u0645\u0627\u064B \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0628\u0639\u062F \u062A\u062B\u0628\u064A\u062A\u0647\u0627 \u0628\u0627\u0644\u0623\u0645\u0631:\n\`/تعيين_مجموعة_الفيديو\`\n\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u0628\u0648\u0637 \u0647\u0648 \u0627\u0644\u0639\u0636\u0648 \u0627\u0644\u0648\u062D\u064A\u062F \u0641\u064A \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629. \u0633\u064A\u0639\u0645\u0644 \u0627\u0644\u062A\u0646\u0632\u064A\u0644 \u0641\u0642\u0637 \u0641\u064A \u062A\u0644\u0643 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0648\u0645\u0646 \u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629.`,
    tiktok:   `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0643\u0644\u0645\u0629 \u0639\u062F\u062F\` \u0644\u062A\u0646\u0632\u064A\u0644 \u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A \u062A\u064A\u0643 \u062A\u0648\u0643 (\u062D\u062A\u0649 20).\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0636\u062D\u0643 3\``,
    song:     `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0627\u0633\u0645 \u0639\u062F\u062F\` \u0644\u062A\u0646\u0632\u064A\u0644 \u0623\u063A\u0627\u0646\u064A.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0641\u064A\u0631\u0648\u0632 2\``,
    film:     `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0627\u0633\u0645 \u0627\u0644\u0641\u064A\u0644\u0645\` \u0644\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u0644\u0645 \u0645\u0646 \u064A\u0648\u062A\u064A\u0648\u0628.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} inception\``,
    ai:       `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0633\u0624\u0627\u0644\u0643\` \u0644\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0631\u062F \u0645\u0646 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0645\u0627 \u0647\u064A \u0639\u0627\u0635\u0645\u0629 \u0641\u0631\u0646\u0633\u0627\u061F\``,
    aiimg:    `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0648\u0635\u0641 \u0627\u0644\u0635\u0648\u0631\u0629\` \u0644\u062A\u0648\u0644\u064A\u062F \u0635\u0648\u0631\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u063A\u0631\u0648\u0628 \u0634\u0645\u0633 \u0641\u0648\u0642 \u0627\u0644\u062C\u0628\u0627\u0644\``,
    del:      `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0639\u062F\u062F\` \u0644\u062D\u0630\u0641 \u0622\u062E\u0631 N \u0631\u0633\u0627\u0644\u0629 \u0623\u0631\u0633\u0644\u062A\u0647\u0627 \u0644\u0644\u062C\u0645\u064A\u0639.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} 5\` \u064A\u062D\u0630\u0641 \u0622\u062E\u0631 5 \u0631\u0633\u0627\u0626\u0644.`,
    statuscp: `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0631\u062F \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u062D\u0627\u0644\u0629 (status) \u0628\u0640 \`${feat.cmd}\` \u0644\u0625\u0639\u0627\u062F\u0629 \u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u0641\u064A \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629.`,
    spam:     `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0639\u062F\u062F \u0646\u0635\` \u0644\u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629 \u0639\u062F\u0629 \u0645\u0631\u0627\u062A.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} 5 \u0645\u0631\u062D\u0628\u0627\``,
    weather:  `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0627\u0644\u0645\u062F\u064A\u0646\u0629\` \u0644\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0642\u0633.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0627\u0644\u0631\u064A\u0627\u0636\``,
    translate:`\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0627\u0644\u0646\u0635\` \u0644\u062A\u0631\u062C\u0645\u0629 \u0644\u0644\u0639\u0631\u0628\u064A\u0629.\n\u0623\u0648 \`${feat.cmd} en \u0627\u0644\u0646\u0635\` \u0644\u062A\u0631\u062C\u0645\u062A\u0647 \u0644\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0645\u0631\u062D\u0628\u0627\``,
    joke:     `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd}\` \u0644\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0646\u0643\u062A\u0629 \u0639\u0634\u0648\u0627\u0626\u064A\u0629.`,
    fortune:  `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd}\` \u0644\u0645\u0639\u0631\u0641\u0629 \u062A\u0648\u0642\u0639\u0627\u062A \u0648\u0646\u0635\u0627\u0626\u062D \u0627\u0644\u064A\u0648\u0645.`,
    wiki:     `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0627\u0644\u0645\u0648\u0636\u0648\u0639\` \u0644\u0644\u0628\u062D\u062B \u0641\u064A \u0648\u064A\u0643\u064A\u0628\u064A\u062F\u064A\u0627.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A\``,
    prayer:   `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0627\u0644\u0645\u062F\u064A\u0646\u0629\` \u0644\u0645\u0639\u0631\u0641\u0629 \u0645\u0648\u0627\u0642\u064A\u062A \u0627\u0644\u0635\u0644\u0627\u0629.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629\``,
    currency: `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0645\u0628\u0644\u063A \u0639\u0645\u0644\u0629\` \u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062A.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} 100 USD\``,
    sticker:  `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0631\u062F \u0639\u0644\u0649 \u0635\u0648\u0631\u0629 \u0628\u0640 \`${feat.cmd}\` \u0644\u062A\u062D\u0648\u064A\u0644\u0647\u0627 \u0644\u0645\u0644\u0635\u0642 \u0648\u0627\u062A\u0633\u0627\u0628.\n\u0623\u0648 \`${feat.cmd} \u0643\u0644\u0645\u0629 \u0639\u062F\u062F\` \u0644\u062C\u0644\u0628 \u0645\u0644\u0635\u0642\u0627\u062A.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u0642\u0637\u0629 5\``,
    news:     `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd}\` \u0644\u0622\u062E\u0631 \u0627\u0644\u0623\u062E\u0628\u0627\u0631.\n\u0623\u0648 \`${feat.cmd} \u0645\u0648\u0636\u0648\u0639\` \u0644\u0644\u0628\u062D\u062B.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} \u062A\u0642\u0646\u064A\u0629\``,
    cod:      `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd}\` \u0644\u064A\u0631\u0633\u0644 \u0627\u0644\u0628\u0648\u062A \u0631\u0627\u0628\u0637 \u0631\u0628\u0637 \u0627\u0644\u0631\u0642\u0645 \u0628\u0627\u0644\u0628\u0648\u062A \u0644\u0644\u0634\u062E\u0635 \u0627\u0644\u0622\u062E\u0631.`,
    stt:      `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0631\u062F \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u0635\u0648\u062A\u064A\u0629 \u0628\u0640 \`${feat.cmd}\` \u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0643\u0644\u0627\u0645 \u0625\u0644\u0649 \u0646\u0635 \u0645\u0643\u062A\u0648\u0628.`,
    tts:      `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} \u0627\u0644\u0646\u0635\` \u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0646\u0635 \u0625\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u0635\u0648\u062A\u064A\u0629.\n\u2022 \u0631\u062F \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u0628\u0640 \`${feat.cmd}\` \u0641\u0642\u0637 \u0644\u062A\u062D\u0648\u064A\u0644\u0647\u0627 \u0635\u0648\u062A\u0627\u064B.\n\u2022 \u0644\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0635\u0648\u062A \u0623\u0636\u0641 \u0631\u0642\u0645\u0627\u064B (1-9): \`${feat.cmd} 2 \u0627\u0644\u0646\u0635\`\n  (1\u2665\u0633\u0639\u0648\u062F\u064A\u0629 2\u2642\u0633\u0639\u0648\u062F\u064A 3\u2665\u0645\u0635\u0631\u064A\u0629 4\u2642\u0645\u0635\u0631\u064A ...)`,
    locate:   `\uD83D\uDCCC *\u0643\u064A\u0641 \u062A\u0633\u062A\u062E\u062F\u0645\u0647\u0627:*\n\u0623\u0631\u0633\u0644 \`${feat.cmd} +\u0631\u0645\u0632\u0627\u0644\u062F\u0648\u0644\u0629\u0627\u0644\u0631\u0642\u0645\` \u0644\u062A\u062A\u0628\u0639 \u0645\u0648\u0642\u0639 \u0627\u0644\u0631\u0642\u0645.\n\u270F\uFE0F \u0645\u062B\u0627\u0644: \`${feat.cmd} +966501234567\`\n\u{1F512} \u064A\u0639\u0631\u0636 \u0627\u0644\u0645\u0648\u0642\u0639 + \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0634\u0628\u0643\u0629 \u0648\u0627\u0644\u062F\u0648\u0644\u0629`,
  };
  const _featDesc = _featureDescs[feature] || "";
  const _commandLine = feat.cmd ? `\n\n\u0627\u0644\u0623\u0645\u0631: \`${feat.cmd}\`` : "";
  return {
    text: `\u2699\uFE0F *${feat.name}*\n\n${_featDesc}${_commandLine}\n\u0627\u0644\u062D\u0627\u0644\u0629: ${feat.en ? "\uD83D\uDFE2 \u0645\u064F\u0641\u0639\u064E\u0651\u0644" : "\uD83D\uDD34 \u0645\u064F\u0639\u0637\u064E\u0651\u0644"}`,
    keyboard: {
      inline_keyboard: [
        [{ text: feat.en ? "\uD83D\uDD34 \u0625\u064A\u0642\u0627\u0641" : "\uD83D\uDFE2 \u062A\u0634\u063A\u064A\u0644", callback_data: feat.tog }],
        ...(feat.edit ? [[{ text: `\u270F\uFE0F \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0623\u0645\u0631: ${feat.cmd}`, callback_data: feat.edit }]] : []),
        [{ text: "\u25C0\uFE0F \u0631\u062C\u0648\u0639 \u0644\u0644\u0642\u0627\u0626\u0645\u0629", callback_data: "menu_mymsgs" }]
      ]
    }
  };
}

export async function handleMyMsgsMenu(bot2, chatId, userId) {
  const user = _deps.getUser(userId);
  const s = getMyMsgsSettings(user);
  await bot2.sendMessage(
    chatId,
    `\u{1F4E4} *\u0642\u0633\u0645 \u0631\u0633\u0627\u0626\u0644\u064A*\n\n\u0623\u0648\u0627\u0645\u0631 \u062A\u0631\u0633\u0644\u0647\u0627 \u0623\u0646\u062A \u0641\u064A \u0623\u064A \u0645\u062D\u0627\u062F\u062B\u0629 \u0648\u0627\u062A\u0633\u0627\u0628:\n\n\u{1F5BC}\uFE0F *${s.profilePicCmd}*\n\u064A\u0631\u0633\u0644 \u0635\u0648\u0631\u0629 \u0628\u0631\u0648\u0641\u0627\u064A\u0644 \u0627\u0644\u0634\u062E\u0635 \u0623\u0648 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629\n\n\u{1F465} *${s.exportMembersCmd}*\n(\u062F\u0627\u062E\u0644 \u0645\u062C\u0645\u0648\u0639\u0629) \u064A\u0631\u0633\u0644 \u0645\u0644\u0641 \u0628\u0643\u0644 \u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0623\u0639\u0636\u0627\u0621\n\n\u{1F501} *${s.copyCmd}*\n(\u0631\u062F\u0651 \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629) \u064A\u0639\u064A\u062F \u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u0628\u062F\u0648\u0646 "\u0645\u062D\u0648\u0651\u0644\u0629"\n\n\u{1F5BC}\uFE0F *${s.imgCmd} \u0646\u0635 \u0639\u062F\u062F*\n\u064A\u0628\u062D\u062B \u0639\u0646 \u0635\u0648\u0631 \u2014 \u0645\u062B\u0627\u0644: \`${s.imgCmd} \u0643\u0644\u0628 5\`\n\n\u{1F3AC} *${s.vidCmd} \u0646\u0635 \u0639\u062F\u062F*\n\u064A\u064F\u0646\u0632\u0651\u0644 \u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A \u064A\u0648\u062A\u064A\u0648\u0628 \u2014 \u0645\u062B\u0627\u0644: \`${s.vidCmd} \u0642\u0637\u0629 2\`\n\n\u{1F4F1} *${s.tiktokCmd} \u0646\u0635 \u0639\u062F\u062F*\n\u064A\u0628\u062D\u062B \u0648\u064A\u0646\u0632\u0651\u0644 \u0645\u0646 \u062A\u064A\u0643 \u062A\u0648\u0643 (\u062D\u062A\u0649 20) \u2014 \u0645\u062B\u0627\u0644: \`${s.tiktokCmd} \u062A\u062D\u0634\u064A\u0634 \u0639\u0631\u0627\u0642\u064A 3\`\n\n\u{1F3B5} *${s.songCmd} \u0646\u0635 \u0639\u062F\u062F*\n\u064A\u064F\u0646\u0632\u0651\u0644 \u0623\u063A\u0627\u0646\u064A \u2014 \u0645\u062B\u0627\u0644: \`${s.songCmd} \u0641\u064A\u0631\u0648\u0632 2\`\n\n\u{1F916} *${s.aiCmd} \u0633\u0624\u0627\u0644\u0643*\n\u064A\u0631\u062F \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u2014 \u0645\u062B\u0627\u0644: \`${s.aiCmd} \u0645\u0627 \u0647\u0648 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A\`\n\n\u{1F5D1}\uFE0F *${s.delCmd} \u0639\u062F\u062F*\n\u064A\u062D\u0630\u0641 \u0622\u062E\u0631 N \u0631\u0633\u0627\u0644\u0629 \u0623\u0631\u0633\u0644\u062A\u0647\u0627 (\u0644\u0644\u062C\u0645\u064A\u0639) \u2014 \u0645\u062B\u0627\u0644: \`${s.delCmd} 5\`\n\n\u{1F3A8} *${s.aiImgCmd} \u0648\u0635\u0641*\n\u064A\u0648\u0644\u0651\u062F \u0635\u0648\u0631\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u2014 \u0645\u062B\u0627\u0644: \`${s.aiImgCmd} \u063A\u0631\u0648\u0628 \u0627\u0644\u0634\u0645\u0633 \u0641\u0648\u0642 \u0627\u0644\u062C\u0628\u0627\u0644\`\n\n\u{1F3A5} *${s.filmCmd} \u0627\u0633\u0645 \u0627\u0644\u0641\u064A\u0644\u0645*\n\u064A\u0646\u0632\u0651\u0644 \u0641\u064A\u0644\u0645 \u0643\u0627\u0645\u0644 \u0645\u0646 \u064A\u0648\u062A\u064A\u0648\u0628 \u2014 \u0645\u062B\u0627\u0644: \`${s.filmCmd} inception\``,
    { parse_mode: "Markdown", reply_markup: myMsgsMenuKeyboard(s) }
  );
}

export async function handleMyMsgsCallback(bot2, chatId, userId, data) {
  const user = _deps.getUser(userId);
  const s = getMyMsgsSettings(user);
  if (data === "menu_mymsgs") {
    await handleMyMsgsMenu(bot2, chatId, userId);
    return;
  }
  if (data === "mymsgs_toggle_linkvid") {
    const ns = saveMyMsgsSettings(userId, { linkVideoEnabled: !s.linkVideoEnabled });
    await bot2.sendMessage(
      chatId,
      ns.linkVideoEnabled
        ? "\u2705 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A \u0645\u0646 \u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u0641\u0639\u0651\u0644\u061B \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629 \u0645\u0642\u064A\u0651\u062F\u0629 \u0628\u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629."
        : "\u274C \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A \u0645\u0646 \u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u0639\u0637\u0651\u0644.",
      { reply_markup: myMsgsMenuKeyboard(ns) }
    );
    return;
  }
  // [NEW-FEATURE-SITEGEN] زر أداة المواقع المؤقتة داخل رسائلي — مقفول على المطوّر فقط
  if (data === "mymsgs_show_sitegen") {
    if (userId !== _deps.DEVELOPER_ID) {
      await bot2.sendMessage(chatId, "\u{1F512} \u0647\u0630\u0647 \u0627\u0644\u0645\u064A\u0632\u0629 \u0645\u062E\u0635\u0651\u0635\u0629 \u0644\u0645\u0637\u0648\u0651\u0631 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", { reply_markup: myMsgsMenuKeyboard(s) });
      return;
    }
    const { getTemplateList } = await import('./site-generator.mjs');
    const templates = getTemplateList().join("\n");
    await bot2.sendMessage(
      chatId,
      `\u{1F9F0} *\u0623\u062F\u0627\u0629 \u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u0645\u0624\u0642\u062A\u0629*\n\n` +
      `\u062A\u0646\u0634\u0626 \u0645\u0648\u0642\u0639 \u0639\u0627\u0645 \u0645\u0624\u0642\u062A \u0628\u0631\u0627\u0628\u0637 \u062D\u0642\u064A\u0642\u064A\u060c \u0648\u062A\u0631\u062C\u0651\u0639\u0644\u0643 \u0623\u064A \u0628\u064A\u0627\u0646\u0627\u062A \u064A\u0631\u0633\u0644\u0647\u0627 \u0627\u0644\u0632\u0648\u0627\u0631 \u0647\u0646\u0627 \u0645\u0628\u0627\u0634\u0631\u0629 \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629.\n\n` +
      `*\u0627\u0644\u0623\u0648\u0627\u0645\u0631 (\u0627\u0643\u062A\u0628\u0647\u0627 \u0643\u0646\u0635 \u0639\u0627\u062F\u064A \u0641\u064A \u0627\u0644\u0634\u0627\u062A):*\n` +
      "`\u0627\u062F\u0627\u0629 \u062A\u0634\u063A\u064A\u0644 <\u0643\u0648\u062F> <\u0646\u0648\u0639> <\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0642\u0639>`\n" +
      "`\u0627\u062F\u0627\u0629 \u0627\u064A\u0642\u0627\u0641 <\u0643\u0648\u062F>` \u2014 \u064A\u0648\u0642\u0641 \u0627\u0644\u0645\u0648\u0642\u0639 \u0648\u064A\u063A\u0644\u0642 \u062C\u0644\u0633\u062A\u0647\n" +
      "`\u0627\u062F\u0627\u0629 \u0642\u0627\u0626\u0645\u0629` \u2014 \u064A\u0639\u0631\u0636 \u0643\u0644 \u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u0634\u063A\u0651\u0627\u0644\u0629 \u062D\u0627\u0644\u064A\u0627\u064B (\u064A\u0645\u0643\u0646 \u062A\u0634\u063A\u064A\u0644 \u0639\u062F\u0629 \u0645\u0648\u0627\u0642\u0639 \u0628\u0646\u0641\u0633 \u0627\u0644\u0648\u0642\u062A)\n\n" +
      `*\u0627\u0644\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0645\u062F\u0639\u0648\u0645\u0629:*\n${templates}\n\n` +
      "\u2709\uFE0F \u0645\u062B\u0627\u0644: `\u0627\u062F\u0627\u0629 \u062A\u0634\u063A\u064A\u0644 promo1 contact \u0646\u0645\u0648\u0630\u062C \u062A\u0648\u0627\u0635\u0644 \u0627\u0644\u0639\u0631\u0648\u0636`",
      { parse_mode: "Markdown", reply_markup: myMsgsMenuKeyboard(s) }
    );
    return;
  }
  if (data.startsWith("mymsgs_show_")) {
    const feature = data.replace("mymsgs_show_", "");
    const sub = myMsgsFeatureSubMenu(s, feature);
    if (sub) {
      await bot2.sendMessage(chatId, sub.text, { parse_mode: "Markdown", reply_markup: sub.keyboard });
    } else {
      await bot2.sendMessage(chatId, "\u274C \u0645\u064A\u0632\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629", { reply_markup: myMsgsMenuKeyboard(s) });
    }
    return;
  }
  if (data === "mymsgs_toggle_pic") {
    const ns = saveMyMsgsSettings(userId, { profilePicEnabled: !s.profilePicEnabled });
    await bot2.sendMessage(chatId, ns.profilePicEnabled ? `\u2705 \u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644 \u0645\u0641\u0639\u0651\u0644\u0629 \u2014 \u0623\u0631\u0633\u0644 *${ns.profilePicCmd}*` : `\u274C \u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644 \u0645\u0639\u0637\u0651\u0644\u0629`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "pic"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_gm") {
    const ns = saveMyMsgsSettings(userId, { exportMembersEnabled: !s.exportMembersEnabled });
    await bot2.sendMessage(chatId, ns.exportMembersEnabled ? `\u2705 \u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0623\u0639\u0636\u0627\u0621 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0623\u0631\u0633\u0644 *${ns.exportMembersCmd}* \u062F\u0627\u062E\u0644 \u0645\u062C\u0645\u0648\u0639\u0629` : `\u274C \u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0623\u0639\u0636\u0627\u0621 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "gm"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_copy") {
    const ns = saveMyMsgsSettings(userId, { copyEnabled: !s.copyEnabled });
    await bot2.sendMessage(chatId, ns.copyEnabled ? `\u2705 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0645\u0641\u0639\u0651\u0644\u0629 \u2014 \u0631\u062F\u0651 \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u0628\u0640 *${ns.copyCmd}*` : `\u274C \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0645\u0639\u0637\u0651\u0644\u0629`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "copy"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_img") {
    const ns = saveMyMsgsSettings(userId, { imgEnabled: !s.imgEnabled });
    await bot2.sendMessage(chatId, ns.imgEnabled ? `\u2705 \u0628\u062D\u062B \u0627\u0644\u0635\u0648\u0631 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0645\u062B\u0627\u0644: *${ns.imgCmd} \u0643\u0644\u0628 5*` : `\u274C \u0628\u062D\u062B \u0627\u0644\u0635\u0648\u0631 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "img"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_vid") {
    const ns = saveMyMsgsSettings(userId, { vidEnabled: !s.vidEnabled });
    await bot2.sendMessage(chatId, ns.vidEnabled ? `\u2705 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0645\u062B\u0627\u0644: *${ns.vidCmd} \u0642\u0637\u0629 2*` : `\u274C \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "vid"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_tiktok") {
    const ns = saveMyMsgsSettings(userId, { tiktokEnabled: !s.tiktokEnabled });
    await bot2.sendMessage(chatId, ns.tiktokEnabled ? `\u2705 \u062A\u064A\u0643 \u062A\u0648\u0643 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0645\u062B\u0627\u0644: *${ns.tiktokCmd} \u062A\u062D\u0634\u064A\u0634 3*` : `\u274C \u062A\u064A\u0643 \u062A\u0648\u0643 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "tiktok"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_song") {
    const ns = saveMyMsgsSettings(userId, { songEnabled: !s.songEnabled });
    await bot2.sendMessage(chatId, ns.songEnabled ? `\u2705 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0623\u063A\u0627\u0646\u064A \u0645\u0641\u0639\u0651\u0644 \u2014 \u0645\u062B\u0627\u0644: *${ns.songCmd} \u0641\u064A\u0631\u0648\u0632 2*` : `\u274C \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0623\u063A\u0627\u0646\u064A \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "song"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_ai") {
    const ns = saveMyMsgsSettings(userId, { aiEnabled: !s.aiEnabled });
    await bot2.sendMessage(chatId, ns.aiEnabled ? `\u2705 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0645\u0641\u0639\u0651\u0644 \u2014 \u0645\u062B\u0627\u0644: *${ns.aiCmd} \u0645\u0627 \u0647\u0648 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A*` : `\u274C \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "ai"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_del") {
    const ns = saveMyMsgsSettings(userId, { delEnabled: !s.delEnabled });
    await bot2.sendMessage(chatId, ns.delEnabled ? `\u2705 \u062D\u0630\u0641 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0645\u062B\u0627\u0644: *${ns.delCmd} 5*` : `\u274C \u062D\u0630\u0641 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "del"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_aiimg") {
    const ns = saveMyMsgsSettings(userId, { aiImgEnabled: !s.aiImgEnabled });
    await bot2.sendMessage(chatId, ns.aiImgEnabled ? `\u2705 \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0635\u0648\u0631 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0645\u062B\u0627\u0644: *${ns.aiImgCmd} \u063A\u0631\u0648\u0628 \u0627\u0644\u0634\u0645\u0633*` : `\u274C \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0635\u0648\u0631 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "aiimg"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_film") {
    const ns = saveMyMsgsSettings(userId, { filmEnabled: !s.filmEnabled });
    await bot2.sendMessage(chatId, ns.filmEnabled ? `\u2705 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u0644\u0645 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0645\u062B\u0627\u0644: *${ns.filmCmd} inception*` : `\u274C \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u0644\u0645 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "film"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_statuscp") {
    const ns = saveMyMsgsSettings(userId, { statusCopyEnabled: !s.statusCopyEnabled });
    await bot2.sendMessage(chatId, ns.statusCopyEnabled ? `\u2705 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0631\u062F\u0651 \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u0629 \u0628\u0640 *${ns.statusCopyCmd}*` : `\u274C \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "statuscp"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_statusas") {
    const ns = saveMyMsgsSettings(userId, { statusAutoSave: !(s.statusAutoSave ?? false) });
    const isOn = ns.statusAutoSave;
    await bot2.sendMessage(chatId,
      isOn
        ? "✅ *الحفظ التلقائي للحالات مفعّل*\n\nكل حالة وسائط (صور/فيديو) تصلك ستُرسَل تلقائياً لمحادثتك الخاصة\n\n⚠️ تأكد أن البوت مرتبط برقمك"
        : "❌ الحفظ التلقائي للحالات معطّل",
      { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "statusas"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }
    );
    return;
  }
  if (data === "mymsgs_toggle_spam") {
    const ns = saveMyMsgsSettings(userId, { spamEnabled: !(s.spamEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.spamEnabled ? `\u2705 \u0633\u0628\u0627\u0645 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.spamCmd || "!sp"}*` : `\u274C \u0633\u0628\u0627\u0645 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "spam"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_weather") {
    const ns = saveMyMsgsSettings(userId, { weatherEnabled: !(s.weatherEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.weatherEnabled ? `\u2705 \u0627\u0644\u0637\u0642\u0633 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.weatherCmd || "!w"}*` : `\u274C \u0627\u0644\u0637\u0642\u0633 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "weather"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_translate") {
    const ns = saveMyMsgsSettings(userId, { translateEnabled: !(s.translateEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.translateEnabled ? `\u2705 \u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0645\u0641\u0639\u0651\u0644\u0629 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.translateCmd || "!tr"}*` : `\u274C \u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0645\u0639\u0637\u0651\u0644\u0629`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "translate"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_joke") {
    const ns = saveMyMsgsSettings(userId, { jokeEnabled: !(s.jokeEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.jokeEnabled ? `\u2705 \u0646\u0643\u062A\u0629 \u0645\u0641\u0639\u0651\u0644\u0629 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.jokeCmd || "!joke"}*` : `\u274C \u0646\u0643\u062A\u0629 \u0645\u0639\u0637\u0651\u0644\u0629`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "joke"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_fortune") {
    const ns = saveMyMsgsSettings(userId, { fortuneEnabled: !(s.fortuneEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.fortuneEnabled ? `\u2705 \u062D\u0638 \u0627\u0644\u064A\u0648\u0645 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.fortuneCmd || "!fortune"}*` : `\u274C \u062D\u0638 \u0627\u0644\u064A\u0648\u0645 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "fortune"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_wiki") {
    const ns = saveMyMsgsSettings(userId, { wikiEnabled: !(s.wikiEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.wikiEnabled ? `\u2705 \u0648\u064A\u0643\u064A\u0628\u064A\u062F\u064A\u0627 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.wikiCmd || "!wiki"}*` : `\u274C \u0648\u064A\u0643\u064A\u0628\u064A\u062F\u064A\u0627 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "wiki"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_prayer") {
    const ns = saveMyMsgsSettings(userId, { prayerEnabled: !(s.prayerEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.prayerEnabled ? `\u2705 \u0645\u0648\u0627\u0642\u064A\u062A \u0627\u0644\u0635\u0644\u0627\u0629 \u0645\u0641\u0639\u0651\u0644\u0629 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.prayerCmd || "!prayer"}*` : `\u274C \u0645\u0648\u0627\u0642\u064A\u062A \u0627\u0644\u0635\u0644\u0627\u0629 \u0645\u0639\u0637\u0651\u0644\u0629`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "prayer"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_currency") {
    const ns = saveMyMsgsSettings(userId, { currencyEnabled: !(s.currencyEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.currencyEnabled ? `\u2705 \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0639\u0645\u0644\u0629 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.currencyCmd || "!cur"}*` : `\u274C \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0639\u0645\u0644\u0629 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "currency"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_sticker") {
    const ns = saveMyMsgsSettings(userId, { stickerEnabled: !(s.stickerEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.stickerEnabled ? `\u2705 \u0633\u062A\u064A\u0643\u0631 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.stickerCmd || "!sticker"}*` : `\u274C \u0633\u062A\u064A\u0643\u0631 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "sticker"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_news") {
    const ns = saveMyMsgsSettings(userId, { newsEnabled: !(s.newsEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.newsEnabled ? `\u2705 \u0623\u062E\u0628\u0627\u0631 \u0645\u0641\u0639\u0651\u0644\u0629 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.newsCmd || "!news"}*` : `\u274C \u0623\u062E\u0628\u0627\u0631 \u0645\u0639\u0637\u0651\u0644\u0629`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "news"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_locate") {
    const ns = saveMyMsgsSettings(userId, { locateEnabled: !(s.locateEnabled ?? false) });
    await bot2.sendMessage(chatId, ns.locateEnabled ? `\u2705 \u062A\u062A\u0628\u0639 \u0627\u0644\u0645\u0648\u0642\u0639 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0627\u0644\u0623\u0645\u0631: *${ns.locateCmd || "/locate"}*` : `\u274C \u062A\u062A\u0628\u0639 \u0627\u0644\u0645\u0648\u0642\u0639 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "locate"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  const editMap = {
    mymsgs_edit_pic_cmd:      { field: "profilePicCmd",    label: "\u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644",    example: "/pic \u0623\u0648 \u0635\u0648\u0631\u0629" },
    mymsgs_edit_gm_cmd:       { field: "exportMembersCmd", label: "\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0623\u0639\u0636\u0627\u0621", example: "/members \u0623\u0648 \u0623\u0639\u0636\u0627\u0621" },
    mymsgs_edit_copy_cmd:     { field: "copyCmd",          label: "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644",    example: "/resend \u0623\u0648 \u0643\u0631\u0631" },
    mymsgs_edit_img_cmd:      { field: "imgCmd",           label: "\u0628\u062D\u062B \u0627\u0644\u0635\u0648\u0631",          example: "/img \u0623\u0648 \u0635\u0648\u0631" },
    mymsgs_edit_vid_cmd:      { field: "vidCmd",           label: "\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648",     example: "/vid \u0623\u0648 \u0641\u064A\u062F\u064A\u0648" },
    mymsgs_edit_tiktok_cmd:   { field: "tiktokCmd",        label: "\u062A\u064A\u0643 \u062A\u0648\u0643",           example: "/tiktok \u0623\u0648 tt" },
    mymsgs_edit_song_cmd:     { field: "songCmd",          label: "\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0623\u063A\u0627\u0646\u064A",     example: "/song \u0623\u0648 \u0627\u063A\u0646\u064A\u0629" },
    mymsgs_edit_ai_cmd:       { field: "aiCmd",            label: "\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A",     example: "/ai \u0623\u0648 \u0630\u0643\u0627\u0621" },
    mymsgs_edit_del_cmd:      { field: "delCmd",           label: "\u062D\u0630\u0641 \u0627\u0644\u0631\u0633\u0627\u0626\u0644",      example: "/del \u0623\u0648 \u062D\u0630\u0641" },
    mymsgs_edit_aiimg_cmd:    { field: "aiImgCmd",         label: "\u062A\u0648\u0644\u064A\u062F \u0635\u0648\u0631\u0629 AI",    example: "/\u0635\u0648\u0631\u0629 \u0623\u0648 img-ai" },
    mymsgs_edit_film_cmd:     { field: "filmCmd",          label: "\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u0644\u0645",       example: "/film \u0623\u0648 \u0641\u064A\u0644\u0645" },
    mymsgs_edit_statuscp_cmd: { field: "statusCopyCmd",    label: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629",     example: "/\u062D\u0627\u0644\u0629 \u0623\u0648 status" },
    mymsgs_edit_spam_cmd:     { field: "spamCmd",          label: "\u0633\u0628\u0627\u0645/\u0641\u0644\u0648\u062F",        example: "!sp" },
    mymsgs_edit_weather_cmd:  { field: "weatherCmd",       label: "\u0627\u0644\u0637\u0642\u0633",               example: "!w" },
    mymsgs_edit_translate_cmd:{ field: "translateCmd",     label: "\u0627\u0644\u062A\u0631\u062C\u0645\u0629",             example: "!tr" },
    mymsgs_edit_joke_cmd:     { field: "jokeCmd",          label: "\u0646\u0643\u062A\u0629",               example: "!joke" },
    mymsgs_edit_fortune_cmd:  { field: "fortuneCmd",       label: "\u062D\u0638 \u0627\u0644\u064A\u0648\u0645",            example: "!fortune" },
    mymsgs_edit_wiki_cmd:     { field: "wikiCmd",          label: "\u0648\u064A\u0643\u064A\u0628\u064A\u062F\u064A\u0627",         example: "!wiki" },
    mymsgs_edit_prayer_cmd:   { field: "prayerCmd",        label: "\u0645\u0648\u0627\u0642\u064A\u062A \u0627\u0644\u0635\u0644\u0627\u0629",    example: "!prayer" },
    mymsgs_edit_currency_cmd: { field: "currencyCmd",      label: "\u062A\u062D\u0648\u064A\u0644 \u0639\u0645\u0644\u0629",       example: "!cur" },
    mymsgs_edit_sticker_cmd:  { field: "stickerCmd",       label: "\u0633\u062A\u064A\u0643\u0631",             example: "!sticker" },
    mymsgs_edit_news_cmd:     { field: "newsCmd",          label: "\u0623\u062E\u0628\u0627\u0631",             example: "!news" },
    mymsgs_edit_locate_cmd:   { field: "locateCmd",        label: "\u062A\u062A\u0628\u0639 \u0627\u0644\u0645\u0648\u0642\u0639",      example: "/locate \u0623\u0648 /track" },
    mymsgs_edit_cod_cmd:      { field: "codCmd",           label: "\u0631\u0628\u0637 \u0631\u0642\u0645 \u0648\u0627\u062A\u0633\u0622\u0628",      example: "/cod \u0623\u0648 cod" },
    mymsgs_edit_stt_cmd:      { field: "sttCmd",           label: "\u0635\u0648\u062A\u2190\u0646\u0635 (\u062A\u0641\u0631\u064A\u063A)",  example: "/\u0646\u0635 \u0623\u0648 /transcribe" },
    mymsgs_edit_tts_cmd:      { field: "ttsCmd",           label: "\u0646\u0635\u2190\u0635\u0648\u062A (\u0646\u0637\u0642)",     example: "/\u0635\u0648\u062A \u0623\u0648 /speak" }
  };
  if (data === "mymsgs_show_cod") {
    const sub = myMsgsFeatureSubMenu(s, "cod");
    if (sub) { await bot2.sendMessage(chatId, sub.text, { parse_mode: "Markdown", reply_markup: sub.keyboard }); }
    return;
  }
  if (data === "mymsgs_toggle_cod") {
    const ns = saveMyMsgsSettings(userId, { codEnabled: !(s.codEnabled !== false) });
    const codActive = ns.codEnabled !== false;
    await bot2.sendMessage(chatId, codActive ? `\u2705 \u0623\u0645\u0631 *${ns.codCmd || "/cod"}* \u0645\u064F\u0641\u0639\u064E\u0651\u0644 \u2014 \u0627\u0643\u062A\u0628 \u0645\u0646 \u0648\u0627\u062A\u0633\u0622\u0628: ${ns.codCmd || "/cod"} 249XXXXXXXXX` : `\u274C \u0623\u0645\u0631 \u0631\u0628\u0637 \u0627\u0644\u0631\u0642\u0645 \u0645\u064F\u0639\u0637\u064E\u0651\u0644`, { parse_mode: "Markdown", reply_markup: (() => { try { const sub = myMsgsFeatureSubMenu(ns, "cod"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })() });
    return;
  }
  if (data === "mymsgs_toggle_stt") {
    const ns = saveMyMsgsSettings(userId, { sttEnabled: !(s.sttEnabled ?? true) });
    await bot2.sendMessage(chatId, ns.sttEnabled ? `\u2705 \u0635\u0648\u062A\u2190\u0646\u0635 \u0645\u0641\u0639\u0651\u0644 \u2014 \u0631\u062F\u0651 \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u0635\u0648\u062A\u064A\u0629 \u0628\u0640 *${ns.sttCmd || "/\u0646\u0635"}*` : `\u274C \u0635\u0648\u062A\u2190\u0646\u0635 \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "stt"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_toggle_tts") {
    const ns = saveMyMsgsSettings(userId, { ttsEnabled: !(s.ttsEnabled ?? true) });
    await bot2.sendMessage(chatId, ns.ttsEnabled ? `\u2705 \u0646\u0635\u2190\u0635\u0648\u062A \u0645\u0641\u0639\u0651\u0644 \u2014 \u0631\u062F\u0651 \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u0646\u0635\u064A\u0629 \u0628\u0640 *${ns.ttsCmd || "/\u0635\u0648\u062A"}*` : `\u274C \u0646\u0635\u2190\u0635\u0648\u062A \u0645\u0639\u0637\u0651\u0644`, { parse_mode: "Markdown", reply_markup: ((() => { try { const sub = myMsgsFeatureSubMenu(ns, "tts"); return sub ? sub.keyboard : myMsgsMenuKeyboard(ns); } catch(e) { return myMsgsMenuKeyboard(ns); } })()) }); return;
  }
  if (data === "mymsgs_link_code") {
    const sess4 = _deps.inMemoryDB?.sessions?.get(String(userId));
    if (!sess4?.sock) {
      await bot2.sendMessage(chatId, "\u274C \u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0644\u0633\u0629 \u0648\u0627\u062A\u0633\u0622\u0628 \u0646\u0634\u0637\u0629. \u0627\u0631\u0628\u0637 \u062D\u0633\u0627\u0628\u0643 \u0623\u0648\u0644\u0627\u064B.");
      return;
    }
    const { setState: setState3 } = await Promise.resolve().then(() => (_deps.init_state(), _deps.state_exports));
    setState3(userId, "awaiting_link_phone");
    await bot2.sendMessage(chatId, "\u{1F517} *\u0631\u0645\u0632 \u0631\u0628\u0637 \u0631\u0642\u0645 \u062c\u062f\u064a\u062f*\n\n\u0623\u0631\u0633\u0644 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641 \u0627\u0644\u0645\u0631\u0627\u062f \u0631\u0628\u0637\u0647 (\u0645\u0639 \u0643\u0648\u062f \u0627\u0644\u062f\u0648\u0644\u0629):\n\u0645\u062b\u0627\u0644: \`966501234567\`", { parse_mode: "Markdown", reply_markup: _deps.cancelKeyboard() });
    return;
  }
  // PATCH_NEW_FEATURES_v1_APPLIED
  if (data === "mymsgs_show_codes") {
    const codes = s.customCodes || [];
    const rows = codes.map((cc) => [{ text: (cc.enabled !== false ? "\u2705" : "\u274C") + " " + cc.trigger.slice(0,22) + " (" + (cc.matchType||"exact") + ")", callback_data: "mymsgs_code_view_" + cc.id }]);
    rows.push([{ text: "\u2795 \u0625\u0636\u0627\u0641\u0629 \u0643\u0648\u062F \u062C\u062F\u064A\u062F", callback_data: "mymsgs_codes_add" }]);
    rows.push([{ text: "\u25C0\uFE0F \u0631\u062C\u0648\u0639 \u0644\u0644\u0642\u0627\u0626\u0645\u0629", callback_data: "menu_mymsgs" }]);
    await bot2.sendMessage(chatId, "\u26A1 *\u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u062E\u0627\u0635\u0629*\n\n\u0647\u064A \u0623\u0648\u0627\u0645\u0631 \u062A\u0643\u062A\u0628\u0647\u0627 *\u0623\u0646\u062A* \u0641\u064A \u0623\u064A \u0645\u062D\u0627\u062F\u062B\u0629 \u0648\u0627\u062A\u0633\u0622\u0628 \u0641\u064A\u0631\u0633\u0644 \u0627\u0644\u0628\u0648\u062A \u0631\u062F\u0627\u064B \u0645\u062D\u062F\u062F\u0627\u064B.\n\n\u0639\u062F\u062F \u0627\u0644\u0623\u0643\u0648\u0627\u062F: " + codes.length, { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }); return;
  }
  if (data.startsWith("mymsgs_code_view_")) {
    const codeId2 = data.replace("mymsgs_code_view_", "");
    const codes2 = s.customCodes || [];
    const cc2 = codes2.find((x) => x.id === codeId2);
    if (!cc2) { await bot2.sendMessage(chatId, "\u274C \u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F"); return; }
    const mtMap = { exact: "\u062A\u0637\u0627\u0628\u0642 \u062A\u0627\u0645", contains: "\u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649", starts: "\u064A\u0628\u062F\u0623 \u0628\u0640", ends: "\u064A\u0646\u062A\u0647\u064A \u0628\u0640" };
    const rtMap = { text: "\u0646\u0635 \u062B\u0627\u0628\u062A", rotating: "\u0645\u062A\u0646\u0627\u0648\u0628", ai: "\u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A", image: "\u0635\u0648\u0631\u0629" };
    await bot2.sendMessage(chatId, "\u26A1 *\u0643\u0648\u062F: " + cc2.trigger + "*\n\uD83D\uDD0D \u0627\u0644\u062A\u0637\u0627\u0628\u0642: " + (mtMap[cc2.matchType] || cc2.matchType || "exact") + "\n\uD83D\uDCDD \u0627\u0644\u0631\u062F: " + (rtMap[cc2.replyType] || cc2.replyType || "text") + "\n\u0627\u0644\u062D\u0627\u0644\u0629: " + (cc2.enabled !== false ? "\uD83D\uDFE2 \u0645\u064F\u0641\u0639\u064E\u0651\u0644" : "\uD83D\uDD34 \u0645\u064F\u0639\u0637\u064E\u0651\u0644"), { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
      [{ text: cc2.enabled !== false ? "\uD83D\uDD34 \u0625\u064A\u0642\u0627\u0641" : "\uD83D\uDFE2 \u062A\u0634\u063A\u064A\u0644", callback_data: "mymsgs_code_toggle_" + codeId2 }],
      [{ text: "\uD83D\uDDD1\uFE0F \u062D\u0630\u0641 \u0627\u0644\u0643\u0648\u062F", callback_data: "mymsgs_code_del_" + codeId2 }],
      [{ text: "\u25C0\uFE0F \u0631\u062C\u0648\u0639 \u0644\u0644\u0623\u0643\u0648\u0627\u062F", callback_data: "mymsgs_show_codes" }]
    ] } }); return;
  }
  if (data.startsWith("mymsgs_code_toggle_")) {
    const codeId3 = data.replace("mymsgs_code_toggle_", "");
    const codes3 = s.customCodes || [];
    const cc3 = codes3.find((x) => x.id === codeId3);
    if (!cc3) { await bot2.sendMessage(chatId, "\u274C \u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F"); return; }
    cc3.enabled = cc3.enabled === false;
    saveMyMsgsSettings(userId, { customCodes: codes3 });
    await bot2.sendMessage(chatId, (cc3.enabled ? "\uD83D\uDFE2 \u0645\u064F\u0641\u0639\u064E\u0651\u0644" : "\uD83D\uDD34 \u0645\u064F\u0639\u0637\u064E\u0651\u0644") + " \u0627\u0644\u0643\u0648\u062F: " + cc3.trigger, { reply_markup: { inline_keyboard: [
      [{ text: cc3.enabled ? "\uD83D\uDD34 \u0625\u064A\u0642\u0627\u0641" : "\uD83D\uDFE2 \u062A\u0634\u063A\u064A\u0644", callback_data: "mymsgs_code_toggle_" + codeId3 }],
      [{ text: "\uD83D\uDDD1\uFE0F \u062D\u0630\u0641", callback_data: "mymsgs_code_del_" + codeId3 }],
      [{ text: "\u25C0\uFE0F \u0631\u062C\u0648\u0639 \u0644\u0644\u0623\u0643\u0648\u0627\u062F", callback_data: "mymsgs_show_codes" }]
    ] } }); return;
  }
  if (data.startsWith("mymsgs_code_del_")) {
    const codeId4 = data.replace("mymsgs_code_del_", "");
    const filtered4 = (s.customCodes || []).filter((x) => x.id !== codeId4);
    saveMyMsgsSettings(userId, { customCodes: filtered4 });
    await bot2.sendMessage(chatId, "\uD83D\uDDD1\uFE0F \u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0643\u0648\u062F \u0628\u0646\u062C\u0627\u062D.", { reply_markup: { inline_keyboard: [[{ text: "\u25C0\uFE0F \u0631\u062C\u0648\u0639 \u0644\u0644\u0623\u0643\u0648\u0627\u062F", callback_data: "mymsgs_show_codes" }]] } }); return;
  }
  if (data === "mymsgs_codes_add") {
    const { setState: setStateCA } = await Promise.resolve().then(() => (_deps.init_state(), _deps.state_exports));
    setStateCA(userId, "mymsgs_code_step1");
    await bot2.sendMessage(chatId, "\u26A1 *\u0625\u0636\u0627\u0641\u0629 \u0643\u0648\u062F \u062E\u0627\u0635 \u2014 \u0627\u0644\u062E\u0637\u0648\u0629 1/4*\n\n\u0623\u0631\u0633\u0644 \u0646\u0635 \u0627\u0644\u0643\u0648\u062F \u0627\u0644\u0630\u064A \u0633\u062A\u0643\u062A\u0628\u0647 \u0641\u064A \u0648\u0627\u062A\u0633\u0622\u0628\n\n\u0645\u062B\u0627\u0644: !terHeb \u0623\u0648 !msaeda", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "mymsgs_show_codes" }]] } }); return;
  }
  if (data.startsWith("mymsgs_code_mt_")) {
    const { getState: getStateCM, setState: setStateCM } = await Promise.resolve().then(() => (_deps.init_state(), _deps.state_exports));
    const stCM = getStateCM(userId);
    const mt = data.replace("mymsgs_code_mt_", "");
    setStateCM(userId, "mymsgs_code_step3", Object.assign({}, stCM && stCM.data || {}, { matchType: mt }));
    await bot2.sendMessage(chatId, "\u26A1 *\u0627\u0644\u062E\u0637\u0648\u0629 3/4:* \u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u0631\u062F:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
      [{ text: "\uD83D\uDCDD \u0646\u0635 \u062B\u0627\u0628\u062A", callback_data: "mymsgs_code_rt_text" }],
      [{ text: "\uD83D\uDD04 \u0645\u062A\u0646\u0627\u0648\u0628 (\u0639\u062F\u0629 \u0631\u062F\u0648\u062F)", callback_data: "mymsgs_code_rt_rotating" }],
      [{ text: "\uD83E\uDD16 \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A", callback_data: "mymsgs_code_rt_ai" }],
      [{ text: "\uD83D\uDDBC\uFE0F \u0635\u0648\u0631\u0629 (\u0628\u062D\u062B \u062A\u0644\u0642\u0627\u0626\u064A)", callback_data: "mymsgs_code_rt_image" }],
      [{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "mymsgs_show_codes" }]
    ] } }); return;
  }
  if (data.startsWith("mymsgs_code_rt_")) {
    const { getState: getStateCR, setState: setStateCR } = await Promise.resolve().then(() => (_deps.init_state(), _deps.state_exports));
    const stCR = getStateCR(userId);
    const rt = data.replace("mymsgs_code_rt_", "");
    setStateCR(userId, "mymsgs_code_step4", Object.assign({}, stCR && stCR.data || {}, { replyType: rt }));
    const rtHints = { text: "\u0623\u0631\u0633\u0644 \u0646\u0635 \u0627\u0644\u0631\u062F:", rotating: "\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u062F\u0648\u062F \u0645\u0641\u0635\u0648\u0644\u0629 \u0628\u0640 ||\n\u0645\u062B\u0627\u0644: \u0623\u0647\u0644\u0627\u064B!||\u0645\u0631\u062D\u0628\u0627\u064B!||\u0647\u0644\u0627 \u0648\u0633\u0647\u0644\u0627!", ai: "\u0623\u0631\u0633\u0644 \u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0623\u0648 \u0623\u0631\u0633\u0644 - \u0644\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A:", image: "\u0623\u0631\u0633\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0628\u062D\u062B \u0639\u0646 \u0627\u0644\u0635\u0648\u0631\u0629:" };
    await bot2.sendMessage(chatId, "\u26A1 *\u0627\u0644\u062E\u0637\u0648\u0629 4/4:* " + (rtHints[rt] || "\u0623\u0631\u0633\u0644 \u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0631\u062F:"), { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "mymsgs_show_codes" }]] } }); return;
  }
  if (editMap[data]) {
    const { field, label, example } = editMap[data];
    const { setState: setState2 } = await Promise.resolve().then(() => (_deps.init_state(), _deps.state_exports));
    setState2(userId, "mymsgs_edit_cmd", { field });
    await bot2.sendMessage(chatId, `\u270F\uFE0F *\u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629: ${label}*\n\n\u0627\u0644\u062D\u0627\u0644\u064A: \`${s[field]}\`\n\n\u0623\u0631\u0633\u0644 \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 (\u0645\u062B\u0627\u0644: \`${example}\`):`, { parse_mode: "Markdown", reply_markup: _deps.cancelKeyboard() }); return;
  }
}

export async function handleMyMsgsTextInput(bot2, chatId, userId, text, state) {
  if (state.state === "awaiting_link_phone") {
    const { clearState: clearStateLink } = await Promise.resolve().then(() => (_deps.init_state(), _deps.state_exports));
    const phone = text.replace(/\D/g, "");
    if (!phone || phone.length < 7) {
      await bot2.sendMessage(chatId, "\u274c \u0631\u0642\u0645 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d", { reply_markup: _deps.cancelKeyboard() });
      return true;
    }
    clearStateLink(userId);
    const sess5 = _deps.inMemoryDB?.sessions?.get(String(userId));
    if (!sess5?.sock) {
      await bot2.sendMessage(chatId, "\u274C \u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0644\u0633\u0629 \u0648\u0627\u062A\u0633\u0622\u0628 \u0646\u0634\u0637\u0629.");
      return true;
    }
    try {
      const pairCode = await sess5.sock.requestPairingCode(phone);
      await bot2.sendMessage(chatId, `\u{1F517} *\u0631\u0645\u0632 \u0631\u0628\u0637 \u0627\u0644\u0631\u0642\u0645 +${phone}:*\n\n\`${pairCode}\`\n\n\u{1F4A1} \u0627\u0641\u062a\u062d \u0648\u0627\u062a\u0633\u0622\u0628 \u0639\u0644\u0649 \u0627\u0644\u0647\u0627\u062a\u0641 \u2190 \u0627\u0644\u062c\u0647\u0627\u0632 \u0627\u0644\u0645\u0631\u062a\u0628\u0637 \u2190 \u0631\u0628\u0637 \u0628\u0627\u0644\u0631\u0645\u0632\u060c \u0623\u062f\u062e\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u0639\u0644\u0627\u0647`, { parse_mode: "Markdown" });
    } catch (e) {
      await bot2.sendMessage(chatId, `\u274c \u062e\u0637\u0623 \u0641\u064a \u062a\u0648\u0644\u064a\u062f \u0627\u0644\u0631\u0645\u0632: ${e.message}`);
    }
    return true;
  }
  if (state.state === "mymsgs_code_step1") {
    const trigger = text.trim();
    if (!trigger) { await bot2.sendMessage(chatId, "\u26A0\uFE0F \u0646\u0635 \u0627\u0644\u0643\u0648\u062F \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0641\u0627\u0631\u063A\u0627\u064B"); return true; }
    const { setState: setStateW2 } = await Promise.resolve().then(() => (_deps.init_state(), _deps.state_exports));
    setStateW2(userId, "mymsgs_code_step2", { trigger });
    await bot2.sendMessage(chatId, "\u26A1 *\u0627\u0644\u062E\u0637\u0648\u0629 2/4:* \u0627\u0644\u0643\u0648\u062F: " + trigger + "\n\n\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u062A\u0637\u0627\u0628\u0642:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
      [{ text: "\uD83C\uDFAF \u062A\u0637\u0627\u0628\u0642 \u062A\u0627\u0645", callback_data: "mymsgs_code_mt_exact" }, { text: "\uD83D\uDD0D \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649", callback_data: "mymsgs_code_mt_contains" }],
      [{ text: "\u25B6\uFE0F \u064A\u0628\u062F\u0623 \u0628\u0640", callback_data: "mymsgs_code_mt_starts" }, { text: "\u25C0\uFE0F \u064A\u0646\u062A\u0647\u064A \u0628\u0640", callback_data: "mymsgs_code_mt_ends" }],
      [{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "mymsgs_show_codes" }]
    ] } }); return true;
  }
  if (state.state === "mymsgs_code_step4") {
    const content4 = text.trim();
    if (!content4) { await bot2.sendMessage(chatId, "\u26A0\uFE0F \u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0641\u0627\u0631\u063A\u0627\u064B"); return true; }
    const { clearState: clearStateW4 } = await Promise.resolve().then(() => (_deps.init_state(), _deps.state_exports));
    const { trigger: trW4, matchType: mtW4, replyType: rtW4 } = state.data || {};
    const newCode4 = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      trigger: trW4 || "",
      matchType: mtW4 || "exact",
      replyType: rtW4 || "text",
      replyContent: content4,
      enabled: true
    };
    const existingCodes4 = getMyMsgsSettings(_deps.getUser(userId)).customCodes || [];
    saveMyMsgsSettings(userId, { customCodes: [...existingCodes4, newCode4] });
    clearStateW4(userId);
    const mtLbl = { exact: "\u062A\u0637\u0627\u0628\u0642 \u062A\u0627\u0645", contains: "\u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649", starts: "\u064A\u0628\u062F\u0623 \u0628\u0640", ends: "\u064A\u0646\u062A\u0647\u064A \u0628\u0640" };
    const rtLbl = { text: "\u0646\u0635 \u062B\u0627\u0628\u062A", rotating: "\u0645\u062A\u0646\u0627\u0648\u0628", ai: "\u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A", image: "\u0635\u0648\u0631\u0629" };
    await bot2.sendMessage(chatId, "\u2705 *\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0643\u0648\u062F \u0628\u0646\u062C\u0627\u062D!*\n\n\uD83D\uDCCC \u0627\u0644\u0643\u0648\u062F: " + newCode4.trigger + "\n\uD83D\uDD0D \u0627\u0644\u062A\u0637\u0627\u0628\u0642: " + (mtLbl[newCode4.matchType] || newCode4.matchType) + "\n\uD83D\uDCDD \u0627\u0644\u0631\u062F: " + (rtLbl[newCode4.replyType] || newCode4.replyType), { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "\u26A1 \u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u062E\u0627\u0635\u0629", callback_data: "mymsgs_show_codes" }]] } });
    return true;
  }
  if (state.state !== "mymsgs_edit_cmd") return false;
  const field = state.data?.field;
  if (!field) return false;
  const cmd = text.trim();
  if (!cmd) {
    await bot2.sendMessage(chatId, "\u274C \u0627\u0644\u0643\u0644\u0645\u0629 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0641\u0627\u0631\u063A\u0629", { reply_markup: _deps.cancelKeyboard() });
    return true;
  }
  const { clearState: clearState2 } = await Promise.resolve().then(() => (_deps.init_state(), _deps.state_exports));
  const ns = saveMyMsgsSettings(userId, { [field]: cmd });
  clearState2(userId);
  const labels = {
    profilePicCmd: "\u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644",
    exportMembersCmd: "\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0623\u0639\u0636\u0627\u0621",
    copyCmd: "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644",
    imgCmd: "\u0628\u062D\u062B \u0627\u0644\u0635\u0648\u0631",
    vidCmd: "\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648",
    tiktokCmd: "\u062A\u064A\u0643 \u062A\u0648\u0643",
    songCmd: "\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0623\u063A\u0627\u0646\u064A",
    aiCmd: "\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A",
    delCmd: "\u062D\u0630\u0641 \u0627\u0644\u0631\u0633\u0627\u0626\u0644",
    aiImgCmd: "\u062A\u0648\u0644\u064A\u062F \u0635\u0648\u0631\u0629 AI",
    filmCmd: "\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u0644\u0645",
    statusCopyCmd: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629",
    codCmd: "/cod",
    locateCmd: "\u062A\u062A\u0628\u0639 \u0627\u0644\u0645\u0648\u0642\u0639",
  };
  await bot2.sendMessage(chatId, `\u2705 \u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 *${labels[field] || field}* \u0625\u0644\u0649: \`${cmd}\``, { parse_mode: "Markdown", reply_markup: myMsgsMenuKeyboard(ns) });
  return true;
}
