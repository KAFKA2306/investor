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
        <p>No verification data available</p>
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
          <div className="status-label">Overall</div>
          <div className="status-value">{validation.overallStatus}</div>
        </div>
      </div>

      <div className="metrics-grid">
        {/* Sharpe Ratio */}
        <div
          className={`metric-card metric-${validation.sharpeStatus.toLowerCase()}`}
          data-metric="sharpe"
          data-status={validation.sharpeStatus}
        >
          <div className="metric-label">Sharpe Ratio</div>
          <div className="metric-value">
            {verificationData.metrics?.sharpe?.toFixed(3) ?? "—"}
          </div>
          <div className="metric-threshold">
            Target: ≥ {validation.sharpeThreshold}
          </div>
          <div className="metric-status">{validation.sharpeStatus}</div>
        </div>

        {/* Information Coefficient */}
        <div
          className={`metric-card metric-${validation.icStatus.toLowerCase()}`}
          data-metric="ic"
          data-status={validation.icStatus}
        >
          <div className="metric-label">Information Coefficient</div>
          <div className="metric-value">
            {verificationData.metrics?.ic?.toFixed(3) ?? "—"}
          </div>
          <div className="metric-threshold">
            Target: ≥ {validation.icThreshold}
          </div>
          <div className="metric-status">{validation.icStatus}</div>
        </div>

        {/* Max Drawdown */}
        <div
          className={`metric-card metric-${validation.maxDdStatus.toLowerCase()}`}
          data-metric="maxdd"
          data-status={validation.maxDdStatus}
        >
          <div className="metric-label">Max Drawdown</div>
          <div className="metric-value">
            {verificationData.metrics?.maxDD !== undefined
              ? `${(verificationData.metrics.maxDD * 100).toFixed(1)}%`
              : "—"}
          </div>
          <div className="metric-threshold">
            Target: ≤ {validation.maxDdThreshold * 100}%
          </div>
          <div className="metric-status">{validation.maxDdStatus}</div>
        </div>

        {/* Total Return */}
        <div className="metric-card metric-info">
          <div className="metric-label">Total Return</div>
          <div className="metric-value">
            {verificationData.metrics?.totalReturn !== undefined
              ? `${(verificationData.metrics.totalReturn * 100).toFixed(2)}%`
              : "—"}
          </div>
          <div className="metric-threshold">Annual Return (no threshold)</div>
          <div className="metric-status">INFO</div>
        </div>
      </div>

      {/* Failure Messages */}
      {validation.failureMessages.length > 0 && (
        <div className="failure-section">
          <h3>Validation Issues</h3>
          <ul className="failure-list">
            {validation.failureMessages.map((message) => (
              <li key={message} className="failure-item">
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success Message */}
      {validation.overallStatus === "PASS" && (
        <div className="success-section">
          <p className="success-message">
            ✨ All quality gate requirements met! This alpha is ready for
            deployment.
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="metadata">
        <div className="metadata-item">
          <span className="label">Generated At:</span>
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
