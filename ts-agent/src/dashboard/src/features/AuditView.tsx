import type React from "react";
import type { DailyReport } from "../dashboard_core";
import {
  formatBps,
  formatCompact,
  formatPercent,
  pickNumber,
} from "../dashboard_core";

interface AuditViewProps {
  report: DailyReport | null;
}

export const AuditView: React.FC<AuditViewProps> = ({ report }) => {
  if (!report) return <div className="empty">監査データがありません。</div>;

  const orders = report.execution?.orders ?? [];
  const backtest = report.results?.backtest;

  return (
    <div
      className="audit-view"
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
    >
      <section className="kpi-grid">
        <article className="kpi-card">
          <div className="label">実現リターン (Net)</div>
          <div
            className={`value ${pickNumber(backtest?.netReturn) >= 0 ? "pos" : "neg"}`}
          >
            {formatPercent(pickNumber(backtest?.netReturn))}
          </div>
        </article>
        <article className="kpi-card">
          <div className="label">取引日数</div>
          <div className="value">{backtest?.tradingDays ?? 0} 日</div>
        </article>
        <article className="kpi-card">
          <div className="label">推定コスト</div>
          <div className="value">
            {formatBps(pickNumber(backtest?.totalCostBps))}
          </div>
        </article>
      </section>

      <section className="panel section">
        <div className="section-head">
          <h3>執行品質解析</h3>
          <span>Slippage & Slippage Cost</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>銘柄</th>
                <th>売買</th>
                <th>数量</th>
                <th>約定価格</th>
                <th>推定代金 (JPY)</th>
                <th>執行時刻</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => (
                <tr key={`${order.symbol}-${idx}`}>
                  <td>
                    <strong>{order.symbol}</strong>
                  </td>
                  <td>
                    <span
                      className={`chip ${order.side.includes("BUY") ? "ready" : "risk"}`}
                    >
                      {order.side}
                    </span>
                  </td>
                  <td>{order.quantity}</td>
                  <td>{order.fillPrice.toLocaleString()}</td>
                  <td>{formatCompact(order.notional)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: "0.7rem" }}>
                    {order.executedAt}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    執行ログはありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
