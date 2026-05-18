# AI Tools — India's #1 Free AI Tools Directory

> **Best Free AI Tools for Developers, Students & Freelancers**  
> Discover 37+ curated AI tools with honest reviews, India-specific pricing, and real use cases.

---

## What Is This?

A production-ready static website that helps Indian developers, students, and freelancers discover the best AI tools — with honest reviews, ₹ pricing, and recommendations tailored for India.

**Live features:**
- 37+ tools across 8 categories
- Search + filter by category, pricing, and India-specific tags
- In-depth MDX reviews and how-to guides
- India badge (🇮🇳) for tools popular in India
- Free Forever badge for truly free tools
- Dark futuristic UI (purple/cyan on deep black)
- Fully static — no database, no server, near-zero hosting cost

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Astro 5 + TypeScript |
| Styling | Tailwind CSS v3 |
| Content | JSON (tool data) + MDX (reviews, guides, blog) |
| Search | Pagefind (static, zero runtime) |
| Deployment | Vercel |
| Analytics | Google Analytics 4 + Vercel Analytics |

---

## Project Structure

```
src/
├── components/
│   ├── layout/       → Navbar, Footer, BaseLayout
│   ├── home/         → Hero, TrendingTools, CategoriesGrid
│   ├── tools/        → ToolCard, SearchBar, FilterPanel (React islands)
│   ├── mdx/          → Callout, ProsCons, ToolMention
│   └── ui/           → Badge, PricingTag, IndiaTag
├── content/
│   ├── reviews/      → MDX tool reviews
│   ├── guides/       → MDX how-to guides
│   └── blog/         → MDX blog posts
├── data/
│   ├── tools.json    → All 37+ tool entries
│   └── categories.json
├── pages/            → Astro routes (/, /tools, /reviews, /guides, /blog)
├── styles/global.css
└── utils/            → tools.ts, seo.ts helpers
```

---

## Categories

| # | Category | Description |
|---|---|---|
| ✍️ | Writing & Productivity | AI assistants for writing, editing, and getting more done |
| 💻 | AI Coding Assistants | Code faster with AI pair programmers and autocomplete |
| 🎨 | Image & Video | Generate and edit images and videos with AI |
| 🖥️ | Local LLMs | Run powerful AI models locally — free forever |
| 🎵 | Audio & Voice | AI voice generation, cloning, and transcription |
| 📊 | Research & Data | AI-powered research, document analysis, and data tools |
| 📈 | Business & Marketing | Grow your business with AI marketing and automation |
| 🎓 | Education & Learning | AI tools for students, exam prep, and skill building |

---

## Tools Listed (37+)

**Writing & Productivity** — ChatGPT, Claude, Google Gemini, Microsoft Copilot, Perplexity AI, Grammarly, Notion AI, Rytr, Jasper AI

**AI Coding Assistants** — GitHub Copilot, Cursor, Codeium, Tabnine, Amazon CodeWhisperer, Replit AI, Aider, Continue.dev

**Image & Video** — Midjourney, Stable Diffusion, DALL-E 3, Adobe Firefly, Canva AI, Runway ML, Kling AI, Leonardo AI

**Local LLMs** — Ollama, LM Studio, GPT4All, Jan.ai, AnythingLLM

**Research & Data** — Perplexity AI, Consensus, ChatPDF, NotebookLM, Elicit, Hugging Face

**Audio & Voice** — ElevenLabs, Murf AI, Whisper (OpenAI), Suno AI

---

## Tool Data Schema

Each tool in `src/data/tools.json`:

```typescript
interface Tool {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logo: string;
  url: string;
  affiliateUrl?: string;       // optional, rendered with rel="nofollow sponsored"
  category: string;
  tags: string[];
  pricing: "free" | "freemium" | "paid";
  indianPricing?: string;      // e.g. "₹0 (Free tier)", "₹1,700/mo"
  rating: number;              // 0–5
  bestForIndia: boolean;       // shows 🇮🇳 badge
  freeForever: boolean;        // shows "Free Forever" badge
  featured: boolean;           // shows on homepage
  languages?: string[];
  pros: string[];
  cons: string[];
  dateAdded: string;           // ISO date
}
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
# Clone the repo
git clone https://github.com/Raviteja0524/AI_Tools.git
cd AI_Tools

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:4321](http://localhost:4321)

### Build for Production

```bash
npm run build

# Optional: build static search index
npx pagefind --site dist

# Preview production build
npm run preview
```

---

## Adding a New Tool

1. Add an entry to `src/data/tools.json` following the schema above
2. Add the tool logo to `public/logos/`
3. Optionally write an in-depth review in `src/content/reviews/[slug].mdx`

---

## Deployment

This site deploys automatically to **Vercel** on every push to `main`.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Raviteja0524/AI_Tools)

---

## Roadmap

- [x] Astro 5 + Tailwind + TypeScript scaffold
- [x] Homepage with hero, categories grid, trending tools
- [x] Tools directory with search + filters
- [x] Individual tool pages with pros/cons and affiliate CTAs
- [x] MDX content collections (reviews, guides, blog)
- [x] SEO: sitemap, robots.txt, JSON-LD, OG tags
- [ ] Pagefind static search integration
- [ ] Google Analytics 4 setup
- [ ] Custom domain (bestaitools.in / aitoolshub.in)
- [ ] Google AdSense / affiliate link activation

---

## Monetization

- **Affiliate links** — Claude, Cursor, Canva, Hostinger, Vercel (with `rel="nofollow sponsored"`)
- **Display ads** — Google AdSense / Ezoic (Month 4+)
- **Sponsored listings** — for AI tool companies (Month 6+)

*Some links on this site are affiliate links. We may earn a small commission at no extra cost to you.*

---

## License

MIT
