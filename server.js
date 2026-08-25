// server.js
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json({limit:'1mb'}));

// Load keys from env — DO NOT store secrets in client-side code
const OPENAI_KEY = process.env.OPENAI_KEY || "";
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY || "";
const GEMINI_KEY = process.env.GEMINI_KEY || ""; // API key for Google Generative API

// Endpoints for provider APIs
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_URL = (prompt) => {
  // This is the v1beta REST endpoint for text generation used in python example.
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
};

// fallback
function mockResponse(prompt){
  const remedies = [
    "Drink warm water and rest.",
    "Gargle with salt water.",
    "Use steam inhalation."
  ];
  return `Your query could not be answered through the AI APIs, so here is a fallback helpful response:\n\nHome Remedies:\n• ${remedies.join("\n• ")}\n\nMedicine Suggestion:\n• Paracetamol — Use: Fever & pain relief; Dose: 500mg every 6 hours (max 2g/day). Avoid overdose. This is NOT medical advice. Consult a licensed doctor.`;
}

async function callOpenAI(prompt){
  if(!OPENAI_KEY) throw new Error('OpenAI key not configured');
  const payload = {
    model: "gpt-4o-mini",
    messages: [{role:'user', content: prompt}],
    max_tokens: 800
  };
  const res = await axios.post(OPENAI_URL, payload, {
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    timeout: 20000
  });
  return res.data.choices[0].message.content;
}

async function callDeepseek(prompt){
  if(!DEEPSEEK_KEY) throw new Error('DeepSeek key not configured');
  const payload = {
    model: "deepseek-chat",
    messages: [{role: 'user', content: prompt}]
  };
  const res = await axios.post(DEEPSEEK_URL, payload, {
    headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` },
    timeout: 20000
  });
  return res.data.choices[0].message.content;
}

async function callGemini(prompt){
  if(!GEMINI_KEY) throw new Error('Gemini key not configured');
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  const res = await axios.post(GEMINI_URL(prompt), payload, { timeout: 20000 });
  // adapt to returned structure
  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function runLLM(prompt){
  const funcs = [callOpenAI, callDeepseek, callGemini];
  for (const f of funcs){
    try {
      const out = await f(prompt);
      if (out && out.trim().length > 10) return out;
    } catch (e) {
      console.warn('Provider failed:', e.message || e);
      continue;
    }
  }
  return mockResponse(prompt);
}

app.post('/api/ask', async (req, res) => {
  try {
    const { message, ocrText } = req.body || {};
    if ((!message || message.trim()==='') && (!ocrText || ocrText.trim()==='')) {
      return res.status(400).json({ error: 'Provide message or OCR text' });
    }

    let finalPrompt = '';
    if (message) finalPrompt += `User message:\n${message}\n\n`;
    if (ocrText) finalPrompt += `OCR Extracted Text:\n${ocrText}\n\n`;
    finalPrompt += "Analyze the symptoms or prescription. Provide home remedies, medicine names, uses, risks, and safety warnings. Always end with: 'This is not medical advice. Consult a doctor.'";

    const reply = await runLLM(finalPrompt);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: mockResponse(req.body?.message || '') });
  }
});

// Simple static serving option (optional)
app.use('/', express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
