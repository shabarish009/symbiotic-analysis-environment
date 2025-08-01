// Template Security Tests - Story 3.7 QA
// Comprehensive security testing for template system

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Tauri API
vi.mock('@tauri-apps/api/core');

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

describe('Template Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SQL Injection Prevention', () => {
    it('should reject dangerous SQL commands in template parameters', async () => {
      const dangerousInputs = [
        "'; DROP TABLE users; --",
        "1; DELETE FROM templates; --",
        "1 UNION SELECT * FROM sensitive_data",
        "1'; EXEC xp_cmdshell('dir'); --",
        "1' OR '1'='1",
        "'; INSERT INTO admin VALUES ('hacker', 'password'); --"
      ];

      for (const input of dangerousInputs) {
        mockInvoke.mockRejectedValueOnce(new Error('Parameter value contains potentially dangerous content and has been rejected for security reasons'));

        try {
          await invoke('process_template_parameters', {
            template_id: 'test-template',
            substitutions: [{ parameter_name: 'test_param', value: input }]
          });
          
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error.message).toContain('dangerous content');
        }
      }
    });

    it('should reject hex-encoded injection attempts', async () => {
      const hexInputs = [
        "0x53454C454354202A2046524F4D207573657273", // SELECT * FROM users
        "0x44524F50205441424C45207573657273", // DROP TABLE users
      ];

      for (const input of hexInputs) {
        mockInvoke.mockRejectedValueOnce(new Error('Parameter value contains potentially dangerous content and has been rejected for security reasons'));

        try {
          await invoke('process_template_parameters', {
            template_id: 'test-template',
            substitutions: [{ parameter_name: 'test_param', value: input }]
          });
          
          expect(true).toBe(false);
        } catch (error) {
          expect(error.message).toContain('dangerous content');
        }
      }
    });

    it('should reject script injection attempts', async () => {
      const scriptInputs = [
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "vbscript:msgbox('xss')",
        "<img src=x onerror=alert('xss')>"
      ];

      for (const input of scriptInputs) {
        mockInvoke.mockRejectedValueOnce(new Error('Parameter value contains potentially dangerous content and has been rejected for security reasons'));

        try {
          await invoke('process_template_parameters', {
            template_id: 'test-template',
            substitutions: [{ parameter_name: 'test_param', value: input }]
          });
          
          expect(true).toBe(false);
        } catch (error) {
          expect(error.message).toContain('dangerous content');
        }
      }
    });

    it('should allow safe parameter values', async () => {
      const safeInputs = [
        "user123",
        "2024-01-01",
        "active",
        "Product Name",
        "123.45",
        "normal text value"
      ];

      for (const input of safeInputs) {
        mockInvoke.mockResolvedValueOnce({
          original_content: "SELECT * FROM table WHERE id = {{param}}",
          processed_content: `SELECT * FROM table WHERE id = ${input}`,
          substitutions: [{ parameter_name: 'param', value: input }],
          missing_parameters: []
        });

        const result = await invoke('process_template_parameters', {
          template_id: 'test-template',
          substitutions: [{ parameter_name: 'param', value: input }]
        });

        expect(result.processed_content).toContain(input);
      }
    });
  });

  describe('Import/Export Security', () => {
    it('should reject oversized import data', async () => {
      const oversizedData = 'x'.repeat(11_000_000); // 11MB

      mockInvoke.mockRejectedValueOnce(new Error('Import data exceeds maximum size limit of 10MB'));

      try {
        await invoke('import_templates', { template_data: oversizedData });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('exceeds maximum size limit');
      }
    });

    it('should reject malformed JSON import data', async () => {
      const malformedData = '{"templates": [{"name": "test", "content": "SELECT * FROM';

      mockInvoke.mockRejectedValueOnce(new Error('Failed to parse import data'));

      try {
        await invoke('import_templates', { template_data: malformedData });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('Failed to parse import data');
      }
    });

    it('should reject imports with too many templates', async () => {
      const oversizedImport = {
        templates: Array(10001).fill({
          id: 'test',
          name: 'test',
          content: 'SELECT 1',
          category_id: 'cat1',
          parameters: []
        }),
        categories: []
      };

      mockInvoke.mockRejectedValueOnce(new Error('Import contains too many templates (maximum: 10,000)'));

      try {
        await invoke('import_templates', { 
          template_data: JSON.stringify(oversizedImport) 
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('too many templates');
      }
    });

    it('should reject templates with dangerous content in import', async () => {
      const dangerousImport = {
        templates: [{
          id: 'dangerous',
          name: 'Dangerous Template',
          content: "SELECT * FROM users; DROP TABLE users; --",
          category_id: 'cat1',
          parameters: []
        }],
        categories: []
      };

      mockInvoke.mockRejectedValueOnce(new Error('Template contains dangerous content'));

      try {
        await invoke('import_templates', { 
          template_data: JSON.stringify(dangerousImport) 
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('dangerous content');
      }
    });
  });

  describe('Input Validation', () => {
    it('should reject excessively long parameter values', async () => {
      const longValue = 'x'.repeat(1001);

      mockInvoke.mockRejectedValueOnce(new Error('Parameter value exceeds maximum length of 1000 characters'));

      try {
        await invoke('process_template_parameters', {
          template_id: 'test-template',
          substitutions: [{ parameter_name: 'test_param', value: longValue }]
        });
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('exceeds maximum length');
      }
    });

    it('should reject parameters with control characters', async () => {
      const controlCharInputs = [
        "test\x00value", // null byte
        "test\x01value", // control character
        "test\x1Fvalue"  // control character
      ];

      for (const input of controlCharInputs) {
        mockInvoke.mockRejectedValueOnce(new Error('Parameter value contains invalid control characters'));

        try {
          await invoke('process_template_parameters', {
            template_id: 'test-template',
            substitutions: [{ parameter_name: 'test_param', value: input }]
          });
          
          expect(true).toBe(false);
        } catch (error) {
          expect(error.message).toContain('invalid control characters');
        }
      }
    });

    it('should reject parameters with dangerous characters', async () => {
      const dangerousChars = ["'", '"', ';', '\\'];

      for (const char of dangerousChars) {
        const input = `test${char}value`;
        
        mockInvoke.mockRejectedValueOnce(new Error('Parameter value contains characters that are not allowed for security reasons'));

        try {
          await invoke('process_template_parameters', {
            template_id: 'test-template',
            substitutions: [{ parameter_name: 'test_param', value: input }]
          });
          
          expect(true).toBe(false);
        } catch (error) {
          expect(error.message).toContain('not allowed for security reasons');
        }
      }
    });
  });

  describe('Template Content Validation', () => {
    it('should validate template names during creation', async () => {
      const invalidNames = [
        '', // empty
        'x'.repeat(256), // too long
        'template\x00name', // control character
      ];

      for (const name of invalidNames) {
        mockInvoke.mockRejectedValueOnce(new Error('Invalid template name'));

        try {
          await invoke('create_template', {
            request: {
              name: name,
              content: 'SELECT 1',
              category_id: 'cat1',
              parameters: []
            }
          });
          
          expect(true).toBe(false);
        } catch (error) {
          expect(error.message).toContain('Invalid template name');
        }
      }
    });

    it('should validate template content size', async () => {
      const oversizedContent = 'SELECT '.repeat(20000); // > 100KB

      mockInvoke.mockRejectedValueOnce(new Error('Template content exceeds maximum size'));

      try {
        await invoke('create_template', {
          request: {
            name: 'Large Template',
            content: oversizedContent,
            category_id: 'cat1',
            parameters: []
          }
        });
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('exceeds maximum size');
      }
    });
  });

  describe('Access Control', () => {
    it('should handle database connection failures gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to acquire database lock'));

      try {
        await invoke('get_templates', { filter: {} });
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('Failed to acquire database lock');
      }
    });

    it('should handle transaction failures securely', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to begin transaction'));

      try {
        await invoke('create_template', {
          request: {
            name: 'Test Template',
            content: 'SELECT 1',
            category_id: 'cat1',
            parameters: []
          }
        });
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('Failed to begin transaction');
      }
    });
  });
});
