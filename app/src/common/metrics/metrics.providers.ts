import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

export const metricsProviders = [
  makeCounterProvider({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  }),
  makeHistogramProvider({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  }),
  makeGaugeProvider({
    name: 'database_connections_active',
    help: 'Number of active database connections',
    labelNames: ['database'],
  }),
  makeCounterProvider({
    name: 'search_requests_total',
    help: 'Total number of search requests',
    labelNames: ['type', 'success'],
  }),
  makeCounterProvider({
    name: 'notification_sent_total',
    help: 'Total number of notifications sent',
    labelNames: ['type', 'success'],
  }),
  makeCounterProvider({
    name: 'stock_expiration_checks_total',
    help: 'Total number of stock expiration checks',
    labelNames: ['userId', 'expired_items'],
  }),
];
