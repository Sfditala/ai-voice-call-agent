// Runs the real Code nodes from workflow.json through the book_call path, with the
// Google Sheets and Telegram steps faked. Checks the failures seen in real test calls.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const wf = JSON.parse(fs.readFileSync(path.join(root, "workflow.json"), "utf8"));
const code = (name) => {
  const node = wf.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`missing node "${name}"`);
  return node.parameters.jsCode;
};
const $now = { setZone: () => ({ toFormat: () => "2026-11-07 12:00" }) };

function run(name, { input, json, outputs }) {
  const $ = (n) => ({ first: () => ({ json: outputs[n] }) });
  const $input = { first: () => ({ json: input }) };
  const [item] = new Function("$input", "$json", "$", "$now", code(name))($input, json ?? input, $, $now);
  outputs[name] = item.json;
  return item.json;
}

// Mirrors the workflow's connections: clean → phone check → sheet → card → Telegram → answer.
function bookCall(args, { sheet = "ok", telegram = "ok" } = {}) {
  const outputs = {};
  const lead = run("Clean the lead", { input: args, outputs });
  if (!lead.phone_ok) return { reply: run("Ask for the number again", { input: lead, outputs }) };
  const marked = sheet === "ok"
    ? run("Saved", { input: {}, outputs })
    : run("Not saved", { input: {}, json: { error: { message: sheet } }, outputs });
  const card = run("Write the Telegram card", { input: marked, outputs });
  const tg = telegram === "ok" ? { ok: true, result: { text: card.text } } : { error: telegram };
  return { card: card.text, reply: run("Answer the agent", { input: tg, json: tg, outputs }) };
}

const checks = [];
const check = (label, cond) => checks.push([label, Boolean(cond)]);

// Arabic call from the test run: number spoken as words. Telegram must get digits.
let r = bookCall({ name: "سارة", phone: "صفر خمسة تسعة تسعة واحد اتنين تلاتة اربعة خمسة ستة", email: "", request: "شغل أتمتة", language: "ar" });
check("Arabic number words become digits", r.card.includes("0599123456"));
check("the card shows what was heard when it differs", r.card.includes("heard:"));
check("a normal save says so on the card", r.card.includes("✅ Saved"));
check("the agent may promise contact after a save", r.reply.saved && r.reply.say_to_caller.includes("will contact"));

// English call from the test run: the sheet failed. Tala must still get the lead.
r = bookCall({ name: "Cyrus", phone: "059-000-1234", email: "", request: "A voice assistant for his company", language: "en" }, { sheet: "Sheet with ID 0 not found" });
check("a sheet failure still reaches Telegram", r.reply.notified_tala === true && r.reply.saved === false);
check("the card flags the failed save", r.card.includes("NOT saved") && r.card.includes("Sheet with ID 0 not found"));
check("the agent may still promise contact, because Tala was told", r.reply.say_to_caller.includes("will contact"));

// Both steps fail: no promise.
r = bookCall({ name: "Sara", phone: "0590001234", email: "", request: "x", language: "en" }, { sheet: "down", telegram: "Bad Request: chat not found" });
check("nothing reached Tala → no promise", !r.reply.saved && !r.reply.notified_tala && r.reply.say_to_caller.includes("Do not promise"));

// A number that is too short is never saved.
r = bookCall({ name: "Sara", phone: "0588", email: "", request: "x", language: "en" });
check("a short number asks again and saves nothing", r.reply.saved === false && r.reply.say_to_caller.includes("repeat it"));

// Email spelled out loud.
r = bookCall({ name: "Sara", phone: "+970 599 123 456", email: "Sara At Example Dot Com", request: "x", language: "en" });
check("spoken email becomes an address", r.card.includes("sara@example.com") && !r.card.includes("looks wrong"));
check("international numbers keep their +", r.card.includes("+970599123456"));
r = bookCall({ name: "Sara", phone: "0599123456", email: "sara at gmail", request: "x", language: "en" });
check("a broken email is flagged, not dropped", r.card.includes("looks wrong"));

for (const [label, ok] of checks) console.log(`${ok ? "✓" : "✕"} ${label}`);
const failed = checks.filter(([, ok]) => !ok).length;
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log(`book_call: ${checks.length} checks passed.`);
