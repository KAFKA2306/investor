import type React from "react";
import type { StandardVerificationData } from "../dashboard_core";
import { evaluateAlphaValidation } from "../utils/alpha_validation";
import "../styles/alpha_validation_results.css";

interface AlphaValidationResultsProps {
  verificationData: StandardVerificationData | null;
}

export const AlphaValidationResults: React.FC<AlphaValidationResultsProps> = ({
  verificationData,
}) => {
  if (!verificationData) {
    return (
      <div className="alpha-validation-results empty">
        <p>検証データなし — 検証成果物を生成してください。</p>
      </div>
    );
  }

  const validation = evaluateAlphaValidation(verificationData);

  return (
    <div className="alpha-validation-results">
      <div className="validation-header">
        <div>
          <h2>{verificationData.strategyName}</h2>
          <p className="strategy-id">{verificationData.strategyId}</p>
        </div>
        <div
          className={`overall-status status-${validation.overallStatus.toLowerCase()}`}
          data-testid="overall-status"
        >
          <div className="status-label">Metric gate</div>
          <div className="status-value">{validation.overallStatus}</div>
        </div>
      </div>

      <div className="metrics-grid">
        <div
          className={`metric-card metric-${validation.sharpeStatus.toLowerCase()}`}
          data-metric="sharpe"
          data-status={validation.sharpeStatus}
        >
          <div className="metric-label">Sharpe ratio</div>
          <div className="metric-value">
            {verificationData.metrics?.sharpe?.toFixed(3) ?? "—"}
          </div>
          <div className="metric-threshold">
            Threshold: ≥ {validation.sharpeThreshold}
          </div>
          <div className="metric-status">{validation.sharpeStatus}</div>
        </div>

        <div
          className={`metric-card metric-${validation.icStatus.toLowerCase()}`}
          data-metric="ic"
          data-status={validation.icStatus}
        >
          <div className="metric-label">Information coefficient</div>
          <div className="metric-value">
            {verificationData.metrics?.ic?.toFixed(3) ?? "—"}
          </div>
          <div className="metric-threshold">
            Threshold: ≥ {validation.icThreshold}
          </div>
          <div className="metric-status">{validation.icStatus}</div>
        </div>

        <div
          className={`metric-card metric-${validation.maxDdStatus.toLowerCase()}`}
          data-metric="maxdd"
          data-status={validation.maxDdStatus}
        >
          <div className="metric-label">Maximum drawdown</div>
          <div className="metric-value">
            {verificationData.metrics?.maxDD !== undefined
              ? `${(verificationData.metrics.maxDD * 100).toFixed(1)}%`
              : "—"}
          </div>
          <div className="metric-threshold">
            Threshold: ≤ {validation.maxDdThreshold * 100}%
          </div>
          <div className="metric-status">{validation.maxDdStatus}</div>
        </div>

        <div className="metric-card metric-info">
          <div className="metric-label">Total return</div>
          <div className="metric-value">
            {verificationData.metrics?.totalReturn !== undefined
              ? `${(verificationData.metrics.totalReturn * 100).toFixed(2)}%`
              : "—"}
          </div>
          <div className="metric-threshold">Descriptive metric</div>
          <div className="metric-status">INFO</div>
        </div>
      </div>

      {validation.failureMessages.length > 0 && (
        <div className="failure-section">
          <h3>Validation findings</h3>
          <ul className="failure-list">
            {validation.failureMessages.map((message) => (
              <li key={message} className="failure-item">
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validation.overallStatus === "PASS" && (
        <div className="success-section">
          <p className="success-message">
            Metric gate passed. This result does not establish frozen-OOS,
            paper-trading, execution, or live-readiness evidence.
          </p>
        </div>
      )}

      <div className="metadata">
        <div className="metadata-item">
          <span className="label">Generated at:</span>
          <span className="value">
            {new Date(verificationData.generatedAt).toLocaleString("ja-JP")}
          </span>
        </div>
        <div className="metadata-item">
          <span className="label">Run ID:</span>
          <span className="value">{verificationData.audit.runId || "—"}</span>
        </div>
      </div>
    </div>
  );
};
