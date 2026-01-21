export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const params = url.searchParams;

    // Admin check
    const isAdmin = params.get("admin") === "1";

    // Only POST for chat requests
    if (request.method === "POST" && url.pathname === "/chat") {
      const data = await request.json();
      const userMessage = data.message || "Hello";

      // Prepare previous context from KV
      const chatHistoryKey = `chat_${data.user || "guest"}`;
      let previousChat = await env.NEXTGEN_KV.get(chatHistoryKey);
      previousChat = previousChat || "";

      // Prepare payload for OpenRouter
      const payload = {
        model: "nvidia/nemotron-3-nano-30b-a3b:free",
        messages: [
          {
            role: "system",
            content: "You are NEXTGEN AI assistant. Answer concisely, friendly, and use previous context if possible."
          },
          {
            role: "user",
            content: previousChat + "\nUser: " + userMessage
          }
        ],
        max_output_tokens: 150,
        temperature: 0.4
      };

      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const result = await res.json();
        let botReply = result.choices?.[0]?.message?.content || "Sorry, I don't know that.";

        // Save conversation to KV
        const newChat = previousChat + `\nUser: ${userMessage}\nBot: ${botReply}`;
        await env.NEXTGEN_KV.put(chatHistoryKey, newChat);

        return new Response(JSON.stringify({ reply: botReply, admin: isAdmin }), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ reply: "⚠️ Error calling AI API", admin: isAdmin }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // GET endpoint for admin panel status
    if (request.method === "GET") {
      return new Response(JSON.stringify({ admin: isAdmin }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("NEXTGEN Backend is running.", { status: 200 });
  }
};
