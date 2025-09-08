import { NextRequest, NextResponse } from "next/server";

/* ==== Types ==== */
type Theme =
  | "black"
  | "white"
  | "league"
  | "beige"
  | "night"
  | "serif"
  | "simple"
  | "solarized";

type Ratio = "16:9" | "4:3";

type AISlideInput = {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  imageQuery?: string;
  notes?: string;
};

type AIDeckInput = {
  theme?: Theme;
  ratio?: Ratio;
  slides?: AISlideInput[];
};

type AIResponse = {
  deck?: AIDeckInput;
};

type Slide = AISlideInput & { imageUrl?: string | null };

type Deck = {
  theme: Theme;
  ratio: Ratio;
  slides: Slide[];
};

/* ==== Env ==== */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY!;

/* ==== OpenAI call ==== */
async function askOpenAI(brief: string): Promise<AIResponse> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You generate elite, factual, executive-ready slide content. Return strict JSON only.",
        },
        {
          role: "user",
          content: `
Brief:
${brief}

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
- Facts over fluff. If unknown, use general phrasing.
- Keep titles <= 8 words.
- Enterprise-credible tone.
- Structure: Problem, Solution, Market, Product, Traction, GTM, Business Model, Roadmap, Competition, Team, Financials, Ask.
- 'imageQuery' should be short visual concepts (e.g., "enterprise cybersecurity dashboard", "cloud lock").
`,
        },
      ],
    }),
  });

  if (!r.ok) throw new Error("OpenAI error");
  const data = (await r.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "{}";

  // Parse safely. If bad JSON, fall back to empty object.
  try {
    return JSON.parse(text) as AIResponse;
  } catch {
    return {};
  }
}

/* ==== Pexels call ==== */
async function pexelsImage(query: string): Promise<string | null> {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");

  const r = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY },
  });
  if (!r.ok) return null;

  const j = (await r.json()) as {
    photos?: { src?: { landscape?: string; large?: string } }[];
  };
  const photo = j.photos?.[0];
  return photo?.src?.landscape || photo?.src?.large || null;
}

/* ==== API Route ==== */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { brief?: string };
    const brief = (body?.brief ?? "").trim();

    if (!brief || !OPENAI_API_KEY || !PEXELS_API_KEY) {
      return NextResponse.json(
        { error: "Missing brief or API keys" },
        { status: 400 }
      );
    }

    const ai = await askOpenAI(brief);
    const deckIn: AIDeckInput = ai.deck ?? {};

    const slidesIn: AISlideInput[] = Array.isArray(deckIn.slides)
      ? deckIn.slides
      : [];

    const slides: Slide[] = await Promise.all(
      slidesIn.map(async (s) => {
        const imageUrl =
          s.imageQuery && s.imageQuery.trim().length > 0
            ? await pexelsImage(s.imageQuery)
            : null;
        return { ...s, imageUrl };
      })
    );

    const deck: Deck = {
      theme: (deckIn.theme as Theme) ?? "night",
      ratio: (deckIn.ratio as Ratio) ?? "16:9",
      slides,
    };

    return NextResponse.json({ deck }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}
