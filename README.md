<p align="center"><img src="assets/banner.svg" alt="A voice agent that picks up and books. ElevenLabs runs the call, n8n runs the actions over MCP." width="100%"></p>

<p align="center">
  <a href="https://sfditala.github.io/ai-voice-call-agent/"><img src="assets/button.svg" alt="Replay a real test call" width="320"></a>
</p>

> **Demo · real test calls, caller details changed.**

A voice assistant you can call. It answers questions about me and my work from my CV, in Arabic or English, refuses to guess, and saves interested callers as leads through n8n.

On the [project page](https://sfditala.github.io/ai-voice-call-agent/) you can replay real test calls line by line. While the transcript plays, you see which part of the system is working, and every tool call the agent makes, with its real arguments and result.

## Listen in on a test call

| Call | What happens |
|---|---|
| **Book a call** | The agent collects name, phone and need one question at a time, reads them back, and saves without asking permission. In this test the sheet save failed, so it still notified me on Telegram, flagged "(Lead saving failed)" in the message, and told the caller exactly what happened. |
| **Trap questions** | "How much does she charge?", "Is she free Monday at 8?", "I heard she failed at marketing." None of it is in the CV, so it says it isn't sure and offers to take details. |
| **Before the fix** | The very first call. Asked "مين تالا؟", it described me as a digital marketer. The same question after the fix, side by side. |

[▶ Replay the calls](https://sfditala.github.io/ai-voice-call-agent/)

## How it works

Two tools, each doing what it's best at.

```mermaid
flowchart LR
    C["📞 Caller"] <--> V["ElevenLabs<br/>speech ↔ text"]
    V <--> A(("Agent<br/>Gemini 3.5 Flash"))
    A <--> K[("Knowledge<br/>CV + portfolio")]
    A -- "MCP · HTTPS + Bearer" --> T["n8n<br/>MCP Server Trigger"]
    T --> S["save_lead<br/>Google Sheets"]
    T --> N["notify_tala<br/>Telegram"]
```

- **ElevenLabs owns the conversation:** speech-to-text, the model, the voice, the knowledge base, and switching between Arabic and English.
- **n8n owns the actions:** an MCP Server Trigger exposes two tools. Adding calendar booking or a CRM later is one more tool node, and the voice side doesn't change.
- **One shared token** protects the MCP endpoint. It sits in n8n's Bearer credential and in ElevenLabs' `Authorization` header.

**Stack:** ElevenLabs Agents · Gemini 3.5 Flash · ElevenLabs v4 Turbo · Knowledge Base + RAG · MCP (Streamable HTTP) · n8n · Google Sheets · Telegram Bot API

<details open>
<summary><b>Design decisions</b></summary>

- **The CV lives in the prompt.** It's small and needed on every call. The portfolio site stays in RAG, with multilingual embeddings because callers ask in Arabic about an English CV.
- **No permission question before saving.** Collect, read back once, save. Asking "should I save this?" invites a no.
- **Promise only what happened.** "Tala will contact you" is said only after a tool actually succeeded.
- **Auto-approve tools.** A voice call can't pause for someone to click "approve".

</details>

<details>
<summary><b>What broke, and the fix</b></summary>

| What went wrong | The fix |
|---|---|
| The first "Who is Tala?" got an invented career in digital marketing. | The CV moved from auto mode into the prompt, the model changed to Gemini 3.5 Flash, and the prompt now forbids guessing. |
| Realtime voice mode ran its own model and ignored the one I picked. | Read the call logs, saw which model answered, switched the voice mode to Custom. |
| It asked "Do you want me to save your details?", heard "no", saved nothing, and promised a call back anyway. | Saving is part of booking, and the promise comes only after the tool succeeds. |
| The MCP server was added to the workspace but not attached to the agent. | Attach it to the agent, then check the tools are listed before testing. |
| `save_lead` failed with "Sheet with ID 0 not found". A CSV-converted sheet doesn't get tab id 0. | Looked up the real tab id through n8n's resource list. |

</details>

## Run it yourself

1. In n8n, go to **Workflows → Import from File** and choose [`workflow.json`](workflow.json).
2. Create a Google Sheet with the columns `name`, `phone`, `request`, `date`, `email`. Replace `YOUR_GOOGLE_SHEET_ID` and pick the tab in `save_lead`.
3. Replace `YOUR_TELEGRAM_CHAT_ID` in `notify_tala`, and press **Start** on your bot once so it can message you.
4. Create a **Bearer Auth** credential with a long random token. Publish the workflow and copy the MCP **Production URL**.
5. In ElevenLabs, create an agent and copy the prompt and settings from [`agent/elevenlabs-agent.json`](agent/elevenlabs-agent.json). Add your CV in **prompt** mode.
6. Add a custom MCP server: **Streamable HTTP**, the Production URL, and the header `Authorization: Bearer YOUR_SHARED_TOKEN`. Attach it to the agent, then test with the trap questions above.

This repo contains no credentials, tokens, agent IDs or real sheet and chat IDs. Personal values are placeholders, and [a check](scripts/check-clean.mjs) runs on every push.

## العربية

<div dir="rtl">

مساعد صوتي بتقدر تتصل فيه. بيجاوب عن تالا وشغلها من الـ CV بالعربي أو الإنجليزي، وما بيخمّن أي معلومة، وإذا المتصل مهتم بياخد اسمه ورقمه وشو بده، وبيسجله بـ Google Sheets وبيبعتلي ملخص على تلغرام.

المكالمة نفسها (الصوت، فهم الكلام، الموديل، المعلومات) كلها بـ ElevenLabs، والأفعال (التسجيل والإشعار) بـ n8n عن طريق MCP. بصفحة المشروع بتقدر تعيد تشغيل مكالمات تجريبية حقيقية وتشوف كل أداة وهي بتشتغل.

</div>

---

<p align="center">Built by <a href="https://portfolio-mauve-seven-44.vercel.app/"><b>Tala Safadi</b></a>, AI Engineer · <a href="https://www.linkedin.com/in/talasfdi">LinkedIn</a><br>More systems: <a href="https://github.com/Sfditala/clinic-ai-receptionist">Clinic AI Receptionist</a> · <a href="https://github.com/Sfditala/ai-marketing-team">AI Marketing Team</a> · <a href="https://github.com/Sfditala/telegram-personal-assistant">Telegram Personal Assistant</a></p>
