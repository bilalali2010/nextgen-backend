const OPENROUTER_API_KEY = OPENROUTER_API_KEY; // Set in wrangler.toml
const NEXTGEN_KV = NEXTGEN_KV; // KV binding

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const isAdmin = url.searchParams.get("admin") === "1";

  // GET status
  if (request.method === "GET") {
    if (isAdmin) {
      return new Response(JSON.stringify({ status: "Admin panel access granted" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ status: "NEXTGEN backend running" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST chat
  if (request.method === "POST") {
    const { message } = await request.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message missing" }), { status: 400 });
    }

    // Search PDF knowledge chunks from KV
    const keys = await NEXTGEN_KV.list();
    let context = [];
    for (let key of keys.keys) {
      const chunk = await NEXTGEN_KV.get(key.name, "json");
      if (chunk && chunk.text.includes(message)) {
        context.push(chunk.text);
      }
    }

    const prompt = `Answer based on the following knowledge: ${context.join("\n\n")}\n\nUser: ${message}`;

    // Call OpenRouter AI
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-nano-30b-a3b:free",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const reply = aiData.choices?.[0]?.message?.content || "No reply";

    // Save chat
    const timestamp = new Date().toISOString();
    await NEXTGEN_KV.put(timestamp, JSON.stringify({ message, reply }));

    return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });
  }

  // POST upload PDFs (admin only)
  if (request.method === "POST" && isAdmin) {
    const { pdfs } = await request.json(); // pdfs = array of URLs from GitHub
    if (!pdfs || !Array.isArray(pdfs)) {
      return new Response(JSON.stringify({ error: "PDFs missing" }), { status: 400 });
    }

    for (let pdfUrl of pdfs) {
      try {
        const pdfRes = await fetch(pdfUrl);
        const pdfBuffer = await pdfRes.arrayBuffer();
        const text = await pdfToText(pdfBuffer);
        const chunks = chunkText(text, 500);
        for (let i = 0; i < chunks.length; i++) {
          await NEXTGEN_KV.put(`pdf-${Date.now()}-${i}`, JSON.stringify({ text: chunks[i] }));
        }
      } catch (e) {
        console.error(e);
      }
    }

    return new Response(JSON.stringify({ status: "PDFs processed & stored" }));
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

// Convert PDF bytes to text
async function pdfToText(buffer) {
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n";
  }
  return text;
}

// Split text into chunks
function chunkText(text, size) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
