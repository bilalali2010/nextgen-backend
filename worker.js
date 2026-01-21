export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // CORS
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // =====================
    // CHAT ENDPOINT
    // =====================
    if (url.pathname === "/chat" && req.method === "POST") {
      const body = await req.json();
      const userMessage = body.message;

      const systemPrompt = await env.NEXTGEN_KV.get("system_prompt")
        || "You are NEXTGEN, a helpful and friendly AI assistant.";

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "nvidia/nemotron-3-nano-30b-a3b:free",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage }
            ],
            max_tokens: 200,
            temperature: 0.4
          })
        }
      );

      const data = await response.json();
      const reply =
        data?.choices?.[0]?.message?.content
        || "🤔 I’m not sure, but let’s figure it out together!";

      return new Response(
        JSON.stringify({ reply }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // =====================
    // ADMIN ENDPOINT
    // =====================
    if (url.pathname === "/admin" && req.method === "POST") {
      const body = await req.json();

      if (body.password !== env.ADMIN_PASSWORD) {
        return new Response("Unauthorized", { status: 401 });
      }

      await env.NEXTGEN_KV.put("system_prompt", body.prompt);

      return new Response("Saved", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  }
};
