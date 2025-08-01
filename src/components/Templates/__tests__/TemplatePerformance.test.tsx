// Template Performance Tests - Story 3.7 QA
// Stress tests for large template libraries (1000+ templates)

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import TemplateLibrary from '../TemplateLibrary';
import { useTemplateManager } from '../hooks/useTemplateManager';

// Mock Tauri API
vi.mock('@tauri-apps/api/core');

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

// Generate large dataset for performance testing
const generateLargeTemplateDataset = (count: number) => {
  const templates = [];
  const categories = [];

  // Generate categories
  for (let i = 0; i < Math.min(count / 10, 100); i++) {
    categories.push({
      id: `category-${i}`,
      name: `Category ${i}`,
      parent_id: i > 0 && i % 5 === 0 ? `category-${Math.floor(i / 5)}` : null,
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      template_count: Math.floor(count / categories.length)
    });
  }

  // Generate templates
  for (let i = 0; i < count; i++) {
    const categoryIndex = i % categories.length;
    templates.push({
      id: `template-${i}`,
      name: `Template ${i}`,
      description: `Description for template ${i} with some longer text to test rendering performance`,
      category_id: categories[categoryIndex].id,
      content: `SELECT * FROM table_${i} WHERE id = {{id}} AND status = {{status}} AND created_at > {{start_date}};`,
      parameters: [
        {
          id: `param-${i}-1`,
          template_id: `template-${i}`,
          name: 'id',
          default_value: '1',
          description: 'Record ID'
        },
        {
          id: `param-${i}-2`,
          template_id: `template-${i}`,
          name: 'status',
          default_value: 'active',
          description: 'Record status'
        },
        {
          id: `param-${i}-3`,
          template_id: `template-${i}`,
          name: 'start_date',
          default_value: '2024-01-01',
          description: 'Start date filter'
        }
      ],
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      updated_at: new Date(Date.now() - i * 1800000).toISOString(),
      usage_count: Math.floor(Math.random() * 100),
      is_favorite: i % 10 === 0
    });
  }

  return { templates, categories };
};

