#!/usr/bin/env node
// Render the aster-fig figures of a post at desktop and phone width, screenshot each one, and check it.
//
//   node render.mjs POST.markdown [--fig ID] [--out DIR] [--no-build]
//   node render.mjs --snippet FIGURE.html [--out DIR] [--no-build]
//
// POST is a file in _posts/. --snippet renders a bare <figure> inside a post page instead (for drafts and
// for the examples). The site is built with `bundle exec jekyll build --future` unless --no-build is given;
// css/figure.css is copied into _site either way. Screenshots go to DIR (default $TMPDIR/aster-figure)
// as <figure id>-desktop.png and <figure id>-mobile.png.
//
// Checks, in the source: no colors, fonts or opacities in the markup (classes only), every <svg> has a
// viewBox of the right width, role="img" and an aria-label, every wide drawing (.d) has a phone drawing
// (.m), ids are prefixed and references resolve, no blank lines inside the figure, no font size below 12.
// Checks, in the browser at 1280px and at 375px: text smaller than 9.5px on screen, text outside its
// drawing, text running past the box it sits in or into a box it does not sit in, text overlapping text,
// unstyled (black) shapes, a page that scrolls sideways.
//
// The browser is $CHROME, else a Puppeteer cache under ~/.cache/puppeteer, else chromium / google-chrome
// on PATH; if none is found, chrome-headless-shell is fetched into ~/.cache/puppeteer with npx.
//
// Exit status: 0 no errors (warnings may remain), 1 errors, 2 usage or setup problem.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fs.realpathSync(fileURLToPath(import.meta.url)));
const root = (() => {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: here, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : path.resolve(here, "../../../..");
})();
const site = path.join(root, "_site");

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900, scale: 1, mobile: false },
  { name: "mobile", width: 375, height: 812, scale: 2, mobile: true },
];
const CANVAS = { d: 860, m: 320, narrow: 320, panel: 300 };
const MIN_FONT_UNITS = 12;

function die(msg) {
  console.error(`render: ${msg}`);
  process.exit(2);
}

// ---------- arguments ----------

const args = process.argv.slice(2);
const opt = { post: null, snippet: null, fig: null, out: path.join(os.tmpdir(), "aster-figure"), build: true };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--snippet") opt.snippet = args[++i];
  else if (a === "--fig") opt.fig = args[++i];
  else if (a === "--out") opt.out = args[++i];
  else if (a === "--no-build") opt.build = false;
  else if (a === "-h" || a === "--help") {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 22).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(0);
  } else if (!a.startsWith("-") && !opt.post) opt.post = a;
  else die(`unknown argument ${a}`);
}
if (!opt.post === !opt.snippet) die("give either a post or --snippet FILE (see --help)");
const source = path.resolve(opt.post || opt.snippet);
if (!fs.existsSync(source)) die(`${source} does not exist`);
fs.mkdirSync(opt.out, { recursive: true });

// ---------- static checks on the source ----------

