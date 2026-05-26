// Edge Function: proxy seguro para a OpenRouter.
// A chave fica como secret no Supabase (OPENROUTER_API_KEY), NUNCA no cliente.
// O cliente chama via supabase.functions.invoke('ai-chat', { body: { messages } }).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!OPENROUTER_API_KEY) return json({ error: "OPENROUTER_API_KEY não configurada no servidor" }, 500);

  let messages: unknown;
  try {
    ({ messages } = await req.json());
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages é obrigatório" }, 400);
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENROUTER_API_KEY,
        "Content-Type": "application/json",
        "X-Title": "BDM Tracker",
      },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 2048, temperature: 0.2 }),
    });
    const data = await res.json();
    return json(data, res.status);
  } catch (err) {
    return json({ error: "Falha ao contatar a IA: " + String(err) }, 502);
  }
});
