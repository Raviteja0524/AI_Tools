import { useState, useEffect, useMemo, useCallback } from 'react';
import SearchBar from './SearchBar';
import FilterPanel, { type Filters } from './FilterPanel';
import ToolCard from './ToolCard';

interface Tool {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  logo: string;
  url: string;
  category: string;
  tags: string[];
  pricing: 'free' | 'freemium' | 'paid';
  indianPricing?: string;
  rating: number;
  bestForIndia: boolean;
  freeForever: boolean;
  featured: boolean;
  dateAdded: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

interface Props {
  tools: Tool[];
  categories: Category[];
}

const EMPTY_FILTERS: Filters = { category: '', pricing: '', special: [] };

function readUrlParams(): { query: string; filters: Filters } {
  if (typeof window === 'undefined') return { query: '', filters: EMPTY_FILTERS };
  const p = new URLSearchParams(window.location.search);
  const category = p.get('category') ?? '';
  const pricing = p.get('pricing') ?? '';
  const raw = p.get('filter') ?? '';
  // 'filter' can be a special flag like 'india', 'free', 'offline', 'new'
  // also support 'india', 'offline' as special[], or 'free'/'freemium'/'paid' as pricing
  let special: string[] = [];
  let pricingFromFilter = pricing;
  if (raw === 'india') special = ['india'];
  else if (raw === 'offline') special = ['offline'];
  else if (raw === 'forever' || raw === 'free-forever') special = ['forever'];
  else if (raw === 'free') pricingFromFilter = pricingFromFilter || 'free';
  else if (raw === 'freemium') pricingFromFilter = pricingFromFilter || 'freemium';
  else if (raw === 'paid') pricingFromFilter = pricingFromFilter || 'paid';
  const query = p.get('q') ?? '';
  return { query, filters: { category, pricing: pricingFromFilter, special } };
}

function writeUrlParams(query: string, filters: Filters) {
  const p = new URLSearchParams();
  if (query) p.set('q', query);
  if (filters.category) p.set('category', filters.category);
  if (filters.pricing) p.set('pricing', filters.pricing);
  if (filters.special.length) p.set('filter', filters.special.join(','));
  const qs = p.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

function normalize(str: string) {
  return str.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
}

function matchesSearch(tool: Tool, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  return (
    normalize(tool.name).includes(q) ||
    normalize(tool.tagline).includes(q) ||
    normalize(tool.description).includes(q) ||
    tool.tags.some(t => normalize(t).includes(q))
  );
}

function matchesFilters(tool: Tool, filters: Filters): boolean {
  if (filters.category && tool.category !== filters.category) return false;
  if (filters.pricing && tool.pricing !== filters.pricing) return false;
  for (const s of filters.special) {
    if (s === 'india' && !tool.bestForIndia) return false;
    if (s === 'forever' && !tool.freeForever) return false;
    if (s === 'offline' && !tool.tags.includes('offline')) return false;
  }
  return true;
}

const SORT_OPTIONS = [
  { id: 'featured', label: 'Featured' },
  { id: 'rating',   label: 'Top Rated' },
  { id: 'newest',   label: 'Newest' },
  { id: 'az',       label: 'A → Z' },
];

export default function ToolsDirectory({ tools, categories }: Props) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState('featured');
  const [hydrated, setHydrated] = useState(false);

  // Read URL on mount
  useEffect(() => {
    const { query: q, filters: f } = readUrlParams();
    setQuery(q);
    setFilters(f);
    setHydrated(true);
  }, []);

  // Sync URL when state changes (only after hydration)
  useEffect(() => {
    if (hydrated) writeUrlParams(query, filters);
  }, [query, filters, hydrated]);

  const handleQueryChange = useCallback((v: string) => setQuery(v), []);
  const handleFiltersChange = useCallback((f: Filters) => setFilters(f), []);
  const handleReset = useCallback(() => { setQuery(''); setFilters(EMPTY_FILTERS); }, []);

  const filtered = useMemo(() => {
    let result = tools.filter(t => matchesSearch(t, query) && matchesFilters(t, filters));
    if (sort === 'rating')   result = [...result].sort((a, b) => b.rating - a.rating);
    if (sort === 'newest')   result = [...result].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
    if (sort === 'az')       result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'featured') result = [...result].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    return result;
  }, [tools, query, filters, sort]);

  const hasActiveSearch = query.trim().length > 0;
  const hasActiveFilters = filters.category !== '' || filters.pricing !== '' || filters.special.length > 0;

  return (
    <div className="td-root">
      {/* ── Top bar: search + sort ── */}
      <div className="td-topbar">
        <div className="td-search-wrap">
          <SearchBar
            value={query}
            onChange={handleQueryChange}
            placeholder="Search by name, category, or feature..."
          />
        </div>
        <div className="td-sort">
          <label htmlFor="sort-select" className="td-sort-label">Sort:</label>
          <select
            id="sort-select"
            className="td-sort-select"
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Mobile filter toggle (rendered by FilterPanel) ── */}
      <div className="td-mobile-filters">
        <FilterPanel
          filters={filters}
          categories={categories}
          toolCount={tools.length}
          filteredCount={filtered.length}
          onChange={handleFiltersChange}
          onReset={handleReset}
        />
      </div>

      {/* ── Body: sidebar + grid ── */}
      <div className="td-body">
        {/* Desktop sidebar */}
        <div className="td-sidebar">
          <FilterPanel
            filters={filters}
            categories={categories}
            toolCount={tools.length}
            filteredCount={filtered.length}
            onChange={handleFiltersChange}
            onReset={handleReset}
          />
        </div>

