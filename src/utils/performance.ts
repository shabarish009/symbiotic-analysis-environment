/**
 * Performance monitoring utilities for XP interface
 * Provides lightweight performance tracking for component rendering
 */

import React from 'react';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private isEnabled: boolean;

  constructor() {
    // Only enable in development mode
    this.isEnabled = process.env.NODE_ENV === 'development';
  }

  /**
   * Start measuring a performance metric
   */
  start(name: string): void {
    if (!this.isEnabled) return;

    this.metrics.set(name, {
      name,
      startTime: window.performance.now(),
    });
  }

  /**
   * End measuring a performance metric
   */
  end(name: string): number | null {
    if (!this.isEnabled) return null;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric "${name}" was not started`);
      return null;
    }

    const endTime = window.performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    // Log slow operations (>16ms for 60fps)
    if (duration > 16) {
      console.warn(
        `Slow operation detected: ${name} took ${duration.toFixed(2)}ms`
      );
    }

    return duration;
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values()).filter(
      m => m.duration !== undefined
    );
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Log performance summary
   */
  logSummary(): void {
    if (!this.isEnabled) return;

    const metrics = this.getMetrics();
    if (metrics.length === 0) return;

    console.group('🚀 XP Interface Performance Summary');
    metrics.forEach(metric => {
      const status = metric.duration! > 16 ? '⚠️' : '✅';
      console.log(`${status} ${metric.name}: ${metric.duration!.toFixed(2)}ms`);
    });
    console.groupEnd();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for measuring component render performance
 */
export const usePerformanceMonitor = (componentName: string) => {
  const startMeasurement = () => {
    performanceMonitor.start(`${componentName}-render`);
  };

  const endMeasurement = () => {
    return performanceMonitor.end(`${componentName}-render`);
  };

  return { startMeasurement, endMeasurement };
};

/**
 * Higher-order component for automatic performance monitoring
 */
export const withPerformanceMonitoring = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.FC<P> => {
  const displayName =
    componentName || WrappedComponent.displayName || WrappedComponent.name;

  const MonitoredComponent: React.FC<P> = props => {
    React.useEffect(() => {
      performanceMonitor.start(`${displayName}-mount`);
      return () => {
        performanceMonitor.end(`${displayName}-mount`);
      };
    }, []);

    React.useLayoutEffect(() => {
      performanceMonitor.start(`${displayName}-layout`);
      return () => {
        performanceMonitor.end(`${displayName}-layout`);
      };
    });

    return React.createElement(WrappedComponent, props);
  };

  MonitoredComponent.displayName = `withPerformanceMonitoring(${displayName})`;
  return MonitoredComponent;
};

/**
 * Decorator for measuring function execution time
 */
export const measureExecutionTime = (
  target: unknown,
  propertyName: string,
  descriptor: PropertyDescriptor
) => {
  const method = descriptor.value;

  descriptor.value = function (...args: unknown[]) {
    const methodName = `${target.constructor.name}.${propertyName}`;
    performanceMonitor.start(methodName);

    try {
      const result = method.apply(this, args);

      // Handle async methods
      if (result instanceof Promise) {
        return result.finally(() => {
          performanceMonitor.end(methodName);
        });
      }

      performanceMonitor.end(methodName);
      return result;
    } catch (error) {
      performanceMonitor.end(methodName);
      throw error;
    }
  };

  return descriptor;
};
