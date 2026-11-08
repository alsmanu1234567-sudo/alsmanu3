// dist/site-generator.mjs — [NEW-FEATURE] أداة المطوّر: مواقع مؤقتة عامة
// ────────────────────────────────────────────────────────────────
// تُنشئ خادم HTTP داخلي مستقل (بورت حقيقي خاص به) لكل "موقع" يطلبه
// المطوّر عبر تيليجرام، وتربطه برابط عام حقيقي عبر بوّابة داخل خادم
// البوت الرئيسي (dist/index.mjs) على المسار /tool/<code>/...
//
// القيد التقني (موثّق هنا لأنه سبب التصميم): بيئة الاستضافة هنا لا
// توصل من الإنترنت إلا البورت الأساسي للبوت. لذلك: كل موقع يحصل على
// بورت داخلي حقيقي مستقل (مع fallback تلقائي)، وتقوم البوابة بتمرير
// أي طلب يدخل على /tool/<code> إلى بورت ذلك الموقع تحديداً.

import http from "http";
import { randomBytes } from "crypto";

let _bot = null;
export function setSiteGeneratorBot(bot) { _bot = bot; }

// كود التطوير = يُستخدم أيضاً كمعرّف عام في الرابط ولإيقاف الموقع لاحقاً
const _sites = new Map(); // code -> { code, templateId, siteName, chatId, port, server, createdAt }

const PORT_RANGE_START = 4100;
const PORT_RANGE_END = 4199;

// ── القوالب المدعومة ──────────────────────────────────────────
export const TEMPLATES = {
  contact: {
    label: "📇 نموذج تواصل",
    fields: [
      { name: "name", label: "الاسم", type: "text", required: true },
      { name: "phone", label: "رقم الهاتف", type: "text", required: true },
      { name: "message", label: "الرسالة", type: "textarea", required: true },
    ],
  },
  survey: {
    label: "📊 استبيان رأي",
    fields: [
      { name: "name", label: "الاسم (اختياري)", type: "text", required: false },
      { name: "rating", label: "التقييم من 1 إلى 10", type: "text", required: true },
      { name: "feedback", label: "ملاحظاتك", type: "textarea", required: true },
    ],
  },
  order: {
    label: "🛒 نموذج طلب",
    fields: [
      { name: "name", label: "الاسم الكامل", type: "text", required: true },
      { name: "phone", label: "رقم الهاتف", type: "text", required: true },
      { name: "address", label: "العنوان", type: "text", required: true },
      { name: "product", label: "المنتج / الطلب", type: "textarea", required: true },
    ],
  },
};

export function getTemplateList() {
  return Object.entries(TEMPLATES).map(([id, t]) => `\`${id}\` — ${t.label}`);
}

// ── أدوات مساعدة ──────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderFormHtml(siteName, template) {
  const fieldsHtml = template.fields.map((f) => {
    const req = f.required ? "required" : "";
    if (f.type === "textarea") {
      return `<label>${escapeHtml(f.label)}${f.required ? " *" : ""}<textarea name="${f.name}" ${req}></textarea></label>`;
    }
    return `<label>${escapeHtml(f.label)}${f.required ? " *" : ""}<input type="text" name="${f.name}" ${req} /></label>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(siteName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; margin: 0; padding: 40px 16px; }
  .card { background: #1e293b; border-radius: 16px; padding: 28px; max-width: 460px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
  h1 { font-size: 20px; margin: 0 0 20px; text-align: center; }
  label { display: block; margin-bottom: 14px; font-size: 14px; }
  input, textarea { width: 100%; margin-top: 6px; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-family: inherit; font-size: 14px; }
  textarea { min-height: 90px; resize: vertical; }
  button { width: 100%; padding: 12px; border: none; border-radius: 8px; background: #22c55e; color: #052e12; font-weight: bold; font-size: 15px; cursor: pointer; margin-top: 6px; }
  button:disabled { opacity: .6; cursor: not-allowed; }
  .msg { text-align: center; padding: 10px; border-radius: 8px; margin-top: 14px; font-size: 14px; display: none; }
  .msg.ok { background: #14532d; color: #bbf7d0; display: block; }
  .msg.err { background: #7f1d1d; color: #fecaca; display: block; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(siteName)}</h1>
    <form id="f">
      ${fieldsHtml}
      <button type="submit" id="btn">إرسال</button>
    </form>
    <div class="msg" id="msg"></div>
  </div>
  <script>
    const form = document.getElementById('f');
    const btn = document.getElementById('btn');
    const msg = document.getElementById('msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      msg.className = 'msg';
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const res = await fetch('submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('failed');
        msg.textContent = '✅ تم الإرسال بنجاح، شكراً لك!';
        msg.className = 'msg ok';
        form.reset();
      } catch {
        msg.textContent = '❌ حدث خطأ أثناء الإرسال، حاول مرة أخرى.';
        msg.className = 'msg err';
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function formatSubmissionMessage(site, data) {
  const template = TEMPLATES[site.templateId];
  const lines = [`📩 *بيانات جديدة من موقع:* ${site.siteName}`, `🔑 الكود: \`${site.code}\``, ""];
  for (const f of template.fields) {
    const v = data[f.name];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      lines.push(`*${f.label}:* ${v}`);
    }
  }
  return lines.join("\n");
}

