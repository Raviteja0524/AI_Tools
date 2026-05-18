interface Tool {
  slug: string;
  name: string;
  logo: string;
  tagline: string;
  pricing: 'free' | 'freemium' | 'paid';
  indianPricing?: string;
  rating: number;
  bestForIndia: boolean;
  freeForever: boolean;
  tags: string[];
  category: string;
}

interface Props {
  tool: Tool;
  style?: React.CSSProperties;
}

const PRICING_BADGE: Record<string, { label: string; className: string }> = {
  free:     { label: '🆓 Free',     className: 'badge-free' },
  freemium: { label: '⚡ Freemium', className: 'badge-freemium' },
  paid:     { label: '💰 Paid',     className: 'badge-paid' },
};

export default function ToolCard({ tool, style }: Props) {
  const pricing = PRICING_BADGE[tool.pricing];

  return (
    <a
      href={`/tools/${tool.slug}`}
      className="tc-card"
      style={style}
      aria-label={`${tool.name} — ${tool.tagline}`}
    >
      <div className="tc-header">
        {/* Logo */}
        <div className="tc-logo-wrap">
          <img
            src={tool.logo}
            alt=""
            width="40"
            height="40"
            className="tc-logo"
            loading="lazy"
            onError={e => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const fallback = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div className="tc-fallback" aria-hidden="true" style={{ display: 'none' }}>
            {tool.name.charAt(0)}
          </div>
        </div>

        {/* Name + badges */}
        <div className="tc-meta">
          <h2 className="tc-name">{tool.name}</h2>
          <div className="tc-badges">
            <span className={`tc-badge ${pricing.className}`}>{pricing.label}</span>
            {tool.freeForever && <span className="tc-badge badge-free">♾️ Forever</span>}
            {tool.bestForIndia && <span className="tc-badge badge-india">🇮🇳 India</span>}
          </div>
        </div>

        {/* Rating */}
        <div className="tc-rating" aria-label={`${tool.rating} out of 5 stars`}>
          <span className="tc-rating-num">{tool.rating}</span>
          <span className="tc-star" aria-hidden="true">★</span>
        </div>
      </div>

      {/* Tagline */}
      <p className="tc-tagline">{tool.tagline}</p>

      {/* Price row */}
      {tool.indianPricing && (
        <div className="tc-price-row">
          <span className="tc-price-label">India:</span>
          <span className="tc-price-val">{tool.indianPricing}</span>
        </div>
      )}

      {/* Footer */}
      <div className="tc-footer">
        <span className="tc-cta">View details →</span>
      </div>

      <style>{`
        .tc-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.25rem;
          border-radius: 14px;
          background: linear-gradient(135deg, #17171F 0%, #111116 100%);
          border: 1px solid #1F1F2E;
          text-decoration: none;
          height: 100%;
          transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .tc-card:hover {
          border-color: #7C3AED40;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px #00000070, 0 0 0 1px #7C3AED15;
        }

        .tc-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .tc-logo-wrap {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          border: 1px solid #1F1F2E;
          background: #17171F;
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tc-logo { width: 100%; height: 100%; object-fit: contain; }
        .tc-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.125rem;
          font-weight: 800;
          color: #7C3AED;
          background: #7C3AED15;
        }

        .tc-meta { flex: 1; min-width: 0; }
        .tc-name {
          font-size: 1rem;
          font-weight: 700;
          color: #F8F8F8;
          margin: 0 0 0.375rem;
          letter-spacing: -0.01em;
          line-height: 1.2;
        }
        .tc-badges { display: flex; flex-wrap: wrap; gap: 0.25rem; }

        .tc-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          font-size: 0.625rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .badge-free     { background: #22C55E15; color: #22C55E; border: 1px solid #22C55E30; }
        .badge-freemium { background: #F59E0B15; color: #F59E0B; border: 1px solid #F59E0B30; }
        .badge-paid     { background: #EF444415; color: #EF4444; border: 1px solid #EF444430; }
        .badge-india    {
          background: linear-gradient(135deg,rgba(255,103,31,.1),rgba(4,106,56,.1));
          color: #F59E0B;
          border: 1px solid rgba(245,158,11,.25);
        }

        .tc-rating {
          display: flex;
          align-items: center;
          gap: 0.2rem;
          flex-shrink: 0;
        }
        .tc-rating-num { font-size: 0.875rem; font-weight: 700; color: #F8F8F8; }
        .tc-star { color: #F59E0B; font-size: 0.875rem; }

        .tc-tagline {
          font-size: 0.8125rem;
          color: #A1A1AA;
          margin: 0;
          line-height: 1.55;
          flex: 1;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .tc-price-row {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
        }
        .tc-price-label { color: #3F3F46; }
        .tc-price-val { color: #71717A; font-weight: 500; font-variant-numeric: tabular-nums; }

        .tc-footer { margin-top: auto; }
        .tc-cta {
          font-size: 0.75rem;
          font-weight: 600;
          color: #7C3AED;
          transition: color 0.15s;
        }
        .tc-card:hover .tc-cta { color: #9D65F5; }
      `}</style>
    </a>
  );
}
