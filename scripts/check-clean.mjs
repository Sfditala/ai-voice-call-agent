// Runs in CI. Fails if the repo carries credentials, tokens, real IDs or personal addresses,
// or if a replayed call names a tool that isn't in the workflow.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const problems = [];
const files = ["workflow.json", "agent/elevenlabs-agent.json", "site/data.js", "README.md", "index.html"];

const patterns = [
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JWT-like token"],
  [/\bsk-[A-Za-z0-9_-]{16,}/, "OpenAI-style key"],
  [/\bsk_[a-f0-9]{30,}/, "ElevenLabs-style key"],
  [/\bAIza[A-Za-z0-9_-]{20,}/, "Google API key"],
  [/\b\d{8,12}:[A-Za-z0-9_-]{30,}/, "Telegram bot token"],
  [/Bearer\s+(?!YOUR_)[A-Za-z0-9._-]{20,}/, "real Bearer token"],
  [/\b[a-f0-9]{48,}\b/, "long hex secret"],
  [/[\w.+-]+@(gmail|outlook|hotmail|yahoo)\.[a-z.]+/i, "personal email address"],
  [/(docs|drive)\.google\.com\/[^\s"]+/, "private Google link"],
  [/\bagent_[a-z0-9]{20,}/, "ElevenLabs agent id"],
  [/[a-z0-9-]+\.app\.n8n\.cloud/, "real n8n host"],
];
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const [pattern, label] of patterns) if (pattern.test(text)) problems.push(`${file}: ${label}`);
}

const wf = JSON.parse(fs.readFileSync(path.join(root, "workflow.json"), "utf8"));
for (const node of wf.nodes) {
  if (node.webhookId) problems.push(`${node.name}: webhookId`);
  for (const [type, cred] of Object.entries(node.credentials || {})) {
    if (cred.id) problems.push(`${node.name}: ${type} credential id`);
  }
}
const tools = new Set(wf.nodes.filter((n) => n.parameters?.toolDescription).map((n) => n.name));

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "site/data.js"), "utf8"), sandbox);
const archIds = new Set(sandbox.window.PROJECT.arch.map((a) => a.id));
for (const call of sandbox.window.PROJECT.calls) {
  for (const line of call.lines) {
    if (line.who === "tool" && !tools.has(line.tool)) problems.push(`call "${call.label}" uses missing tool ${line.tool}`);
    if (line.who === "tool" && !archIds.has(line.tool)) problems.push(`call "${call.label}": ${line.tool} isn't on the diagram`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`All clean: ${wf.nodes.length} nodes, ${tools.size} tools, ${sandbox.window.PROJECT.calls.length} calls.`);
