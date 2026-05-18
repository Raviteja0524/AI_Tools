import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function SearchBar({ value, onChange, placeholder = 'Search AI tools...', autoFocus }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="search-wrap">
      <div className="search-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M7.25 1a6.25 6.25 0 1 1 0 12.5A6.25 6.25 0 0 1 7.25 1zm6.28 10.72a.75.75 0 0 1 1.06 1.06l-2.5 2.5a.75.75 0 1 1-1.06-1.06l2.5-2.5z"
            fill="currentColor"
          />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      {value && (
        <button
          className="search-clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <style>{`
        .search-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          color: #52525B;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        .search-input {
          width: 100%;
          height: 48px;
          padding: 0 44px 0 44px;
          border-radius: 12px;
          border: 1px solid #1F1F2E;
          background: #111116;
          color: #F8F8F8;
          font-size: 0.9375rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          -webkit-appearance: none;
        }
        .search-input::placeholder { color: #52525B; }
        .search-input::-webkit-search-cancel-button { display: none; }
        .search-input:focus {
          border-color: #7C3AED60;
          box-shadow: 0 0 0 3px #7C3AED18;
        }
        .search-clear {
          position: absolute;
          right: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: none;
          background: #2D2D3E;
          color: #A1A1AA;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .search-clear:hover { background: #3F3F46; color: #F8F8F8; }
      `}</style>
    </div>
  );
}