        {/* Grid */}
        <div className="td-grid-wrap">
          {/* Active filter chips */}
          {(hasActiveSearch || hasActiveFilters) && (
            <div className="td-active-chips">
              {hasActiveSearch && (
                <span className="td-chip">
                  🔍 "{query}"
                  <button className="td-chip-remove" onClick={() => setQuery('')} type="button" aria-label="Remove search">×</button>
                </span>
              )}
              {filters.category && (
                <span className="td-chip">
                  {categories.find(c => c.id === filters.category)?.icon}{' '}
                  {categories.find(c => c.id === filters.category)?.name}
                  <button className="td-chip-remove" onClick={() => setFilters(f => ({ ...f, category: '' }))} type="button" aria-label="Remove category filter">×</button>
                </span>
              )}
              {filters.pricing && (
                <span className="td-chip">
                  {filters.pricing === 'free' ? '🆓' : filters.pricing === 'freemium' ? '⚡' : '💰'}{' '}
                  {filters.pricing.charAt(0).toUpperCase() + filters.pricing.slice(1)}
                  <button className="td-chip-remove" onClick={() => setFilters(f => ({ ...f, pricing: '' }))} type="button" aria-label="Remove pricing filter">×</button>
                </span>
              )}
              {filters.special.map(s => (
                <span key={s} className="td-chip">
                  {s === 'india' ? '🇮🇳 India' : s === 'forever' ? '♾️ Free Forever' : '📴 Offline'}
                  <button className="td-chip-remove" onClick={() => setFilters(f => ({ ...f, special: f.special.filter(x => x !== s) }))} type="button" aria-label={`Remove ${s} filter`}>×</button>
                </span>
              ))}
              <button className="td-chip-clear" onClick={handleReset} type="button">Clear all</button>
            </div>
          )}

          {/* Results */}
          {filtered.length > 0 ? (
            <ul className="td-grid" role="list">
              {filtered.map((tool, i) => (
                <li key={tool.id}>
                  <ToolCard
                    tool={tool}
                    style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="td-empty">
              <div className="td-empty-icon" aria-hidden="true">🔍</div>
              <h3 className="td-empty-title">No tools found</h3>
              <p className="td-empty-sub">
                {hasActiveSearch
                  ? `No results for "${query}". Try a different term or clear filters.`
                  : 'No tools match the current filters. Try adjusting your selection.'}
              </p>
              <button className="td-empty-btn" onClick={handleReset} type="button">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .td-root { display: flex; flex-direction: column; gap: 1rem; }

        /* Top bar */
        .td-topbar {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        .td-search-wrap { flex: 1; }
        .td-sort { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
        .td-sort-label { font-size: 0.75rem; color: #52525B; font-weight: 600; white-space: nowrap; }
        .td-sort-select {
          padding: 0 2rem 0 0.75rem;
          height: 48px;
          border-radius: 10px;
          border: 1px solid #1F1F2E;
          background: #111116;
          color: #A1A1AA;
          font-size: 0.8125rem;
          font-family: inherit;
          font-weight: 500;
          cursor: pointer;
          outline: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2352525B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          transition: border-color 0.15s;
        }
        .td-sort-select:focus { border-color: #7C3AED60; }

        /* Mobile filters: visible on mobile only */
        .td-mobile-filters { display: block; }
        @media (min-width: 900px) { .td-mobile-filters { display: none; } }

        /* Body layout */
        .td-body { display: flex; gap: 2rem; align-items: flex-start; }
        .td-sidebar { display: none; }
        @media (min-width: 900px) {
          .td-sidebar { display: block; width: 220px; flex-shrink: 0; position: sticky; top: 80px; }
        }
        .td-grid-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }

        /* Active filter chips */
        .td-active-chips {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.375rem;
        }
        .td-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.5rem 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 500;
          background: #7C3AED20;
          color: #C4B5FD;
          border: 1px solid #7C3AED40;
        }
        .td-chip-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: none;
          background: #7C3AED40;
          color: #C4B5FD;
          font-size: 0.75rem;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          font-family: inherit;
          transition: background 0.12s;
        }
        .td-chip-remove:hover { background: #7C3AED70; }
        .td-chip-clear {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #52525B;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem 0.375rem;
          font-family: inherit;
          transition: color 0.15s;
        }
        .td-chip-clear:hover { color: #A1A1AA; }

        /* Grid */
        .td-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 0.875rem;
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .td-grid > li { animation: tdSlideUp 0.4s ease both; }

        @keyframes tdSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Empty state */
        .td-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 4rem 2rem;
          border-radius: 14px;
          border: 1px dashed #1F1F2E;
          text-align: center;
        }
        .td-empty-icon { font-size: 2.5rem; }
        .td-empty-title { font-size: 1.125rem; font-weight: 700; color: #F8F8F8; margin: 0; }
        .td-empty-sub { font-size: 0.875rem; color: #71717A; margin: 0; max-width: 36ch; line-height: 1.6; }
        .td-empty-btn {
          margin-top: 0.5rem;
          padding: 0.5rem 1.25rem;
          border-radius: 8px;
          border: 1px solid #2D2D3E;
          background: transparent;
          color: #A1A1AA;
          font-size: 0.875rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .td-empty-btn:hover { border-color: #7C3AED50; color: #F8F8F8; background: #7C3AED10; }
      `}</style>
    </div>
  );
}