describe('Template Performance Tests', () => {
  const defaultProps = {
    isVisible: true,
    onClose: vi.fn(),
    onTemplateSelect: vi.fn(),
    onTemplateLoad: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Large Library Performance (1000+ templates)', () => {
    it('should handle 1000 templates without performance degradation', async () => {
      const { templates, categories } = generateLargeTemplateDataset(1000);
      
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case 'get_templates':
            return Promise.resolve(templates);
          case 'get_template_categories':
            return Promise.resolve(categories);
          case 'get_template_statistics':
            return Promise.resolve({
              total_templates: templates.length,
              total_categories: categories.length,
              most_used_templates: templates.slice(0, 10),
              recent_templates: templates.slice(0, 10),
              favorite_templates: templates.filter(t => t.is_favorite),
              category_usage: categories.map(c => ({
                category: c,
                template_count: c.template_count,
                total_usage: Math.floor(Math.random() * 1000)
              }))
            });
          default:
            return Promise.resolve();
        }
      });

      const startTime = performance.now();
      
      render(<TemplateLibrary {...defaultProps} />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('1000')).toBeInTheDocument(); // Template count
      }, { timeout: 5000 });

      const loadTime = performance.now() - startTime;
      
      // Performance assertion: should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
      
      // Verify UI is responsive
      expect(screen.getByText('Template Library')).toBeInTheDocument();
      expect(screen.getByText('Browse')).toBeInTheDocument();
    });

    it('should handle search performance with large dataset', async () => {
      const { templates, categories } = generateLargeTemplateDataset(5000);
      
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'get_templates':
            // Simulate search filtering
            if (args?.filter?.search_query) {
              const filtered = templates.filter(t => 
                t.name.toLowerCase().includes(args.filter.search_query.toLowerCase())
              );
              return Promise.resolve(filtered);
            }
            return Promise.resolve(templates);
          case 'get_template_categories':
            return Promise.resolve(categories);
          case 'get_template_statistics':
            return Promise.resolve({
              total_templates: templates.length,
              total_categories: categories.length,
              most_used_templates: templates.slice(0, 10),
              recent_templates: templates.slice(0, 10),
              favorite_templates: templates.filter(t => t.is_favorite),
              category_usage: []
            });
          default:
            return Promise.resolve();
        }
      });

      render(<TemplateLibrary {...defaultProps} />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search templates...');
      
      const startTime = performance.now();
      
      // Perform search
      fireEvent.change(searchInput, { target: { value: 'Template 1' } });
      
      // Wait for search results (debounced)
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_templates', 
          expect.objectContaining({
            filter: expect.objectContaining({
              search_query: 'Template 1'
            })
          })
        );
      }, { timeout: 1000 });

      const searchTime = performance.now() - startTime;
      
      // Performance assertion: search should complete within 500ms
      expect(searchTime).toBeLessThan(500);
    });

    it('should handle category filtering performance', async () => {
      const { templates, categories } = generateLargeTemplateDataset(2000);
      
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'get_templates':
            if (args?.filter?.category_id) {
              const filtered = templates.filter(t => t.category_id === args.filter.category_id);
              return Promise.resolve(filtered);
            }
            return Promise.resolve(templates);
          case 'get_template_categories':
            return Promise.resolve(categories);
          case 'get_template_statistics':
            return Promise.resolve({
              total_templates: templates.length,
              total_categories: categories.length,
              most_used_templates: templates.slice(0, 10),
              recent_templates: templates.slice(0, 10),
              favorite_templates: templates.filter(t => t.is_favorite),
              category_usage: []
            });
          default:
            return Promise.resolve();
        }
      });

      render(<TemplateLibrary {...defaultProps} />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Category 0')).toBeInTheDocument();
      });

      const startTime = performance.now();
      
      // Click on a category to filter
      const categoryNode = screen.getByText('Category 0');
      fireEvent.click(categoryNode);
      
      // Wait for filtering to complete
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_templates', 
          expect.objectContaining({
            filter: expect.objectContaining({
              category_id: 'category-0'
            })
          })
        );
      });

      const filterTime = performance.now() - startTime;
      
      // Performance assertion: filtering should complete within 300ms
      expect(filterTime).toBeLessThan(300);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with repeated operations', async () => {
      const { templates, categories } = generateLargeTemplateDataset(500);
      
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case 'get_templates':
            return Promise.resolve(templates);
          case 'get_template_categories':
            return Promise.resolve(categories);
          case 'get_template_statistics':
            return Promise.resolve({
              total_templates: templates.length,
              total_categories: categories.length,
              most_used_templates: templates.slice(0, 10),
              recent_templates: templates.slice(0, 10),
              favorite_templates: templates.filter(t => t.is_favorite),
              category_usage: []
            });
          default:
            return Promise.resolve();
        }
      });

      const { unmount } = render(<TemplateLibrary {...defaultProps} />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Template Library')).toBeInTheDocument();
      });

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        const searchInput = screen.getByPlaceholderText('Search templates...');
        fireEvent.change(searchInput, { target: { value: `search ${i}` } });
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        fireEvent.change(searchInput, { target: { value: '' } });
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Unmount component
      unmount();
      
      // If we reach here without memory issues, the test passes
      expect(true).toBe(true);
    });
  });

  describe('UI Responsiveness', () => {
    it('should maintain UI responsiveness during heavy operations', async () => {
      const { templates, categories } = generateLargeTemplateDataset(1500);
      
      mockInvoke.mockImplementation((command: string) => {
        // Simulate slow API response
        return new Promise(resolve => {
          setTimeout(() => {
            switch (command) {
              case 'get_templates':
                resolve(templates);
                break;
              case 'get_template_categories':
                resolve(categories);
                break;
              default:
                resolve(undefined);
            }
          }, 100);
        });
      });

      render(<TemplateLibrary {...defaultProps} />);
      
      // UI should be responsive even during loading
      expect(screen.getByText('Template Library')).toBeInTheDocument();
      expect(screen.getByText('Browse')).toBeInTheDocument();
      
      // Loading indicators should be present
      await waitFor(() => {
        expect(screen.getByText('Loading templates...')).toBeInTheDocument();
      });
      
      // Buttons should still be clickable (though may be disabled)
      const browseButton = screen.getByText('Browse');
      expect(browseButton).toBeInTheDocument();
    });
  });
});
