import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const YTDLP = process.env.YTDLP_PATH || join(ROOT, "bin", "yt-dlp");
const VIDEO_URL = process.env.LINK_VIDEO_TEST_URL || "";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36";
const QUALITY = {
  "3": {
    ceiling: 1080,
    selector: "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
  },
  "2": {
    ceiling: 720,
    selector: "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
  },
  "1": {
    ceiling: 480,
    selector: "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
  },
};

function validateInput() {
  assert.ok(VIDEO_URL, "Set LINK_VIDEO_TEST_URL to the user-provided video page.");
  const url = new URL(VIDEO_URL);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname.toLowerCase(), "ara.thexh.live");
  assert.match(url.pathname, /^\/videos\/[^/]+\/?$/);
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.ok(!url.port, "Non-default ports are not allowed.");
}

function runYtDlp(args, timeout = 180_000) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      YTDLP,
      [
        "--ignore-config",
        "--no-warnings",
        "--no-progress",
        "--no-playlist",
        "--user-agent",
        USER_AGENT,
        "--referer",
        VIDEO_URL,
        "--js-runtimes",
        `node:${process.execPath}`,
        ...args,
        VIDEO_URL,
      ],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      rejectRun(new Error("yt-dlp timed out"));
    }, timeout);

    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      rejectRun(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) return resolveRun({ stdout, stderr });
      const reason = /Unsupported URL/i.test(stderr)
        ? "unsupported source page"
        : /HTTP Error 403|HTTP 403/i.test(stderr)
          ? "source denied the request (403)"
          : /HTTP Error 404|HTTP 404/i.test(stderr)
            ? "source page was not found (404)"
            : /max-filesize|file is larger|filesize/i.test(stderr)
              ? "selected media exceeds the configured size limit"
              : `yt-dlp exited with ${code ?? signal ?? "unknown status"}`;
      rejectRun(new Error(reason));
    });
  });
}

function runCurl(args, timeout = 30_000) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("curl", args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      rejectRun(new Error("curl timed out"));
    }, timeout);
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.once("error", () => {
      clearTimeout(timer);
      rejectRun(new Error("curl could not start"));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolveRun(stdout.trim());
      rejectRun(new Error(`curl exited with ${code ?? "unknown status"}`));
    });
  });
}

