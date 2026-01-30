const OPENROUTER_API_KEY = OPENROUTER_API_KEY; 
const NEXTGEN_KV = NEXTGEN_KV; 

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const isAdmin = url.searchParams.get("admin") === "1";

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

  if (request.method === "POST") {
    const { message, texts } = await request.json();

    if (texts && Array.isArray(texts) && isAdmin) {
      // Admin upload of text chunks
      for (let t of texts) {
        const chunks = chunkText(t, 500);
        for (let i = 0; i < chunks.length; i++) {
          await NEXTGEN_KV.put(`pdf-${Date.now()}-${i}`, JSON.stringify({ text: chunks[i] }));
        }
      }
      return new Response(JSON.stringify({ status: "Text uploaded and chunked" }));
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Message missing" }), { status: 400 });
    }

    // Search KV for context
    const keys = await NEXTGEN_KV.list();
    let context = [];
    for (let key of keys.keys) {
      const chunk = await NEXTGEN_KV.get(key.name, "json");
      if (chunk && chunk.text.includes(message)) context.push(chunk.text);
    }

    const prompt = `Answer based on knowledge: ${context.join("\n\n")}\n\nUser: ${message}`;

    // OpenRouter API
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

    const timestamp = new Date().toISOString();
    await NEXTGEN_KV.put(timestamp, JSON.stringify({ message, reply }));

    return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

function chunkText(text, size) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