function staticCheck(text) {
  const issues = [];
  const figs = [...text.matchAll(/<figure\b[^>]*class="aster-fig"[^>]*>[\s\S]*?<\/figure>/g)].map((m) => m[0]);
  if (figs.length === 0) issues.push({ fig: "-", level: "ERROR", msg: 'no <figure class="aster-fig"> found' });
  const seenIds = new Map();
  for (const fig of figs) {
    const figId = (fig.match(/^<figure\b[^>]*\bid="([^"]+)"/) || [])[1];
    const tag = figId || "(no id)";
    const add = (level, msg) => issues.push({ fig: tag, level, msg });
    if (!figId) add("ERROR", 'the <figure> has no id="fig-…"');
    else if (!figId.startsWith("fig-")) add("ERROR", `figure id "${figId}" does not start with "fig-"`);
    if (opt.fig && figId !== opt.fig) continue;
    const prefix = figId ? figId.slice(4) + "-" : "";

    if (/\n[ \t]*\n/.test(fig)) add("ERROR", "blank line inside the figure: Markdown would end the HTML block there");
    for (const m of fig.matchAll(/\s(fill|stroke|stop-color|stop-opacity|color|opacity|fill-opacity|stroke-opacity|font-family)="([^"]*)"/g)) {
      const [, attr, val] = m;
      if ((attr === "fill" || attr === "stroke") && (val === "none" || /^url\(#[^)]+\)$/.test(val))) continue;
      add("ERROR", `${attr}="${val}": colors, opacities and fonts come from css/figure.css classes`);
    }
    for (const m of fig.matchAll(/\sstyle="([^"]*)"/g)) {
      if (!/^\s*fill:\s*url\(#[^)]+\)\s*;?\s*$/.test(m[1])) add("ERROR", `style="${m[1]}": only style="fill:url(#…)" is allowed`);
    }
    for (const m of fig.matchAll(/\sfont-size="([\d.]+)"/g)) {
      if (parseFloat(m[1]) < MIN_FONT_UNITS) add("ERROR", `font-size="${m[1]}" is below ${MIN_FONT_UNITS}`);
    }

    const svgs = [...fig.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    if (svgs.length === 0 && !/class="stats"/.test(fig)) add("ERROR", "no <svg> in the figure");
    let d = 0, m = 0;
    for (const svg of svgs) {
      const open = svg.match(/^<svg\b[^>]*>/)[0];
      const cls = (open.match(/\sclass="([^"]*)"/) || [, ""])[1].split(/\s+/).find((c) => c in CANVAS) || "panel";
      if (cls === "d") d++;
      if (cls === "m") m++;
      const vb = open.match(/\sviewBox="([^"]*)"/);
      if (!vb) add("ERROR", `<svg class="${cls}"> has no viewBox`);
      else {
        const w = parseFloat(vb[1].trim().split(/[\s,]+/)[2]);
        if (w !== CANVAS[cls]) add("WARN", `<svg class="${cls}"> is ${w} wide; the ${cls} canvas is ${CANVAS[cls]}`);
      }
      if (/\s(width|height)="/.test(open)) add("ERROR", "<svg> has width/height attributes; size comes from the CSS");
      if (!/\srole="img"/.test(open)) add("ERROR", '<svg> lacks role="img"');
      const label = open.match(/\saria-label="([^"]*)"/);
      if (!label || label[1].trim().length < 20) add("ERROR", "<svg> lacks an aria-label that describes the drawing");
      const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
      for (const id of ids) {
        if (prefix && !id.startsWith(prefix)) add("ERROR", `id "${id}" does not start with "${prefix}"`);
        if (seenIds.has(id)) add("ERROR", `id "${id}" is used twice on the page`);
        seenIds.set(id, true);
      }
      for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) {
        if (!ids.includes(ref[1])) add("ERROR", `url(#${ref[1]}) refers to an id outside this <svg>`);
      }
    }
    if (d !== m) add("ERROR", `${d} wide drawing(s) (.d) but ${m} phone drawing(s) (.m); each .d needs an .m`);
  }
  return issues;
}

const sourceText = fs.readFileSync(source, "utf8");
const issues = staticCheck(sourceText);

// ---------- build and locate the page ----------

if (opt.build) {
  const r = spawnSync("bundle", ["exec", "jekyll", "build", "--quiet", "--future"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) {
    process.stderr.write(r.stdout + r.stderr);
    die("jekyll build failed");
  }
}
if (!fs.existsSync(site)) die(`${site} does not exist; build the site first`);
// The stylesheet is what changes most while drawing; keep _site's copy current even without a build.
fs.copyFileSync(path.join(root, "css", "figure.css"), path.join(site, "css", "figure.css"));

function findPage() {
  if (opt.snippet) {
    const shell = findFile(site, (f) => /\/\d{4}\/\d\d\/\d\d\/[^/]+\.html$/.test(f));
    if (!shell) die("no built post found to use as the page shell");
    const html = fs.readFileSync(shell, "utf8");
    const page = html.replace(/<main>[\s\S]*<\/main>/, `<main>\n<p>Preview of ${path.basename(source)}.</p>\n${sourceText}\n</main>`);
    fs.writeFileSync(path.join(site, "aster-figure-preview.html"), page);
    return "/aster-figure-preview.html";
  }
  const perm = (sourceText.match(/^---[\s\S]*?^permalink:\s*"?([^"\n]+)"?\s*$[\s\S]*?^---/m) || [])[1];
  if (perm) return perm.endsWith("/") ? perm + "index.html" : perm;
  const slug = path.basename(source).replace(/^\d{4}-\d\d-\d\d-/, "").replace(/\.(markdown|md)$/, "");
  const f = findFile(site, (p) => path.basename(p) === `${slug}.html`);
  if (!f) die(`no built page for ${slug} in _site`);
  return "/" + path.relative(site, f).split(path.sep).join("/");
}
function findFile(dir, pred) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = findFile(p, pred);
      if (r) return r;
    } else if (pred(p)) return p;
  }
  return null;
}
const pagePath = findPage();

