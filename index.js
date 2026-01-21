export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      
      // Admin toggle: ?admin=1
      const isAdmin = url.searchParams.get("admin") === "1";

      let body = await request.json().catch(() => ({}));
      const userInput = body.user_input || "";

      // Read knowledge from KV
      const kvContent = await env.NEXTGEN_KV.get("knowledge") || "";

      // Prepare OpenRouter payload
      const payload = {
        model: "nvidia/nemotron-3-nano-30b-a3b:free",
        messages: [
          {
            role: "system",
            content: `You are NEXTGEN assistant. Use the knowledge if possible.`
          },
          {
            role: "user",
            content: kvContent + "\n\nUser: " + userInput
          }
        ],
        max_output_tokens: 150,
        temperature: 0.4
      };

      // Call OpenRouter
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      const botReply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

      return new Response(JSON.stringify({ reply: botReply, admin: isAdmin }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        headers: { "Content-Type": "application/json" },
        status: 500
      });
    }
  }
};
