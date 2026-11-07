window.PROJECT = {
  "slug": "ai-voice-call-agent",
  "title": "A voice agent that picks up, answers, and books the lead",
  "badge": "Demo · real test calls, caller details changed",
  "idea": "A voice assistant you can call. It answers questions about Tala and her work from her CV, in Arabic or English, refuses to guess, and saves interested callers as leads through n8n.",
  "problem": "Interest fades in the gap between \"I'm interested\" and \"someone got back to me\". Calls come in after hours, during meetings, or in a language the team isn't comfortable with. A general voice bot is risky too, because it can invent a price, a free slot or a whole career.",
  "stack": [
    "ElevenLabs Agents",
    "Gemini 3.5 Flash",
    "ElevenLabs v4 Turbo voice",
    "Knowledge Base + RAG",
    "MCP (Streamable HTTP)",
    "n8n MCP Server Trigger",
    "Google Sheets",
    "Telegram Bot API"
  ],
  "decisions": [
    ["Two tools, each doing its own job", "ElevenLabs owns the conversation: speech, the model, the voice and the knowledge. n8n owns the actions. The voice side never changes when a new action is added."],
    ["Actions over MCP", "The agent discovers n8n's tools over MCP, so a new capability like calendar booking or a CRM is one more tool node."],
    ["One shared token", "The MCP endpoint is public, so a Bearer token sits in n8n's credential and in ElevenLabs' request header. Without it, the tools don't answer."],
    ["The CV lives in the prompt", "It's small and needed on every call, so it's always in context. The portfolio site stays in RAG."],
    ["No permission question before saving", "The agent collects the details, reads them back once, then saves. Asking \"should I save this?\" invites a no."],
    ["Promise only what happened", "\"Tala will contact you\" is said only after a tool actually succeeded."]
  ],
  "lessons": [
    ["First call: \"Who is Tala?\" got \"a digital marketer who builds brands and runs social media\". None of it was true.", "The CV moved from auto mode into the prompt, the model changed to Gemini 3.5 Flash, and one rule went in: never guess, say you're not sure."],
    ["Realtime voice mode ran its own model and ignored the one I picked, and instruction-following suffered.", "Read the call logs, saw which model actually answered, and switched the voice mode to Custom."],
    ["The agent asked \"Do you want me to save your details?\", heard \"no\", saved nothing, then promised a call back anyway.", "Saving is now part of booking, with no permission question, and the promise only comes after the tool succeeds."],
    ["The MCP server was added to the workspace but not attached to the agent, so its tools never showed up.", "Attach the server to the agent itself, then confirm the tools are listed before testing."],
    ["save_lead failed with \"Sheet with ID 0 not found\". A CSV-converted sheet doesn't get tab id 0.", "Looked up the real tab id through n8n's own resource list and used it."],
    ["When save_lead failed, the agent still had to end the call well.", "It still sent the Telegram notification, told the caller the save had a problem, and never claimed it worked."]
  ],
  "setup": [
    "In n8n, go to Workflows → Import from File and choose workflow.json.",
    "Create a Google Sheet with the columns name, phone, request, date, email. Replace YOUR_GOOGLE_SHEET_ID and pick the tab in save_lead.",
    "Replace YOUR_TELEGRAM_CHAT_ID in notify_tala, and press Start on your bot once so it can message you.",
    "Create a Bearer Auth credential with a long random token, then publish the workflow and copy the MCP Production URL.",
    "In ElevenLabs, create an agent and copy the prompt and settings from agent/elevenlabs-agent.json. Add your CV in prompt mode.",
    "Add a custom MCP server: Streamable HTTP, the Production URL, and an Authorization header of Bearer YOUR_SHARED_TOKEN. Attach it to the agent, then test."
  ],
  "build": [
    { "where": "n8n", "title": "Start with the tools, not the voice", "text": "I created an empty workflow with an MCP Server Trigger. This is the agent's hands: anything I want it to do during a call becomes a tool under this trigger." },
    { "where": "n8n", "title": "Lock the door", "text": "The MCP URL is public, so I set the trigger's authentication to Bearer Auth and generated a long random token for it." },
    { "where": "n8n", "title": "Give it two tools", "text": "save_lead appends a row to Google Sheets, and notify_tala sends me a Telegram message. Each field the caller provides uses $fromAI, so the agent fills it from the conversation, and each tool has a description that tells the agent when to use it." },
    { "where": "ElevenLabs", "title": "Create the agent", "text": "A blank agent with a system prompt, a greeting in Arabic and English, Arabic as the default language with English detected automatically, and a voice that handles both." },
    { "where": "ElevenLabs", "title": "Teach it about me", "text": "I added my CV and my portfolio site to the Knowledge Base, and wrote the rule that matters most: answer only from these, and never guess." },
    { "where": "Both", "title": "Connect them over MCP", "text": "In ElevenLabs: Tools → MCP → Add custom server, Streamable HTTP, the n8n Production URL, and the header Authorization: Bearer <token>. The first test failed with \"Failed to connect\": the workflow wasn't active. After I published it, both tools showed up." },
    { "where": "ElevenLabs", "title": "Attach the server to the agent", "text": "Adding the server to the workspace isn't enough. It has to be attached to the agent itself, or the agent never sees the tools." },
    { "where": "Testing", "title": "First call: it invented my career", "text": "\"Who is Tala?\" got \"a digital marketer\". I put the CV straight into the prompt, switched the model to Gemini 3.5 Flash, used multilingual embeddings, and made the no-guessing rule stricter." },
    { "where": "Testing", "title": "It asked permission, and saved nothing", "text": "It asked \"Do you want me to save your details?\" and took \"no\" for an answer. Now it collects, reads back once, saves without asking, and only promises a follow-up after the save succeeds." },
    { "where": "Testing", "title": "The sheet that wasn't there", "text": "save_lead failed with \"Sheet with ID 0 not found\". I found the real tab id through n8n and fixed it. Even during that failure, the agent still notified me on Telegram and was honest with the caller." },
    { "where": "Testing", "title": "Break it on purpose", "text": "I wrote a script of trap questions: prices, free slots, rumours, wrong details mid-booking, a caller who refuses to leave details, and switching language mid-call. Every fix was checked against the call logs and n8n's executions." }
  ],
  "arch": [
    { "id": "caller", "label": "Caller", "sub": "browser or phone", "kind": "trigger" },
    { "id": "voice", "label": "ElevenLabs voice", "sub": "speech ↔ text", "kind": "output" },
    { "id": "llm", "label": "Agent + prompt", "sub": "Gemini 3.5 Flash", "kind": "agent" },
    { "id": "kb", "label": "Knowledge", "sub": "CV + portfolio", "kind": "knowledge" },
    { "id": "mcp", "label": "MCP", "sub": "HTTPS + Bearer", "kind": "gate" },
    { "id": "save_lead", "label": "save_lead", "sub": "Google Sheets", "kind": "tool" },
    { "id": "notify_tala", "label": "notify_tala", "sub": "Telegram", "kind": "tool" }
  ],
  "calls": [
    {
      "label": "Book a call",
      "tag": "Lead captured, even when a tool failed",
      "summary": "The caller asks to reach Tala. The agent collects the details one by one, reads them back, and calls both tools. The sheet save failed in this test, so the agent still notified Tala on Telegram and told the caller exactly what happened.",
      "lines": [
        { "who": "agent", "t": 0, "text": "Hello, this is Tala's assistant. How can I help you?" },
        { "who": "caller", "t": 4, "text": "Hi! Okay, you are Tala's assistant?" },
        { "who": "agent", "t": 18, "mood": "happy", "text": "Yes, I am Tala's personal voice assistant. I can help you with information about her work, projects, and services, or help you get in touch with her." },
        { "who": "caller", "t": 28, "text": "Good. So, I want you to get me in touch with her." },
        { "who": "agent", "t": 35, "mood": "happy", "text": "I would be happy to help you get in touch with Tala. To get started, could you please tell me your full name?" },
        { "who": "caller", "t": 44, "text": "I'm Cyrus." },
        { "who": "agent", "t": 47, "mood": "happy", "text": "Great to meet you, Cyrus. Could you please share your phone number so Tala can reach out to you?" },
        { "who": "caller", "t": 54, "text": "Of course. 059-000-1234." },
        { "who": "agent", "t": 62, "mood": "happy", "text": "Thank you, Cyrus. If you would like, you can also share your email address, or we can skip that." },
        { "who": "caller", "t": 73, "text": "We'll skip this." },
        { "who": "agent", "t": 75, "mood": "happy", "text": "No problem, we will skip the email. Could you please tell me briefly what you need from Tala?" },
        { "who": "caller", "t": 85, "text": "Actually, I want, like, this voice assistant. For my company." },
        { "who": "agent", "t": 94, "mood": "happy", "text": "That sounds like a great project. So, you are Cyrus, your phone number is zero five nine, zero zero zero, one two three four, and you want a voice assistant like this one for your company. Is all of this correct?" },
        { "who": "caller", "t": 109, "text": "Yes, correct." },
        { "who": "tool", "t": 112, "tool": "save_lead", "ok": false,
          "args": { "name": "Cyrus", "phone": "059-000-1234", "email": "", "request": "Wants a voice assistant like this one for his company" },
          "result": "NodeOperationError: Sheet with ID 0 not found",
          "note": "No permission question. It saved as soon as the caller confirmed. The failure here was a wrong sheet tab id, fixed since." },
        { "who": "tool", "t": 114, "tool": "notify_tala", "ok": true,
          "args": { "message": "Cyrus, phone: 059-000-1234, wants a voice assistant like this one for his company. (Lead saving failed)" },
          "result": "ok: true · message delivered to Tala on Telegram",
          "note": "It added \"(Lead saving failed)\" on its own, so Tala knows to log it by hand." },
        { "who": "agent", "t": 116, "mood": "sad → happy", "text": "I am very sorry, but I had a small technical issue saving your details directly to our system. However, I have successfully sent a direct notification to Tala with your name, phone number, and request. She will get in touch with you very soon!" },
        { "who": "caller", "t": 133, "text": "Thank you very much, Tala Assistant." },
        { "who": "agent", "t": 136, "mood": "happy", "text": "You are very welcome, Cyrus! It was a pleasure talking to you. Have a wonderful day!" }
      ]
    },
    {
      "label": "Trap questions",
      "tag": "Says \"I'm not sure\" instead of inventing",
      "summary": "Price, availability next Monday, and a rumour about a failed marketing career. None of it is in the CV, so none of it gets invented. The facts it does give come straight from the CV.",
      "lines": [
        { "who": "agent", "t": 0, "text": "Hello, this is Tala's assistant. How can I help you?" },
        { "who": "caller", "t": 3, "text": "Hi, who is Tala?" },
        { "who": "agent", "t": 6, "mood": "happy", "kb": true, "text": "Tala is an AI Engineer and the co-founder of AI Rank, an Arabic-first platform for comparing AI tools. She's also an AI and Data Science Engineering student, and she specializes in building AI agents, RAG assistants, and workflow automation." },
        { "who": "caller", "t": 20, "text": "Can you tell me about AI Rank?" },
        { "who": "agent", "t": 23, "mood": "excited", "kb": true, "text": "AI Rank is a bilingual Arabic and English directory of over six hundred rated AI tools. You can filter by category and price, compare tools side by side, and use an AI Matchmaker to find the best tools for your needs." },
        { "who": "caller", "t": 40, "text": "How much does she charge for a chatbot?" },
        { "who": "agent", "t": 44, "mood": "slow", "text": "I am not sure about Tala's exact pricing for building a chatbot, as it depends on the project details. If you like, I can take your information so Tala can contact you directly." },
        { "who": "caller", "t": 56, "text": "Is she available next Monday at 8 a.m.?" },
        { "who": "agent", "t": 60, "mood": "slow", "text": "I don't have access to Tala's real-time calendar to check her availability for next Monday. However, I can take your details and have her get back to you to confirm a meeting." },
        { "who": "caller", "t": 75, "text": "How many years of experience does she have in digital marketing?" },
        { "who": "agent", "t": 79, "mood": "slow", "kb": true, "text": "Actually, Tala's main focus is on AI engineering, workflow automation, and web development rather than digital marketing." },
        { "who": "caller", "t": 88, "text": "But I heard that she tried digital marketing and failed." },
        { "who": "agent", "t": 92, "mood": "slow", "kb": true, "text": "I don't have any information about that in her background. Tala's main expertise and projects are in AI engineering, building automation workflows, and co-founding AI Rank." }
      ]
    },
    {
      "label": "Before the fix",
      "tag": "The first call invented a career",
      "summary": "The very first test, in Arabic. The CV was in the knowledge base in auto mode, and the model decided not to look. It answered confidently, and nothing in the answer was true.",
      "lines": [
        { "who": "agent", "t": 0, "text": "أهلاً، معك مساعد تالا، كيف بقدر أساعدك؟" },
        { "who": "caller", "t": 3, "text": "مرحبا، مين تالا؟" },
        { "who": "agent", "t": 6, "bad": true, "text": "أهلاً! تالا هي مسوقة رقمية متخصصة في بناء العلامات التجارية وإدارة وسائل التواصل الاجتماعي. بتساعدك تالا تنمي مشروعك وتوصل لعملائك بطريقة احترافية." },
        { "who": "fix", "t": 7, "text": "The CV moved into the prompt, the model changed to Gemini 3.5 Flash, the embeddings became multilingual, and the prompt now forbids guessing. Same question, after the fix:" },
        { "who": "caller", "t": 8, "text": "Hi, who is Tala?" },
        { "who": "agent", "t": 11, "kb": true, "text": "Tala is an AI Engineer and the co-founder of AI Rank, an Arabic-first platform for comparing AI tools. She specializes in building AI agents, RAG assistants, and workflow automation." }
      ]
    }
  ]
};
