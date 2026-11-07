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
const names = new Set(wf.nodes.map((n) => n.name));
for (const [from, outs] of Object.entries(wf.connections)) {
  if (!names.has(from)) problems.push(`connection from missing node "${from}"`);
  for (const branch of Object.values(outs).flat()) for (const c of branch) if (!names.has(c.node)) problems.push(`connection to missing node "${c.node}"`);
}
for (const node of wf.nodes) {
  const sheet = node.parameters?.sheetName;
  if (sheet && sheet.mode !== "name") problems.push(`${node.name}: pick the sheet tab by name, a numeric tab id broke v1`);
}
// A tool is any node wired into the MCP Server Trigger.
const tools = new Set(Object.entries(wf.connections).filter(([, o]) => o.ai_tool).map(([name]) => name));

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "site/data.js"), "utf8"), sandbox);
const P = sandbox.window.PROJECT;
const archIds = new Set(P.arch.map((a) => a.id));
const retired = P.retired || {};
for (const t of tools) if (!archIds.has(t)) problems.push(`tool ${t} isn't on the diagram`);
for (const [old, id] of Object.entries(retired)) if (!archIds.has(id)) problems.push(`retired tool ${old} maps to ${id}, which isn't on the diagram`);
for (const call of P.calls) {
  for (const line of call.lines) {
    if (line.who !== "tool") continue;
    if (!tools.has(line.tool) && !retired[line.tool]) problems.push(`call "${call.label}" uses unknown tool ${line.tool}`);
    if (retired[line.tool] && call.version !== "v1") problems.push(`call "${call.label}" uses retired tool ${line.tool} but isn't marked v1`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`All clean: ${wf.nodes.length} nodes, ${tools.size} tools, ${sandbox.window.PROJECT.calls.length} calls.`);