// ---------- a static server for _site ----------

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".json": "application/json", ".xml": "application/xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(site, p);
  if (!f.startsWith(site) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "content-type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const pageUrl = `http://127.0.0.1:${server.address().port}${encodeURI(pagePath)}`;

// ---------- the browser ----------

function findBrowser() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const cache = path.join(os.homedir(), ".cache", "puppeteer");
  for (const kind of ["chrome-headless-shell", "chrome"]) {
    const dir = path.join(cache, kind);
    if (!fs.existsSync(dir)) continue;
    for (const ver of fs.readdirSync(dir).sort().reverse()) {
      for (const plat of fs.readdirSync(path.join(dir, ver))) {
        const b = path.join(dir, ver, plat, kind === "chrome" ? "chrome" : "chrome-headless-shell");
        if (fs.existsSync(b)) return b;
      }
    }
  }
  for (const b of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const r = spawnSync("sh", ["-c", `command -v ${b}`], { encoding: "utf8" });
    if (r.status === 0) return r.stdout.trim();
  }
  return null;
}
let browserBin = findBrowser();
if (!browserBin) {
  console.error("render: fetching chrome-headless-shell into ~/.cache/puppeteer (one-time, about 150 MB)");
  const r = spawnSync("npx", ["--yes", "@puppeteer/browsers", "install", "chrome-headless-shell@stable",
    "--path", path.join(os.homedir(), ".cache", "puppeteer")], { stdio: "inherit" });
  browserBin = r.status === 0 ? findBrowser() : null;
  if (!browserBin) die("no browser; set CHROME=/path/to/chrome");
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aster-figure-chrome-"));
const browser = spawn(browserBin, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

async function devtoolsPort() {
  const f = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(f)) {
      const port = fs.readFileSync(f, "utf8").split("\n")[0].trim();
      if (port) return port;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("the browser did not start");
}

function connect(url) {
  const ws = new WebSocket(url);
  let next = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else {
      for (const w of [...waiters]) if (w.method === msg.method) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(msg.params);
      }
    }
  };
  return new Promise((resolve, reject) => {
    ws.onerror = () => reject(new Error("cannot connect to the browser"));
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        const id = ++next;
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      wait: (method) => new Promise((res) => waiters.push({ method, resolve: res })),
      close: () => ws.close(),
    });
  });
}

