export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/") {
      return new Response("NextGEN Backend is live!", { status: 200 });
    }

    // Store data in KV
    if (url.pathname === "/store" && request.method === "POST") {
      try {
        const data = await request.json();
        const key = data.key;
        const value = data.value;

        if (!key || !value) {
          return new Response("Missing key or value", { status: 400 });
        }

        await env.NEXTGEN_KV.put(key, value);
        return new Response("✅ Saved successfully", { status: 200 });
      } catch (err) {
        return new Response("Error storing data: " + err.message, { status: 500 });
      }
    }

    // Retrieve data from KV
    if (url.pathname === "/retrieve" && request.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response("Missing key", { status: 400 });
      }

      const value = await env.NEXTGEN_KV.get(key);
      return new Response(value || "No value found", { status: 200 });
    }

    return new Response("Endpoint not found", { status: 404 });
  }
};
