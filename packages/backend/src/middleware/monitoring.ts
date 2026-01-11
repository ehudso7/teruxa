import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';

// Prometheus-compatible metrics storage
interface Metrics {
  httpRequestDuration: Map<string, number[]>;
  httpRequestTotal: Map<string, number>;
  httpRequestErrors: Map<string, number>;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

class MetricsCollector {
  private metrics: Metrics = {
    httpRequestDuration: new Map(),
    httpRequestTotal: new Map(),
    httpRequestErrors: new Map(),
    activeConnections: 0,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
  };

  private intervalId?: NodeJS.Timeout;

  constructor() {
    // Update system metrics every 10 seconds
    this.intervalId = setInterval(() => {
      this.metrics.memoryUsage = process.memoryUsage();
      this.metrics.cpuUsage = process.cpuUsage();
    }, 10000);
  }

  recordHttpRequest(method: string, path: string, statusCode: number, duration: number) {
    const key = `${method}_${path}_${statusCode}`;

    // Record duration
    if (!this.metrics.httpRequestDuration.has(key)) {
      this.metrics.httpRequestDuration.set(key, []);
    }
    this.metrics.httpRequestDuration.get(key)?.push(duration);

    // Record total count
    const totalKey = `${method}_${path}`;
    this.metrics.httpRequestTotal.set(
      totalKey,
      (this.metrics.httpRequestTotal.get(totalKey) || 0) + 1
    );

    // Record errors (4xx and 5xx)
    if (statusCode >= 400) {
      const errorKey = `${method}_${path}_${Math.floor(statusCode / 100)}xx`;
      this.metrics.httpRequestErrors.set(
        errorKey,
        (this.metrics.httpRequestErrors.get(errorKey) || 0) + 1
      );
    }
  }

  incrementActiveConnections() {
    this.metrics.activeConnections++;
  }

  decrementActiveConnections() {
    this.metrics.activeConnections--;
  }

  getMetrics(): string {
    const lines: string[] = [];

    // HTTP request duration histogram
    lines.push('# HELP http_request_duration_seconds HTTP request latency');
    lines.push('# TYPE http_request_duration_seconds histogram');
    this.metrics.httpRequestDuration.forEach((durations, key) => {
      const [method, path, status] = key.split('_');
      const sorted = durations.sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((acc, val) => acc + val, 0);

      // Calculate percentiles
      const p50 = sorted[Math.floor(count * 0.5)] || 0;
      const p90 = sorted[Math.floor(count * 0.9)] || 0;
      const p99 = sorted[Math.floor(count * 0.99)] || 0;

      lines.push(`http_request_duration_seconds_bucket{method="${method}",path="${path}",status="${status}",le="0.05"} ${sorted.filter(d => d <= 0.05).length}`);
      lines.push(`http_request_duration_seconds_bucket{method="${method}",path="${path}",status="${status}",le="0.1"} ${sorted.filter(d => d <= 0.1).length}`);
      lines.push(`http_request_duration_seconds_bucket{method="${method}",path="${path}",status="${status}",le="0.5"} ${sorted.filter(d => d <= 0.5).length}`);
      lines.push(`http_request_duration_seconds_bucket{method="${method}",path="${path}",status="${status}",le="1"} ${sorted.filter(d => d <= 1).length}`);
      lines.push(`http_request_duration_seconds_bucket{method="${method}",path="${path}",status="${status}",le="+Inf"} ${count}`);
      lines.push(`http_request_duration_seconds_sum{method="${method}",path="${path}",status="${status}"} ${sum}`);
      lines.push(`http_request_duration_seconds_count{method="${method}",path="${path}",status="${status}"} ${count}`);
    });

    // HTTP request total counter
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    this.metrics.httpRequestTotal.forEach((count, key) => {
      const [method, path] = key.split('_');
      lines.push(`http_requests_total{method="${method}",path="${path}"} ${count}`);
    });

    // HTTP request errors counter
    lines.push('# HELP http_request_errors_total Total number of HTTP errors');
    lines.push('# TYPE http_request_errors_total counter');
    this.metrics.httpRequestErrors.forEach((count, key) => {
      const [method, path, errorClass] = key.split('_');
      lines.push(`http_request_errors_total{method="${method}",path="${path}",class="${errorClass}"} ${count}`);
    });

    // Active connections gauge
    lines.push('# HELP active_connections Number of active connections');
    lines.push('# TYPE active_connections gauge');
    lines.push(`active_connections ${this.metrics.activeConnections}`);

    // Memory usage gauges
    lines.push('# HELP nodejs_memory_usage_bytes Node.js memory usage');
    lines.push('# TYPE nodejs_memory_usage_bytes gauge');
    lines.push(`nodejs_memory_usage_bytes{type="rss"} ${this.metrics.memoryUsage.rss}`);
    lines.push(`nodejs_memory_usage_bytes{type="heapTotal"} ${this.metrics.memoryUsage.heapTotal}`);
    lines.push(`nodejs_memory_usage_bytes{type="heapUsed"} ${this.metrics.memoryUsage.heapUsed}`);
    lines.push(`nodejs_memory_usage_bytes{type="external"} ${this.metrics.memoryUsage.external}`);

    // CPU usage counters
    lines.push('# HELP nodejs_cpu_usage_seconds Node.js CPU usage');
    lines.push('# TYPE nodejs_cpu_usage_seconds counter');
    lines.push(`nodejs_cpu_usage_seconds{type="user"} ${this.metrics.cpuUsage.user / 1000000}`);
    lines.push(`nodejs_cpu_usage_seconds{type="system"} ${this.metrics.cpuUsage.system / 1000000}`);

    return lines.join('\n');
  }

  cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export const metricsCollector = new MetricsCollector();

// Request tracking middleware
export function requestMonitoring(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();

  // Increment active connections
  metricsCollector.incrementActiveConnections();

  // Capture the original end function
  const originalEnd = res.end;

  // Override the end function to capture metrics
  res.end = function(...args: any[]) {
    // Calculate duration
    const duration = (performance.now() - start) / 1000; // Convert to seconds

    // Normalize path for metrics (remove dynamic segments)
    const path = req.route?.path || req.path.replace(/\/[a-f0-9-]+/g, '/:id');

    // Record metrics
    metricsCollector.recordHttpRequest(req.method, path, res.statusCode, duration);

    // Decrement active connections
    metricsCollector.decrementActiveConnections();

    // Log request details
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(3)}s`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Call the original end function
    return originalEnd.apply(res, args);
  };

  next();
}

// Health check endpoint
export function healthCheck(req: Request, res: Response) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    pid: process.pid,
    version: process.version,
    env: process.env.NODE_ENV,
  };

  res.json(health);
}

// Metrics endpoint (Prometheus format)
export function metricsEndpoint(req: Request, res: Response) {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metricsCollector.getMetrics());
}

// Graceful shutdown
process.on('SIGTERM', () => {
  metricsCollector.cleanup();
});