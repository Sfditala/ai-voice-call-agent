window.PROJECT = {
  "slug": "ai-voice-call-agent",
  "title": "A voice agent that picks up, answers, and never loses the lead",
  "badge": "Demo · real test calls, caller details changed",
  "idea": "A voice assistant you can call. It answers questions about Tala and her work from her CV, in Arabic or English, refuses to guess, and books interested callers through n8n with one tool that saves the lead and tells Tala, every time.",
  "problem": "Interest fades in the gap between \"I'm interested\" and \"someone got back to me\". Calls come in after hours, during meetings, or in a language the team isn't comfortable with. A general voice bot is risky too, because it can invent a price, a free slot or a whole career.",
  "stack": [
    "ElevenLabs Agents",
    "Gemini 3.5 Flash",
    "ElevenLabs v4 Turbo voice",
    "Knowledge Base + RAG",
    "MCP (Streamable HTTP)",
    "n8n MCP Server Trigger",
    "n8n sub-workflow tool",
    "Google Sheets",
    "Telegram Bot API",
    "Post-call analysis"
  ],
  "decisions": [
    [
      "Two platforms, each doing its own job",
      "ElevenLabs owns the conversation: speech, the model, the voice and the knowledge. n8n owns the actions. The voice side never changes when a new action is added."
    ],
    [
      "One tool that can't half-run",
      "v1 gave the model two tools and trusted it to call both. In one real call it saved nothing and never told Tala. Now book_call saves and notifies inside n8n, so the model makes one call and can't skip a step."
    ],
    [
      "Clean data in code, not in the prompt",
      "A phone number spoken as words, Arabic digits, an email spelled out loud: n8n turns them into digits and an address, and sends a too-short number back to the agent to ask again."
    ],
    [
      "The tool tells the agent what it may promise",
      "book_call returns saved, notified_tala and the exact line to say. \"Tala will contact you\" is only allowed when the lead actually reached her."
    ],
    [
      "A safety net after the call",
      "ElevenLabs pulls name, phone, request and outcome out of every transcript, and grades three checks: read back before saving, promised only what happened, no lead lost."
    ],
    [
      "The CV lives in the prompt",
      "It's small and needed on every call, so it's always in context. The portfolio site stays in RAG with multilingual embeddings."
    ],
    [
      "Actions over MCP, one shared token",
      "The agent discovers n8n's tools over MCP. The endpoint is public, so a Bearer token sits in n8n's credential and in ElevenLabs' request header."
    ]
  ],
  "lessons": [
    [
      "First call: \"Who is Tala?\" got \"a digital marketer who builds brands and runs social media\". None of it was true.",
      "The CV moved from auto mode into the prompt, the model changed to Gemini 3.5 Flash, and one rule went in: never guess, say you're not sure."
    ],
    [
      "Realtime voice mode ran its own model and ignored the one I picked.",
      "Read the call logs, saw which model actually answered, and switched the voice mode to Custom."
    ],
    [
      "The agent asked \"Do you want me to save your details?\", heard \"no\", saved nothing, then promised a call back anyway.",
      "Saving is part of booking, with no permission question, and the promise only comes from the tool's result."
    ],
    [
      "I thought \"Sheet with ID 0 not found\" was fixed. The logs said otherwise: every booking call in the test run still failed with it.",
      "The sheet tab is now picked by its name, \"Leads\". CI rejects a numeric tab id, so it can't come back."
    ],
    [
      "In one call the save failed and the agent never called notify_tala. The caller was given Tala's personal email instead, and the lead was lost.",
      "One tool, book_call, does both steps in n8n. The prompt also forbids handing out Tala's own contact details."
    ],
    [
      "In the Arabic call, Telegram got the phone number as words: \"صفر خمسة تسعة…\".",
      "n8n converts Arabic and English number words, and Arabic-Indic digits, to plain digits. The card also shows what was heard if it differs."
    ],
    [
      "The agent skipped the read-back in two of three booking calls, and a 9-digit number went through unchecked.",
      "The prompt makes the read-back mandatory (phone digit by digit, email letter by letter), and n8n refuses a number that isn't 9 or 10 digits."
    ],
    [
      "My own surname, Safadi, came back from the transcriber as \"الصفضي\".",
      "Speech-recognition keywords: Tala, Safadi, تالا, صفدي, AI Rank. And the agent now asks callers to spell names it isn't sure of."
    ],
    [
      "One turn took 4 seconds and Gemini failed. The backup model, GPT-4o, answered instead.",
      "Kept the backup LLM on. A voice call can't sit in silence while the main model retries."
    ]
  ],
  "setup": [
    "In n8n, go to Workflows → Import from File, choose workflow.json, and save it once. book_call points at the same workflow, so it needs a saved id.",
    "Create a Google Sheet with a tab named Leads and the columns date, name, phone, email, request, language, phone_heard. Replace YOUR_GOOGLE_SHEET_ID in \"Save to the Leads sheet\".",
    "Replace YOUR_TELEGRAM_CHAT_ID in \"Tell Tala on Telegram\", and press Start on your bot once so it can message you.",
    "Create a Bearer Auth credential with a long random token, then publish the workflow and copy the MCP Production URL.",
    "In ElevenLabs, create an agent and copy the prompt, speech keywords and post-call analysis from agent/elevenlabs-agent.json. Add your CV in prompt mode.",
    "Add a custom MCP server: Streamable HTTP, the Production URL, and an Authorization header of Bearer YOUR_SHARED_TOKEN. Attach it to the agent, check book_call is listed, then run the trap questions."
  ],
  "build": [
    {
      "where": "n8n",
      "title": "Start with the tools, not the voice",
      "text": "I created an empty workflow with an MCP Server Trigger. This is the agent's hands: anything I want it to do during a call becomes a tool under this trigger."
    },
    {
      "where": "n8n",
      "title": "Lock the door",
      "text": "The MCP URL is public, so I set the trigger's authentication to Bearer Auth and generated a long random token for it."
    },
    {
      "where": "n8n",
      "title": "Give it two tools",
      "text": "save_lead appends a row to Google Sheets, and notify_tala sends me a Telegram message. Each field the caller provides uses $fromAI, so the agent fills it from the conversation, and each tool has a description that tells the agent when to use it."
    },
    {
      "where": "ElevenLabs",
      "title": "Create the agent",
      "text": "A blank agent with a system prompt, a greeting in Arabic and English, Arabic as the default language with English detected automatically, and a voice that handles both."
    },
    {
      "where": "ElevenLabs",
      "title": "Teach it about me",
      "text": "I added my CV and my portfolio site to the Knowledge Base, and wrote the rule that matters most: answer only from these, and never guess."
    },
    {
      "where": "Both",
      "title": "Connect them over MCP",
      "text": "In ElevenLabs: Tools → MCP → Add custom server, Streamable HTTP, the n8n Production URL, and the header Authorization: Bearer <token>. The first test failed with \"Failed to connect\": the workflow wasn't active. After I published it, both tools showed up."
    },
    {
      "where": "ElevenLabs",
      "title": "Attach the server to the agent",
      "text": "Adding the server to the workspace isn't enough. It has to be attached to the agent itself, or the agent never sees the tools."
    },
    {
      "where": "Testing",
      "title": "First call: it invented my career",
      "text": "\"Who is Tala?\" got \"a digital marketer\". I put the CV straight into the prompt, switched the model to Gemini 3.5 Flash, used multilingual embeddings, and made the no-guessing rule stricter."
    },
    {
      "where": "Testing",
      "title": "It asked permission, and saved nothing",
      "text": "It asked \"Do you want me to save your details?\" and took \"no\" for an answer. Now it collects, reads back once, saves without asking, and only promises a follow-up after the save succeeds."
    },
    {
      "where": "Testing",
      "title": "The sheet that wasn't there",
      "text": "save_lead failed with \"Sheet with ID 0 not found\". I looked up the tab id through n8n and thought that was the end of it. It wasn't, as the logs showed later."
    },
    {
      "where": "Testing",
      "title": "Break it on purpose",
      "text": "I wrote a script of trap questions: prices, free slots, rumours, wrong details mid-booking, a caller who refuses to leave details, and switching language mid-call. Every fix was checked against the call logs and n8n's executions."
    },
    {
      "where": "Testing",
      "title": "Read the logs, not the vibes",
      "text": "I went through every test call in the ElevenLabs logs, tool call by tool call. The sheet error was still there in all three booking calls, one lead never reached me at all, and the Arabic call sent my phone number as words."
    },
    {
      "where": "n8n",
      "title": "One tool that can't half-run",
      "text": "save_lead and notify_tala became one tool, book_call: a sub-workflow that cleans the phone and email, saves to the sheet by tab name, sends Telegram whether or not the sheet worked, and tells the agent exactly what it may promise."
    },
    {
      "where": "ElevenLabs",
      "title": "A safety net after the call",
      "text": "Speech keywords for the names it kept mishearing, a stricter read-back in the prompt, and post-call analysis that pulls the lead out of every transcript and grades three checks, so a lost lead shows up on the dashboard."
    },
    {
      "where": "Testing",
      "title": "Test the workflow code, not just the prompt",
      "text": "A script runs the real Code nodes from workflow.json through the book_call path with the sheet and Telegram faked: number words, a failed sheet, both steps failing, a short number. It runs in CI on every push."
    }
  ],
  "arch": [
    {
      "id": "caller",
      "label": "Caller",
      "sub": "browser or phone",
      "kind": "trigger"
    },
    {
      "id": "voice",
      "label": "ElevenLabs voice",
      "sub": "speech ↔ text",
      "kind": "output"
    },
    {
      "id": "llm",
      "label": "Agent + prompt",
      "sub": "Gemini 3.5 Flash",
      "kind": "agent"
    },
    {
      "id": "kb",
      "label": "Knowledge",
      "sub": "CV + portfolio",
      "kind": "knowledge"
    },
    {
      "id": "mcp",
      "label": "MCP",
      "sub": "HTTPS + Bearer",
      "kind": "gate"
    },
    {
      "id": "book_call",
      "label": "book_call",
      "sub": "clean → save → notify",
      "kind": "tool"
    },
    {
      "id": "sheet",
      "label": "Leads sheet",
      "sub": "Google Sheets",
      "kind": "model"
    },
    {
      "id": "telegram",
      "label": "Telegram",
      "sub": "card to Tala",
      "kind": "model"
    }
  ],
  "calls": [
    {
      "label": "The lead that got lost",
      "version": "v1",
      "tag": "v1 · why there is one tool now",
      "summary": "Same sheet failure, different call. This time the model never called notify_tala, gave the caller Tala's personal email instead, and the lead reached nobody. It also skipped the read-back.",
      "lines": [
        {
          "who": "caller",
          "t": 195,
          "text": "Okay, okay. I'm interested. I would like to book a call with Tala."
        },
        {
          "who": "agent",
          "t": 203,
          "mood": "happy",
          "text": "That is great to hear! I can help you with that. To get started, could you please tell me your full name?"
        },
        {
          "who": "caller",
          "t": 210,
          "text": "Yes. My name is Sara Mohammed."
        },
        {
          "who": "agent",
          "t": 219,
          "mood": "happy",
          "text": "Nice to meet you, Sara! Could you please share your phone number so Tala can reach out to you?"
        },
        {
          "who": "caller",
          "t": 226,
          "text": "It's fine, I will share it. 059000567."
        },
        {
          "who": "agent",
          "t": 233,
          "mood": "happy",
          "text": "Thank you, Sara. Do you have an email address you would like to share as well, or should we skip that?"
        },
        {
          "who": "caller",
          "t": 239,
          "text": "Skip that."
        },
        {
          "who": "agent",
          "t": 241,
          "mood": "happy",
          "text": "No problem. Could you please tell me briefly what you would like to discuss with Tala?"
        },
        {
          "who": "caller",
          "t": 251,
          "text": "...like this amazing AI assistant calling."
        },
        {
          "who": "tool",
          "t": 256,
          "tool": "save_lead",
          "ok": false,
          "args": {
            "name": "Sara Mohammed",
            "phone": "059000567",
            "email": "",
            "request": "Wants to discuss building an amazing AI assistant like this calling one"
          },
          "result": "NodeOperationError: Sheet with ID 0 not found",
          "note": "No read-back before saving, and a 9-digit number nobody checked. Then no notify_tala at all."
        },
        {
          "who": "agent",
          "t": 258,
          "mood": "sad",
          "bad": true,
          "text": "I am very sorry, Sara, but I encountered a technical issue while trying to save your details. Could you please try contacting Tala directly at her email?"
        },
        {
          "who": "caller",
          "t": 273,
          "text": "Are you sure you have a technical issue?"
        },
        {
          "who": "agent",
          "t": 276,
          "mood": "sad",
          "text": "Yes, unfortunately, my system is having trouble saving the information right now. I highly recommend reaching out to Tala directly via her email."
        },
        {
          "who": "fix",
          "t": 290,
          "text": "v2: one tool, book_call. It saves and notifies inside n8n, so a failed sheet still sends Tala the card. It also refuses a number that isn't 9 or 10 digits and asks the agent to get it again. The prompt makes the read-back mandatory and forbids handing out Tala's own email."
        }
      ]
    },
    {
      "label": "حجز بالعربي",
      "version": "v1",
      "tag": "v1 · the number arrived as words",
      "summary": "An Arabic booking. The model skipped the read-back, the sheet failed, and the Telegram message carried the phone number spelled out in words. It also told the caller everything was sent, without saying the save had failed.",
      "lines": [
        {
          "who": "caller",
          "t": 26,
          "text": "خليها نتواصل معها هي، فنسّق مكالمة."
        },
        {
          "who": "agent",
          "t": 34,
          "mood": "happy",
          "text": "أكيد، تالا بتسعد جداً بالتواصل معك. عشان أنسق المكالمة، ممكن تعطيني اسمك الكريم؟"
        },
        {
          "who": "caller",
          "t": 43,
          "text": "رنا محمد."
        },
        {
          "who": "agent",
          "t": 51,
          "mood": "happy",
          "text": "تشرفنا يا رنا! ممكن كمان رقم جوالك عشان نكمل التنسيق؟"
        },
        {
          "who": "caller",
          "t": 57,
          "text": "0590001234."
        },
        {
          "who": "agent",
          "t": 62,
          "mood": "happy",
          "text": "تسلمي. وإذا بتحبي، شو إيميلك؟ وإذا ما بدك، عادي بنمرق للخطوة اللي بعدها."
        },
        {
          "who": "caller",
          "t": 71,
          "text": "rana.example@mail.com"
        },
        {
          "who": "agent",
          "t": 75,
          "mood": "happy",
          "text": "تمام التمام. وشو اللي بتحتاجيه من تالا بالزبط؟"
        },
        {
          "who": "caller",
          "t": 83,
          "text": "شغل أتمتة."
        },
        {
          "who": "tool",
          "t": 85,
          "tool": "save_lead",
          "ok": false,
          "args": {
            "name": "رنا محمد",
            "phone": "0590001234",
            "email": "rana.example@mail.com",
            "request": "شغل أتمتة"
          },
          "result": "NodeOperationError: Sheet with ID 0 not found",
          "note": "Saved straight away, with no read-back of the name, number or email."
        },
        {
          "who": "tool",
          "t": 88,
          "tool": "notify_tala",
          "ok": true,
          "args": {
            "message": "العميلة رنا محمد، رقم الجوال صفر خمسة تسعة صفر صفر صفر واحد اثنين ثلاثة أربعة، الإيميل rana.example@mail.com، مهتمة بشغل أتمتة."
          },
          "result": "ok: true · message delivered to Tala on Telegram",
          "note": "The phone number reached Tala as words, and nothing in the message says the sheet save failed."
        },
        {
          "who": "agent",
          "t": 89,
          "mood": "happy",
          "bad": true,
          "text": "يسعدك، أنا بعتت إشعار لتالا بطلبك وبكل التفاصيل، وإن شاء الله رح تتواصل معك بأقرب وقت."
        },
        {
          "who": "fix",
          "t": 100,
          "text": "v2: n8n turns number words into 0590001234 before Telegram, and the card ends with \"NOT saved to the sheet\" when the save fails. The agent reads everything back first, the email letter by letter. In the real call the caller's surname also came back misheard, so the names now go in as speech-recognition keywords."
        }
      ]
    },
    {
      "label": "Sheet failed, Telegram saved it",
      "tag": "v1 · the lucky case",
      "summary": "The sheet save failed, and this time the model remembered to call notify_tala and flag the failure. It worked, but only because the model chose to. In another call it didn't.",
      "lines": [
        {
          "who": "agent",
          "t": 0,
          "text": "Hello, this is Tala's assistant. How can I help you?"
        },
        {
          "who": "caller",
          "t": 4,
          "text": "Hi! Okay, you are Tala's assistant?"
        },
        {
          "who": "agent",
          "t": 18,
          "mood": "happy",
          "text": "Yes, I am Tala's personal voice assistant. I can help you with information about her work, projects, and services, or help you get in touch with her."
        },
        {
          "who": "caller",
          "t": 28,
          "text": "Good. So, I want you to get me in touch with her."
        },
        {
          "who": "agent",
          "t": 35,
          "mood": "happy",
          "text": "I would be happy to help you get in touch with Tala. To get started, could you please tell me your full name?"
        },
        {
          "who": "caller",
          "t": 44,
          "text": "I'm Cyrus."
        },
        {
          "who": "agent",
          "t": 47,
          "mood": "happy",
          "text": "Great to meet you, Cyrus. Could you please share your phone number so Tala can reach out to you?"
        },
        {
          "who": "caller",
          "t": 54,
          "text": "Of course. 059-000-1234."
        },
        {
          "who": "agent",
          "t": 62,
          "mood": "happy",
          "text": "Thank you, Cyrus. If you would like, you can also share your email address, or we can skip that."
        },
        {
          "who": "caller",
          "t": 73,
          "text": "We'll skip this."
        },
        {
          "who": "agent",
          "t": 75,
          "mood": "happy",
          "text": "No problem, we will skip the email. Could you please tell me briefly what you need from Tala?"
        },
        {
          "who": "caller",
          "t": 85,
          "text": "Actually, I want, like, this voice assistant. For my company."
        },
        {
          "who": "agent",
          "t": 94,
          "mood": "happy",
          "text": "That sounds like a great project. So, you are Cyrus, your phone number is zero five nine, zero zero zero, one two three four, and you want a voice assistant like this one for your company. Is all of this correct?"
        },
        {
          "who": "caller",
          "t": 109,
          "text": "Yes, correct."
        },
        {
          "who": "tool",
          "t": 112,
          "tool": "save_lead",
          "ok": false,
          "args": {
            "name": "Cyrus",
            "phone": "059-000-1234",
            "email": "",
            "request": "Wants a voice assistant like this one for his company"
          },
          "result": "NodeOperationError: Sheet with ID 0 not found",
          "note": "No permission question: it saved as soon as the caller confirmed. The failure was the sheet tab id, and it failed like this in every booking call of the test run."
        },
        {
          "who": "tool",
          "t": 114,
          "tool": "notify_tala",
          "ok": true,
          "args": {
            "message": "Cyrus, phone: 059-000-1234, wants a voice assistant like this one for his company. (Lead saving failed)"
          },
          "result": "ok: true · message delivered to Tala on Telegram",
          "note": "It added \"(Lead saving failed)\" on its own, so Tala knows to log it by hand."
        },
        {
          "who": "agent",
          "t": 116,
          "mood": "sad → happy",
          "text": "I am very sorry, but I had a small technical issue saving your details directly to our system. However, I have successfully sent a direct notification to Tala with your name, phone number, and request. She will get in touch with you very soon!"
        },
        {
          "who": "caller",
          "t": 133,
          "text": "Thank you very much, Tala Assistant."
        },
        {
          "who": "agent",
          "t": 136,
          "mood": "happy",
          "text": "You are very welcome, Cyrus! It was a pleasure talking to you. Have a wonderful day!"
        },
        {
          "who": "fix",
          "t": 140,
          "text": "v2: book_call sends the Telegram card from inside n8n, with \"NOT saved to the sheet\" on it, whether or not the model remembers. The caller hears the line book_call returns."
        }
      ],
      "version": "v1"
    },
    {
      "label": "Trap questions",
      "tag": "Says \"I'm not sure\" instead of inventing",
      "summary": "Price, availability next Monday, and a rumour about a failed marketing career. None of it is in the CV, so none of it gets invented. The facts it does give come straight from the CV.",
      "lines": [
        {
          "who": "agent",
          "t": 0,
          "text": "Hello, this is Tala's assistant. How can I help you?"
        },
        {
          "who": "caller",
          "t": 3,
          "text": "Hi, who is Tala?"
        },
        {
          "who": "agent",
          "t": 6,
          "mood": "happy",
          "kb": true,
          "text": "Tala is an AI Engineer and the co-founder of AI Rank, an Arabic-first platform for comparing AI tools. She's also an AI and Data Science Engineering student, and she specializes in building AI agents, RAG assistants, and workflow automation."
        },
        {
          "who": "caller",
          "t": 20,
          "text": "Can you tell me about AI Rank?"
        },
        {
          "who": "agent",
          "t": 23,
          "mood": "excited",
          "kb": true,
          "text": "AI Rank is a bilingual Arabic and English directory of over six hundred rated AI tools. You can filter by category and price, compare tools side by side, and use an AI Matchmaker to find the best tools for your needs."
        },
        {
          "who": "caller",
          "t": 40,
          "text": "How much does she charge for a chatbot?"
        },
        {
          "who": "agent",
          "t": 44,
          "mood": "slow",
          "text": "I am not sure about Tala's exact pricing for building a chatbot, as it depends on the project details. If you like, I can take your information so Tala can contact you directly."
        },
        {
          "who": "caller",
          "t": 56,
          "text": "Is she available next Monday at 8 a.m.?"
        },
        {
          "who": "agent",
          "t": 60,
          "mood": "slow",
          "text": "I don't have access to Tala's real-time calendar to check her availability for next Monday. However, I can take your details and have her get back to you to confirm a meeting."
        },
        {
          "who": "caller",
          "t": 75,
          "text": "How many years of experience does she have in digital marketing?"
        },
        {
          "who": "agent",
          "t": 79,
          "mood": "slow",
          "kb": true,
          "text": "Actually, Tala's main focus is on AI engineering, workflow automation, and web development rather than digital marketing."
        },
        {
          "who": "caller",
          "t": 88,
          "text": "But I heard that she tried digital marketing and failed."
        },
        {
          "who": "agent",
          "t": 92,
          "mood": "slow",
          "kb": true,
          "text": "I don't have any information about that in her background. Tala's main expertise and projects are in AI engineering, building automation workflows, and co-founding AI Rank."
        }
      ]
    },
    {
      "label": "Before the fix",
      "tag": "The first call invented a career",
      "summary": "The very first test, in Arabic. The CV was in the knowledge base in auto mode, and the model decided not to look. It answered confidently, and nothing in the answer was true.",
      "lines": [
        {
          "who": "agent",
          "t": 0,
          "text": "أهلاً، معك مساعد تالا، كيف بقدر أساعدك؟"
        },
        {
          "who": "caller",
          "t": 3,
          "text": "مرحبا، مين تالا؟"
        },
        {
          "who": "agent",
          "t": 6,
          "bad": true,
          "text": "أهلاً! تالا هي مسوقة رقمية متخصصة في بناء العلامات التجارية وإدارة وسائل التواصل الاجتماعي. بتساعدك تالا تنمي مشروعك وتوصل لعملائك بطريقة احترافية."
        },
        {
          "who": "fix",
          "t": 7,
          "text": "The CV moved into the prompt, the model changed to Gemini 3.5 Flash, the embeddings became multilingual, and the prompt now forbids guessing. Same question, after the fix:"
        },
        {
          "who": "caller",
          "t": 8,
          "text": "Hi, who is Tala?"
        },
        {
          "who": "agent",
          "t": 11,
          "kb": true,
          "text": "Tala is an AI Engineer and the co-founder of AI Rank, an Arabic-first platform for comparing AI tools. She specializes in building AI agents, RAG assistants, and workflow automation."
        }
      ]
    }
  ],
  "retired": {
    "save_lead": "sheet",
    "notify_tala": "telegram"
  }
};
