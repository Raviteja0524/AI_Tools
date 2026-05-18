import { useState } from 'react';

export interface Filters {
  category: string;
  pricing: string;
  special: string[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Props {
  filters: Filters;
  categories: Category[];
  toolCount: number;
  filteredCount: number;
  onChange: (filters: Filters) => void;
  onReset: () => void;
}

const PRICING_OPTIONS = [
  { id: 'free',     label: '🆓 Free',     desc: 'Completely free plans' },
  { id: 'freemium', label: '⚡ Freemium', desc: 'Free tier available' },
  { id: 'paid',     label: '💰 Paid',     desc: 'Paid plans only' },
];

const SPECIAL_OPTIONS = [
  { id: 'india',    label: '🇮🇳 India Favorites', desc: 'Best for Indian users' },
  { id: 'forever',  label: '♾️ Free Forever',     desc: 'No credit card, ever' },
  { id: 'offline',  label: '📴 Works Offline',    desc: 'Local / no internet needed' },
];

export default function FilterPanel({ filters, categories, toolCount, filteredCount, onChange, onReset }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const setCategory = (id: string) =>
    onChange({ ...filters, category: filters.category === id ? '' : id });

  const setPricing = (id: string) =>
    onChange({ ...filters, pricing: filters.pricing === id ? '' : id });

  const toggleSpecial = (id: string) => {
    const next = filters.special.includes(id)
      ? filters.special.filter(s => s !== id)
      : [...filters.special, id];
    onChange({ ...filters, special: next });
  };

  const hasActiveFilters =
    filters.category !== '' ||
    filters.pricing !== '' ||
    filters.special.length > 0;

  const activeCount = (filters.category ? 1 : 0) + (filters.pricing ? 1 : 0) + filters.special.length;

  const panelContent = (
    <div className="fp-inner">
      {/* Results count */}
      <div className="fp-count">
        <span className="fp-count-num">{filteredCount}</span>
        <span className="fp-count-label">of {toolCount} tools</span>
        {hasActiveFilters && (
          <button className="fp-reset" onClick={onReset} type="button">
            Clear all
          </button>
        )}
      </div>

      {/* Category */}
      <div className="fp-section">
        <h3 className="fp-section-title">Category</h3>
        <ul className="fp-list" role="list">
          {categories.map(cat => (
            <li key={cat.id}>
              <button
                className={`fp-btn${filters.category === cat.id ? ' active' : ''}`}
                onClick={() => setCategory(cat.id)}
                type="button"
                aria-pressed={filters.category === cat.id}
              >
                <span className="fp-btn-icon" aria-hidden="true">{cat.icon}</span>
                <span className="fp-btn-label">{cat.name}</span>
                {filters.category === cat.id && (
                  <span className="fp-active-dot" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Pricing */}
      <div className="fp-section">
        <h3 className="fp-section-title">Pricing</h3>
        <ul className="fp-list" role="list">
          {PRICING_OPTIONS.map(opt => (
            <li key={opt.id}>
              <button
                className={`fp-btn${filters.pricing === opt.id ? ' active' : ''}`}
                onClick={() => setPricing(opt.id)}
                type="button"
                aria-pressed={filters.pricing === opt.id}
              >
                <span className="fp-btn-label">{opt.label}</span>
                {filters.pricing === opt.id && (
                  <span className="fp-active-dot" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Special filters */}
      <div className="fp-section">
        <h3 className="fp-section-title">Special</h3>
        <ul className="fp-list" role="list">
          {SPECIAL_OPTIONS.map(opt => (
            <li key={opt.id}>
              <button
                className={`fp-btn fp-btn-check${filters.special.includes(opt.id) ? ' active' : ''}`}
                onClick={() => toggleSpecial(opt.id)}
                type="button"
                aria-pressed={filters.special.includes(opt.id)}
              >
                <span className="fp-checkbox" aria-hidden="true">
                  {filters.special.includes(opt.id) && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="fp-btn-label">{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fp-mobile-toggle"
        onClick={() => setMobileOpen(o => !o)}
        type="button"
        aria-expanded={mobileOpen}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="fp-badge">{activeCount}</span>
        )}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
          style={{ marginLeft: 'auto', transform: mobileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Mobile expandable panel */}
      {mobileOpen && (
        <div className="fp-mobile-panel">
          {panelContent}
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fp-desktop">
        {panelContent}
      </aside>

      <style>{`
        /* Desktop sidebar */
        .fp-desktop {
          display: none;
          width: 220px;
          flex-shrink: 0;
        }
        @media (min-width: 900px) {
          .fp-desktop { display: block; }
          .fp-mobile-toggle { display: none !important; }
          .fp-mobile-panel { display: none !important; }
        }

        /* Mobile toggle */
        .fp-mobile-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.625rem 1rem;
          border-radius: 10px;
          border: 1px solid #1F1F2E;
          background: #111116;
          color: #A1A1AA;
          font-size: 0.875rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .fp-mobile-toggle:hover { border-color: #2D2D3E; color: #F8F8F8; }

        .fp-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          border-radius: 999px;
          background: #7C3AED;
          color: #fff;
          font-size: 0.6875rem;
          font-weight: 700;
        }

        .fp-mobile-panel {
          border-radius: 12px;
          border: 1px solid #1F1F2E;
          background: #111116;
          padding: 1rem;
          margin-top: 0.5rem;
        }

        /* Shared inner */
        .fp-inner { display: flex; flex-direction: column; gap: 0; }

        .fp-count {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding-bottom: 1rem;
          margin-bottom: 1rem;
          border-bottom: 1px solid #1F1F2E;
          flex-wrap: wrap;
        }
        .fp-count-num { font-size: 1rem; font-weight: 800; color: #F8F8F8; }
        .fp-count-label { font-size: 0.75rem; color: #52525B; }
        .fp-reset {
          margin-left: auto;
          font-size: 0.6875rem;
          font-weight: 600;
          color: #7C3AED;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          font-family: inherit;
          transition: color 0.15s;
        }
        .fp-reset:hover { color: #9D65F5; }

        .fp-section { margin-bottom: 1.25rem; }
        .fp-section-title {
          font-size: 0.625rem;
          font-weight: 700;
          color: #52525B;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0 0 0.5rem;
        }

        .fp-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .fp-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.4375rem 0.625rem;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #71717A;
          font-size: 0.8125rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s, color 0.12s;
          position: relative;
        }
        .fp-btn:hover { background: #17171F; color: #A1A1AA; }
        .fp-btn.active {
          background: #7C3AED15;
          color: #C4B5FD;
          font-weight: 600;
        }
        .fp-btn-icon { font-size: 0.875rem; flex-shrink: 0; }
        .fp-btn-label { flex: 1; }
        .fp-active-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #7C3AED;
          flex-shrink: 0;
        }

        .fp-checkbox {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid #2D2D3E;
          background: #17171F;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: border-color 0.12s, background 0.12s;
          color: #fff;
        }
        .fp-btn-check.active .fp-checkbox {
          background: #7C3AED;
          border-color: #7C3AED;
        }
      `}</style>
    </>
  );
}
