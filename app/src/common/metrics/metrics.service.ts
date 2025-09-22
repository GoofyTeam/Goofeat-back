import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    public httpRequestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    public httpRequestDuration: Histogram<string>,
    @InjectMetric('database_connections_active')
    public databaseConnectionsActive: Gauge<string>,
    @InjectMetric('search_requests_total')
    public searchRequestsTotal: Counter<string>,
    @InjectMetric('notification_sent_total')
    public notificationSentTotal: Counter<string>,
    @InjectMetric('stock_expiration_checks_total')
    public stockExpirationChecksTotal: Counter<string>,
  ) {}

  recordHttpRequest(method: string, route: string, statusCode: number) {
    this.httpRequestsTotal
      .labels({
        method,
        route,
        status_code: statusCode.toString(),
      })
      .inc();
  }

  recordHttpDuration(method: string, route: string, duration: number) {
    this.httpRequestDuration
      .labels({
        method,
        route,
      })
      .observe(duration);
  }

  setDatabaseConnections(count: number) {
    this.databaseConnectionsActive.set(count);
  }

  recordSearchRequest(type: string, success: boolean) {
    this.searchRequestsTotal
      .labels({
        type,
        success: success.toString(),
      })
      .inc();
  }

  recordNotificationSent(type: string, success: boolean) {
    this.notificationSentTotal
      .labels({
        type,
        success: success.toString(),
      })
      .inc();
  }

  recordStockExpirationCheck(userId: string, expiredItems: number) {
    this.stockExpirationChecksTotal
      .labels({
        userId,
        expired_items: expiredItems.toString(),
      })
      .inc();
  }
}
