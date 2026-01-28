addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Admin check
  const isAdmin = url.searchParams.get("admin") === "1";

  if (request.method === "GET") {
    if (isAdmin) {
      return new Response(
        JSON.stringify({ status: "Admin panel access granted" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ status: "NEXTGEN backend running" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // POST chat
  if (request.method === "POST" && url.pathname === "/chat") {
    const { message } = await request.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message missing" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call NVIDIA Nemotron model on OpenRouter
    const openRouterRes = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-nano-30b-a3b:free",
          messages: [{ role: "user", content: message }],
        }),
      }
    );

    const openRouterData = await openRouterRes.json();
    const reply = openRouterData.choices?.[0]?.message?.content || "No reply";

    // Save to KV
    const timestamp = new Date().toISOString();
    await NEXTGEN_KV.put(timestamp, JSON.stringify({ message, reply }));

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST file upload
  if (request.method === "POST" && url.pathname === "/upload") {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For now, just confirm upload
    // You can store in KV or a storage service later
    const timestamp = new Date().toISOString();
    await NEXTGEN_KV.put(`file-${timestamp}`, file.stream(), { expirationTtl: 86400 });

    return new Response(
      JSON.stringify({ filename: file.name, status: "uploaded" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