function parseJson(stdout) {
  for (const line of stdout.split(/\r?\n/).reverse()) {
    const candidate = line.trim();
    if (!candidate.startsWith("{")) continue;
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  throw new Error("yt-dlp did not return JSON metadata");
}

function selectedFormats(info) {
  return info.requested_formats?.length ? info.requested_formats : [info];
}

function summarize(info) {
  const formats = (info.formats || [])
    .slice(0, 20)
    .map((format) => ({
      formatId: format.format_id || null,
      height: Number.isFinite(format.height) ? format.height : null,
      ext: format.ext || null,
      protocol: format.protocol || null,
      videoCodec: format.vcodec || null,
      audioCodec: format.acodec || null,
      size: format.filesize ?? format.filesize_approx ?? null,
      hasDirectUrl: Boolean(format.url),
    }));
  return {
    extractor: info.extractor_key || info.extractor || "unknown",
    durationSeconds: Number.isFinite(info.duration) ? info.duration : null,
    formats,
    subtitleLanguages: Object.keys(info.subtitles || {}),
    automaticSubtitleLanguages: Object.keys(info.automatic_captions || {}),
  };
}

validateInput();

test("extracts metadata and available formats from the page", async () => {
  const info = parseJson(
    (await runYtDlp(["--simulate", "--dump-single-json"])).stdout,
  );
  assert.ok(Array.isArray(info.formats) && info.formats.length > 0);
  console.log(`VIDEO_TEST_METADATA ${JSON.stringify(summarize(info))}`);
});

test("the public page responds without downloading media", async () => {
  const raw = await runCurl([
    "--silent",
    "--show-error",
    "--location",
    "--max-time",
    "20",
    "--output",
    "/dev/null",
    "--write-out",
    "%{http_code}|%{content_type}|%{size_download}",
    "--user-agent",
    USER_AGENT,
    VIDEO_URL,
  ]);
  const [statusText, contentType, bytes] = raw.split("|");
  const signals = {
    status: Number(statusText),
    contentType: (contentType || "").split(";")[0],
    responseBytes: Number(bytes) || 0,
  };
  console.log(`VIDEO_TEST_PAGE ${JSON.stringify(signals)}`);
  assert.equal(signals.status, 200, "The page must return HTTP 200.");
});

test("the media endpoint accepts a small range request", async () => {
  const info = parseJson(
    (await runYtDlp(["--simulate", "--dump-single-json"])).stdout,
  );
  const mediaUrl = info.formats?.find((format) => format.url)?.url;
  assert.ok(mediaUrl, "The extractor did not return a media URL.");
  const media = new URL(mediaUrl);
  assert.ok(["https:", "http:"].includes(media.protocol));
  const raw = await runCurl([
    "--silent",
    "--show-error",
    "--location",
    "--max-time",
    "20",
    "--range",
    "0-0",
    "--output",
    "/dev/null",
    "--write-out",
    "%{http_code}|%{content_type}|%{size_download}",
    "--user-agent",
    USER_AGENT,
    "--referer",
    VIDEO_URL,
    mediaUrl,
  ]);
  const [statusText, contentType, bytes] = raw.split("|");
  const signals = {
    mediaHost: media.hostname,
    status: Number(statusText),
    contentType: (contentType || "").split(";")[0],
    responseBytes: Number(bytes) || 0,
  };
  console.log(`VIDEO_TEST_MEDIA ${JSON.stringify(signals)}`);
  assert.ok(
    [200, 206].includes(signals.status) &&
      (signals.contentType.startsWith("video/") ||
        signals.contentType === "application/octet-stream"),
    "The source did not return a playable media response.",
  );
});

for (const [quality, profile] of Object.entries(QUALITY)) {
  test(`quality ${quality} selects video no higher than ${profile.ceiling}p`, async () => {
    const info = parseJson(
      (
        await runYtDlp([
          "--simulate",
          "--dump-single-json",
          "--format",
          profile.selector,
        ])
      ).stdout,
    );
    const formats = selectedFormats(info);
    const heights = formats
      .map((format) => format.height)
      .filter((height) => Number.isFinite(height));
    assert.ok(formats.length > 0, "No format was selected.");
    assert.ok(heights.length > 0, "The selected video format has no known height.");
    assert.ok(heights.every((height) => height <= profile.ceiling));
    assert.ok(
      formats.some((format) => format.vcodec && format.vcodec !== "none"),
      "The selected format has no video stream.",
    );
    console.log(`VIDEO_TEST_QUALITY ${quality} ${Math.max(...heights)}p`);
  });
}

test("downloads a high-quality sample within WhatsApp's current size cap", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "video-link-test-"));
  const outputTemplate = join(outputDir, "sample.%(ext)s");
  try {
    await runYtDlp(
      [
        "--format",
        QUALITY["3"].selector,
        "--max-filesize",
        "50M",
        "--merge-output-format",
        "mp4",
        "--output",
        outputTemplate,
      ],
      300_000,
    );
    const files = await readdir(outputDir);
    assert.equal(files.length, 1, "Expected exactly one downloaded media file.");
    const media = await stat(join(outputDir, files[0]));
    assert.ok(media.size > 5_000, "Downloaded media file is unexpectedly small.");
    assert.ok(media.size <= 55 * 1024 * 1024, "Downloaded media exceeds the send cap.");
    console.log(
      `VIDEO_TEST_DOWNLOAD ${JSON.stringify({ bytes: media.size, extension: files[0].split(".").pop() })}`,
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
