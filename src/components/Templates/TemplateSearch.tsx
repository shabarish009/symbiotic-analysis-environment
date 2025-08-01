// Template Search Component - Story 3.7
// Search and filter interface for template library

import React, { useState, useCallback, useRef, useEffect } from 'react';
import './TemplateSearch.css';

export interface TemplateSearchProps {
  onSearch: (query: string) => void;
  onFavoritesFilter: (favoritesOnly: boolean) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const TemplateSearch: React.FC<TemplateSearchProps> = ({
  onSearch,
  onFavoritesFilter,
  onRefresh,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // PERFORMANCE: Debounced search to prevent excessive API calls
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced search
    debounceTimeoutRef.current = setTimeout(() => {
      onSearch(query);
    }, 300); // 300ms debounce delay
  }, [onSearch]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    onSearch('');
    searchInputRef.current?.focus();
  }, [onSearch]);

  const handleFavoritesToggle = useCallback(() => {
    const newValue = !showFavoritesOnly;
    setShowFavoritesOnly(newValue);
    onFavoritesFilter(newValue);
  }, [showFavoritesOnly, onFavoritesFilter]);

  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      handleSearchClear();
    }
  }, [handleSearchClear]);

  return (
    <div className="template-search">
      <div className="search-section">
        <div className="search-input-container">
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-label="Search templates"
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={handleSearchClear}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-controls">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showFavoritesOnly}
              onChange={handleFavoritesToggle}
              disabled={isLoading}
            />
            <span className="checkbox-text">Favorites only</span>
          </label>

          <button
            className="refresh-button"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh template list"
            aria-label="Refresh"
          >
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              '🔄'
            )}
          </button>
        </div>
      </div>

      {searchQuery && (
        <div className="search-status">
          <span className="search-info">
            Searching for: <strong>"{searchQuery}"</strong>
          </span>
        </div>
      )}

      {showFavoritesOnly && (
        <div className="filter-status">
          <span className="filter-info">
            ⭐ Showing favorites only
          </span>
        </div>
      )}
    </div>
  );
};

export default TemplateSearch;
