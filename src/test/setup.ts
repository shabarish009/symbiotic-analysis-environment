import '@testing-library/jest-dom';

// Mock Tauri API for testing
const mockInvoke = vi.fn();
const mockTauri = {
  core: {
    invoke: mockInvoke,
  },
};

// @ts-expect-error - Global Tauri mock for testing
global.__TAURI__ = mockTauri;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Reset mocks before each test
beforeEach(() => {
  mockInvoke.mockClear();
});

export { mockInvoke };
