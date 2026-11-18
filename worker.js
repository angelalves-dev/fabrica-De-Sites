const ALLOWED_ORIGINS = new Set([
  "https://angelalves-dev.github.io"
]);

function cors(origin) {
  const h = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8"
  });
  if (ALLOWED_ORIGINS.has(origin)) h.set("Access-Control-Allow-Origin", origin);
  return h;
}

function reply(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: cors(origin) });
}

function extractText(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || "")
    .join("\n")
    .trim();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== "POST") {
      return reply({ error: "Use POST para conversar ou gerar um site." }, 405, origin);
    }
    if (!ALLOWED_ORIGINS.has(origin)) {
      return reply({ error: "Origem não autorizada." }, 403, origin);
    }
    if (!env.GEMINI_API_KEY) {
      return reply({ error: "Configure GEMINI_API_KEY nos Secrets do Worker." }, 503, origin);
    }

    let body;
    try {
      const raw = await request.text();
      if (raw.length > 260000) {
        return reply({ error: "O pedido ficou grande demais. Reduza a descrição ou o tamanho do site atual." }, 413, origin);
      }
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "Não consegui interpretar os dados enviados." }, 400, origin);
    }

    const isChat = body.mode === "chat" && Array.isArray(body.input);
    let contents;

    if (isChat) {
      const messages = body.input.slice(-22).map(message => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: String(message.content || "").slice(0, 30000) }]
      })).filter(message => message.parts[0].text.trim());
      if (!messages.length) return reply({ error: "Escreva uma mensagem para começar." }, 400, origin);
      contents = messages;
    } else {
      const prompt = String(body.input || "").trim();
      if (prompt.length < 15) return reply({ error: "Descreva o site com pelo menos 15 caracteres." }, 400, origin);
      if (prompt.length > 240000) return reply({ error: "O pedido excedeu o limite permitido." }, 413, origin);
      contents = [{ role: "user", parts: [{ text: prompt }] }];
    }

    const model = String(env.GEMINI_MODEL || "gemini-3.1-flash-lite");
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY);

    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: isChat ? 0.6 : 0.48,
            maxOutputTokens: isChat ? 8192 : 24576
          }
        })
      });

      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const status = upstream.status === 429 ? 429 : 502;
        return reply({
          error: upstream.status === 429
            ? "O limite temporário da IA foi atingido. Aguarde e tente novamente."
            : "O provedor de IA recusou a solicitação. Confira a chave e o modelo configurados no Worker.",
          code: upstream.status === 429 ? "rate_limited" : "provider_error",
          detail: String(data?.error?.message || "").slice(0, 220)
        }, status, origin);
      }

      const text = extractText(data);
      if (!text) return reply({ error: "A IA não retornou conteúdo. Tente novamente.", code: "empty_response" }, 502, origin);

      const finish = data?.candidates?.[0]?.finishReason || "";
      return reply({ text, truncated: finish === "MAX_TOKENS" }, 200, origin);
    } catch (error) {
      return reply({
        error: "Falha de conexão com o provedor de IA.",
        code: "provider_network_error",
        detail: String(error?.message || error).slice(0, 180)
      }, 502, origin);
    }
  }
};