// ── تشغيل بورت حقيقي مع fallback تلقائي ─────────────────────────
function listenOnFreePort(server, startPort, endPort) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    function tryNext() {
      if (port > endPort) {
        reject(new Error("لا يوجد بورت متاح ضمن النطاق"));
        return;
      }
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          port++;
          tryNext();
        } else {
          reject(err);
        }
      });
      server.listen(port, "127.0.0.1", () => {
        server.removeAllListeners("error");
        resolve(port);
      });
    }
    tryNext();
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 200_000) { reject(new Error("payload too large")); req.destroy(); return; }
      body += chunk;
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// ── إنشاء/إيقاف المواقع ──────────────────────────────────────────
export function isCodeActive(code) { return _sites.has(code); }
export function listSites() { return Array.from(_sites.values()); }

export function generateRandomCode() {
  return randomBytes(3).toString("hex");
}

export async function startSite({ code, templateId, siteName, chatId, baseUrl }) {
  if (!code || !/^[a-zA-Z0-9_-]{2,32}$/.test(code)) {
    throw new Error("الكود غير صالح — استخدم أحرف/أرقام فقط (2-32 حرفاً)");
  }
  const template = TEMPLATES[templateId];
  if (!template) throw new Error("نوع الموقع غير معروف");
  if (_sites.has(code)) throw new Error(`الكود \`${code}\` مستخدم بالفعل — أوقفه أولاً أو اختر كوداً آخر`);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://internal");
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderFormHtml(siteName, template));
        return;
      }
      if (req.method === "POST" && url.pathname === "/submit") {
        const data = await readJsonBody(req);
        const site = _sites.get(code);
        if (site && _bot) {
          await _bot.sendMessage(site.chatId, formatSubmissionMessage(site, data), { parse_mode: "Markdown" }).catch(() => {});
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("غير موجود");
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("خطأ داخلي");
    }
  });

  const port = await listenOnFreePort(server, PORT_RANGE_START, PORT_RANGE_END);
  const site = { code, templateId, siteName, chatId, port, server, createdAt: Date.now() };
  _sites.set(code, site);

  const publicUrl = `${baseUrl.replace(/\/$/, "")}/tool/${code}/`;
  return { code, port, publicUrl, templateLabel: template.label };
}

export function stopSite(code) {
  const site = _sites.get(code);
  if (!site) return false;
  try { site.server.close(); } catch {}
  _sites.delete(code);
  return true;
}

// ── بوّابة داخلية: تُستدعى من dist/index.mjs لأي طلب /tool/:code/* ─────
// تُمرَّر الطلب مباشرة إلى بورت الموقع الداخلي المطابق دون إعادة توجيه
// خارجية، بحيث يبقى الرابط العام موحّداً على نطاق البوت الأساسي.
export function handleGatewayRequest(req, res, code, subPath) {
  const site = _sites.get(code);
  if (!site) {
    res.status ? res.status(404).send("هذا الموقع غير متاح — ربما تم إيقافه") : (res.writeHead(404), res.end("غير متاح"));
    return;
  }
  const proxyReq = http.request(
    {
      host: "127.0.0.1",
      port: site.port,
      path: "/" + (subPath || "").replace(/^\/+/, ""),
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("تعذر الوصول للموقع");
  });
  req.pipe(proxyReq);
}
