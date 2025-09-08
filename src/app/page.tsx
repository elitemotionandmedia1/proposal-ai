"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Reveal from "reveal.js";
import "reveal.js/dist/reveal.css";
import DOMPurify from "isomorphic-dompurify";

type Slide = {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  imageUrl?: string;
  notes?: string;
};

type Deck = {
  theme: "black" | "white" | "league" | "beige" | "night" | "serif" | "simple" | "solarized";
  ratio: "16:9" | "4:3";
  slides: Slide[];
};

export default function Home() {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<Deck>({ theme: "night", ratio: "16:9", slides: [] });
  const deckRef = useRef<HTMLDivElement>(null);
  const [themeHref, setThemeHref] = useState("/reveal-theme-night.css");

  // Swap theme CSS on the fly
  useEffect(() => {
    const map: Record<string, string> = {
      black: "black",
      white: "white",
      league: "league",
      beige: "beige",
      night: "night",
      serif: "serif",
      simple: "simple",
      solarized: "solarized",
    };
    const chosen = map[deck.theme] ?? "night";
    setThemeHref(`/reveal-theme-${chosen}.css`);
  }, [deck.theme]);

  // Initialize Reveal when slides change
  useEffect(() => {
    if (!deckRef.current) return;
    const deckInstance = new Reveal(deckRef.current, {
      hash: true,
      slideNumber: true,
      width: deck.ratio === "4:3" ? 1024 : 1280,
      height: deck.ratio === "4:3" ? 768 : 720,
      margin: 0.06,
      transition: "fade",
    });
    deckInstance.initialize();
    return () => deckInstance.destroy();
  }, [deck]);

  const sanitizedSections = useMemo(() => {
    return deck.slides
      .map((s, idx) => {
        const bullets = s.bullets?.length
          ? `<ul>${s.bullets.map((b) => `<li>${DOMPurify.sanitize(b)}</li>`).join("")}</ul>`
          : "";
        const img = s.imageUrl
          ? `<img src="${s.imageUrl}" alt="" style="width:100%;border-radius:12px;margin-top:12px" />`
          : "";
        const subtitle = s.subtitle ? `<p style="opacity:.85">${DOMPurify.sanitize(s.subtitle)}</p>` : "";
        const title = s.title ? `<h2>${DOMPurify.sanitize(s.title)}</h2>` : "";
        return `<section data-index="${idx}">${title}${subtitle}${bullets}${img}</section>`;
      })
      .join("\n");
  }, [deck]);

  const generate = async () => {
    if (!brief.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setDeck(json.deck as Deck);
    } catch {
      alert("Generation failed. Check API keys in Vercel env and try again.");
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    window.print(); // Reveal has a print stylesheet
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[420px_1fr]">
      {/* Left pane */}
      <div className="p-5 border-r bg-[linear-gradient(180deg,#f7fbfe,white)]">
        <h1 className="text-2xl font-semibold mb-2">Proposal/Presentation Generator</h1>
        <p className="text-sm opacity-80 mb-4">
          Describe what you want. Be specific about audience, tone, visuals, and sections.
        </p>
        <textarea
          className="w-full h-48 p-3 rounded-lg border"
          placeholder={`Ex: Create a 12-slide investor deck for a cybersecurity SaaS.\nTone: serious, enterprise.\nTheme: midnight blue.\nInclude: problem, market size, product demo, traction metrics, GTM, roadmap, team, ask.\nUse 1 hero image per section; factual tone; concise bullets.`}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
        <div className="flex gap-2 mt-3">
          <button onClick={generate} disabled={loading} className="px-4 py-2 rounded-lg bg-black text-white">
            {loading ? "Generating..." : "Generate"}
          </button>
          <button onClick={exportPDF} className="px-4 py-2 rounded-lg border">
            Export PDF
          </button>
        </div>

        <div className="mt-6 text-xs opacity-70">
          <p>Tip: Add target (VCs, enterprise buyer), tone (formal), color palette, image vibe, and required sections.</p>
        </div>
      </div>

      {/* Right pane: Reveal container + dynamic theme link */}
      <div className="relative">
        <link rel="stylesheet" href={themeHref} />
        <div ref={deckRef} className="reveal">
          <div className="slides" dangerouslySetInnerHTML={{ __html: sanitizedSections }} />
        </div>
      </div>
    </div>
  );
}
