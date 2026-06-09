// Edge Function: STT via OpenRouter Whisper.
// Constrói multipart/form-data manualmente para evitar bug do Deno FormData no Edge Runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const DEFAULT_MODEL = "openai/whisper-large-v3-turbo";

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

function buildMultipart(
  boundary: string,
  audioBytes: Uint8Array,
  audioFilename: string,
  mimeType: string,
  fields: Record<string, string>,
): Uint8Array {
  const enc = new TextEncoder();
  const CRLF = "\r\n";
  const parts: Uint8Array[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(enc.encode(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
      `${value}${CRLF}`,
    ));
  }

  parts.push(enc.encode(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${audioFilename}"${CRLF}` +
    `Content-Type: ${mimeType}${CRLF}${CRLF}`,
  ));
  parts.push(audioBytes);
  parts.push(enc.encode(`${CRLF}--${boundary}--${CRLF}`));

  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!OPENROUTER_API_KEY) return json({ error: "OPENROUTER_API_KEY não configurada no servidor" });

  let audio: string;
  let format: string;
  let model: string;

  try {
    ({ audio, format = "webm", model = DEFAULT_MODEL } = await req.json());
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }

  if (!audio) return json({ error: "Campo 'audio' obrigatório" }, 400);

  try {
    const binaryStr = atob(audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const mimeType = format === "mp4" ? "audio/mp4" : format === "ogg" ? "audio/ogg" : "audio/webm";

    const boundary = `bdmbdm${Date.now()}`;
    const body = buildMultipart(
      boundary,
      bytes,
      `audio.${format}`,
      mimeType,
      { model, language: "pt" },
    );

    const orRes = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENROUTER_API_KEY,
        "X-Title": "BDM Tracker STT",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const data = await orRes.json();

    if (!orRes.ok) {
      const errMsg = data?.error?.message ?? data?.error ?? `OpenRouter error ${orRes.status}`;
      return json({ error: errMsg });
    }

    return json({
      choices: [{ message: { content: data.text ?? "" } }],
    });
  } catch (err) {
    return json({ error: "Falha ao contatar a IA: " + String(err) });
  }
});
