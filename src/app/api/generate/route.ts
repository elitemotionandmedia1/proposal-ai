import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY!;

// Simple fetch wrapper
async function askOpenAI(prompt: string) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // or your available GPT model
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You generate elite, factual, executive-ready slide content. Return strict JSON only."
        },
        {
          role: "user",
          content: `
Brief:
${prompt}

Return a JSON object with:
{
  "deck": {
    "theme": one of ["black","white","league","beige","night","serif","simple","solarized"],
    "ratio": "16:9" or "4:3",
    "slides": [
      {
        "title": string,
        "subtitle": string (optional),
        "bullets": [2-6 concise bullets without emojis],
        "imageQuery": string (keyword for stock photo),
        "notes": string (speaker notes, optional)
      }
    ]
  }
}

Rules:
- Facts over fluff. No hallucinated metrics; if unknown, general phrasing.
- Keep titles punchy (<= 8 words).
- Avoid jargon; make it enterprise-credible.
- Use strong structure (Problem, Solution, Market, Product, Traction, GTM, Business Model, Roadmap, Competition, Team, Financials, Ask).
- 'imageQuery' should be visual concepts, not full sentences (e.g., "enterprise cybersecurity dashboard", "cloud lock").
`
        }
      ]
    })
  });
  if (!r.ok) throw new Error("OpenAI error");
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

async function pexelsImage(query: string) {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  const r = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY }
  });
  if (!r.ok) return null;
  const j = await r.json();
  const photo = j.photos?.[0];
  return photo?.src?.landscape || photo?.src?.large || null;
}

export async function POST(req: NextRequest) {
  try {
    const { brief } = await req.json();
    if (!brief || !OPENAI_API_KEY || !PEXELS_API_KEY) {
      return NextResponse.json({ error: "Missing brief or API keys" }, { status: 400 });
    }

    const ai = await askOpenAI(brief);

    // Attach Pexels images
    const slides = await Promise.all(
      (ai.deck?.slides ?? []).map(async (s: any) => {
        const imageUrl = s.imageQuery ? await pexelsImage(s.imageQuery) : null;
        return { ...s, imageUrl };
      })
    );

    const deck = {
      theme: ai.deck?.theme ?? "night",
      ratio: ai.deck?.ratio ?? "16:9",
      slides
    };

    return NextResponse.json({ deck }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}