// Runs in the page. Returns the figures' positions and what is wrong with them.
function inspect(only) {
  const figs = [...document.querySelectorAll("figure.aster-fig")].filter((f) => !only || f.id === only);
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const out = [];
  for (const f of figs) {
    const issues = [];
    const add = (level, where, msg) => issues.push({ level, msg: `[${where}] ${msg}` });
    for (const s of f.querySelectorAll("svg")) {
      if (getComputedStyle(s).display === "none") continue;
      const sr = s.getBoundingClientRect();
      const where = s.getAttribute("class") || "panel";
      const vbw = s.viewBox.baseVal && s.viewBox.baseVal.width;
      const scale = vbw ? sr.width / vbw : 1;
      const live = (e) => !e.closest("defs") || e.closest("marker");
      for (const e of s.querySelectorAll("rect,circle,ellipse,polygon,path,line,polyline,text")) {
        if (!live(e)) continue;
        const cs = getComputedStyle(e);
        if (cs.fill === "rgb(0, 0, 0)" && cs.fill !== "none") add("ERROR", where, `<${e.tagName}> is unstyled (black fill)`);
      }
      const rects = [...s.querySelectorAll("rect")].filter(live).map((e) => e.getBoundingClientRect());
      const texts = [...s.querySelectorAll("text")].filter(live).map((t) => ({
        t, b: t.getBoundingClientRect(), s: JSON.stringify(t.textContent.trim().slice(0, 32)),
      })).filter((x) => x.b.width > 0);
      for (const { t, b, s: txt } of texts) {
        const px = parseFloat(getComputedStyle(t).fontSize) * scale;
        if (px < 9.5) add("ERROR", where, `${txt} is ${px.toFixed(1)}px on screen (min 9.5)`);
        else if (px < 10) add("WARN", where, `${txt} is ${px.toFixed(1)}px on screen`);
        if (b.left < sr.left - 0.5 || b.right > sr.right + 0.5 || b.top < sr.top - 0.5 || b.bottom > sr.bottom + 0.5)
          add("ERROR", where, `${txt} sticks out of the drawing`);
        const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
        let home = null;
        for (const q of rects) {
          const inside = cx >= q.left && cx <= q.right && cy >= q.top && cy <= q.bottom;
          if (inside && (!home || q.width * q.height < home.width * home.height)) home = q;
        }
        if (home) {
          const over = Math.max(home.left + 2 - b.left, b.right - (home.right - 2));
          if (over > 0.5) add("ERROR", where, `${txt} runs ${(over / scale).toFixed(0)} units past the side of its box`);
          const overV = Math.max(home.top - b.top, b.bottom - home.bottom);
          if (overV > 1) add("WARN", where, `${txt} crosses the top or bottom of its box`);
        }
        for (const q of rects) {
          if (q === home) continue;
          const inside = cx >= q.left && cx <= q.right && cy >= q.top && cy <= q.bottom;
          // Text sitting in a box that is nested in q is fine; text partly in q is a collision.
          if (!inside && area(b, q) > 2) add("ERROR", where, `${txt} runs into a box it is not in`);
        }
      }
      for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
        const shrink = (r) => ({ left: r.left, right: r.right, top: r.top + r.height * 0.2, bottom: r.bottom - r.height * 0.2 });
        if (area(shrink(texts[i].b), shrink(texts[j].b)) > 1) add("ERROR", where, `${texts[i].s} overlaps ${texts[j].s}`);
      }
    }
    const r = f.getBoundingClientRect();
    out.push({ id: f.id || "(no id)", x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, issues });
  }
  const sideways = document.documentElement.scrollWidth > innerWidth + 1;
  return JSON.stringify({ figs: out, sideways });
}

let failed = false;
try {
  const port = await devtoolsPort();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("the browser has no page");
  const c = await connect(page.webSocketDebuggerUrl);
  await c.send("Page.enable");
  for (const vp of VIEWPORTS) {
    await c.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.scale, mobile: vp.mobile });
    const loaded = c.wait("Page.loadEventFired");
    await c.send("Page.navigate", { url: pageUrl });
    await loaded;
    await c.send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => 1)", awaitPromise: true });
    const r = await c.send("Runtime.evaluate", { expression: `(${inspect})(${JSON.stringify(opt.fig)})`, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "inspect failed");
    const { figs, sideways } = JSON.parse(r.result.value);
    if (sideways) issues.push({ fig: "page", level: "ERROR", msg: `${vp.name}: the page scrolls sideways` });
    if (opt.fig && figs.length === 0) die(`no figure with id ${opt.fig} on the page`);
    for (const f of figs) {
      const pad = 12;
      const shot = await c.send("Page.captureScreenshot", {
        format: "png", captureBeyondViewport: true,
        clip: { x: Math.max(0, f.x - pad), y: Math.max(0, f.y - pad), width: f.w + 2 * pad, height: f.h + 2 * pad, scale: 1 },
      });
      const file = path.join(opt.out, `${f.id}-${vp.name}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
      console.log(`render: ${f.id} ${vp.name} ${vp.width}px -> ${file}`);
      for (const i of f.issues) issues.push({ fig: f.id, level: i.level, msg: `${vp.name} ${i.msg}` });
    }
  }
  c.close();
} catch (e) {
  console.error(`render: ${e.message}`);
  failed = true;
} finally {
  const exited = new Promise((r) => browser.once("exit", r));
  browser.kill();
  await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
  server.close();
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // A leftover profile in the temp directory is harmless.
  }
}
if (failed) process.exit(2);

const seen = new Set();
const unique = issues.filter((i) => {
  const k = `${i.fig}|${i.level}|${i.msg}`;
  return seen.has(k) ? false : seen.add(k);
});
for (const i of unique) console.log(`${i.level.padEnd(5)} ${i.fig}: ${i.msg}`);
const errors = unique.filter((i) => i.level === "ERROR").length;
const warns = unique.length - errors;
console.log(`render: ${errors} error(s), ${warns} warning(s)`);
process.exit(errors ? 1 : 0);
