import type React from "react";
import { ASTViewer } from "./ASTViewer";

interface ScoreBarProps {
  label: string;
  value: number;
}

/**
 * 金融評価指標を可視化するプロフェッショナルなインジケーターだよっ！📉✨
 */
const ScoreBar: React.FC<ScoreBarProps> = ({ label, value }) => {
  const getBarColor = (val: number) => {
    if (val >= 0.8)
      return "linear-gradient(90deg, var(--brand-soft), var(--brand))";
    if (val >= 0.5)
      return "linear-gradient(90deg, var(--accent-soft), var(--accent))";
    return "linear-gradient(90deg, #f43f5e, #be123c)";
  };

  return (
    <div className="score-bar-grid" style={{ marginBottom: "0.5rem" }}>
      <span
        className="score-bar-label"
        style={{
          fontSize: "0.7rem",
          fontWeight: "bold",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </span>
      <div
        className="score-bar-bg"
        style={{
          height: "6px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          className="score-bar-fill"
          style={{
            height: "100%",
            width: `${value * 100}%`,
            background: getBarColor(value),
            boxShadow: "0 0 10px rgba(0,0,0,0.2)",
          }}
        />
      </div>
      <span
        className="score-bar-value"
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.75rem",
          fontWeight: "black",
          textAlign: "right",
          minWidth: "2rem",
        }}
      >
        {(value * 100).toFixed(0)}
      </span>
    </div>
  );
};

interface AlphaPassportCardProps {
  id: string;
  description: string;
  reasoning: string;
  scores: {
    priority: number;
    fitness: number;
    stability: number;
    adoption: number;
  };
  status: string;
  rejectReason?: string;
  featureSignature?: string;
  ast?: unknown;
  docId?: string;
  edinetCode?: string;
  referenceLinks?: string[];
}

/**
 * 投資家が唸る「アルファ鑑定書」だよっ！💎🔬
 * 信頼性を高めるために、日本語化と重厚なメタデータ表示を強化したんだもんっ！✨
 */
export const AlphaPassportCard: React.FC<AlphaPassportCardProps> = ({
  id,
  description,
  reasoning,
  scores,
  status,
  rejectReason,
  featureSignature,
  ast,
  docId,
  edinetCode,
  referenceLinks,
}) => {
  return (
    <div
      className={`passport-card ${status.toLowerCase()}`}
      style={{
        borderLeft: "4px solid",
        borderLeftColor:
          status === "SELECTED" ? "var(--brand)" : "var(--danger)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        background: "var(--bg-panel)",
        borderRadius: "12px",
        padding: "1.2rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.8rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-10px",
          right: "-10px",
          opacity: 0.03,
          fontSize: "4rem",
          fontWeight: "black",
          pointerEvents: "none",
        }}
      >
        ALPHA
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          className="chip"
          style={{
            padding: "0.2rem 0.6rem",
            fontSize: "0.65rem",
            fontWeight: "bold",
            borderRadius: "4px",
            textTransform: "uppercase",
            background:
              status === "SELECTED"
                ? "var(--brand-soft)"
                : "var(--danger-soft)",
            color: status === "SELECTED" ? "var(--brand)" : "var(--danger)",
            border: `1px solid ${status === "SELECTED" ? "var(--brand)" : "var(--danger)"}44`,
          }}
        >
          {status === "SELECTED" ? "採択済み" : "却下"}
        </span>
        <span
          style={{
            fontSize: "0.65rem",
            color: "var(--ink-soft)",
            fontFamily: "var(--mono)",
          }}
        >
          SPEC_ID: {id}
        </span>
      </div>

      <div>
        <h4
          style={{
            margin: "0 0 0.4rem",
            color: "var(--ink)",
            fontSize: "1rem",
            lineHeight: 1.3,
          }}
        >
          {description}
        </h4>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--ink-soft)",
            background: "rgba(0,0,0,0.03)",
            padding: "0.6rem",
            borderRadius: "6px",
            borderLeft: "2px solid var(--line)",
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: "0.2rem",
              fontSize: "0.6rem",
              color: "var(--ink-soft)",
              opacity: 0.6,
              textTransform: "uppercase",
            }}
          >
            Reasoning / 論理的背景
          </strong>
          {reasoning}
        </div>
      </div>

      <div
        style={{
          background: "rgba(0,0,0,0.02)",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid var(--line)",
        }}
      >
        <ScoreBar label="優先度 (Priority)" value={scores.priority} />
        <ScoreBar label="フィットネス (Fitness)" value={scores.fitness} />
        <ScoreBar label="安定性 (Stability)" value={scores.stability} />
        <ScoreBar label="採用スコア (Adoption)" value={scores.adoption} />
      </div>

      {Boolean(featureSignature) && (
        <div
          style={{
            background: "var(--bg-soft)",
            padding: "0.8rem",
            borderRadius: "8px",
          }}
        >
          <span
            className="quick-title"
            style={{
              fontSize: "0.65rem",
              color: "var(--ink-soft)",
              fontWeight: "bold",
              display: "block",
              marginBottom: "0.4rem",
            }}
          >
            特徴量シグネチャ
          </span>
          <code
            style={{
              fontSize: "0.7rem",
              color: "var(--brand)",
              wordBreak: "break-all",
              fontFamily: "var(--mono)",
            }}
          >
            {String(featureSignature)}
          </code>
        </div>
      )}

      {Boolean(ast) && (
        <div>
          <span
            className="quick-title"
            style={{
              fontSize: "0.65rem",
              color: "var(--ink-soft)",
              fontWeight: "bold",
            }}
          >
            論理ツリー構造 (AST)
          </span>
          <div style={{ marginTop: "0.4rem" }}>
            <ASTViewer ast={ast} />
          </div>
        </div>
      )}

      {status === "REJECTED" && rejectReason && (
        <div
          style={{
            color: "var(--danger)",
            fontSize: "0.75rem",
            padding: "0.6rem",
            borderRadius: "6px",
            background: "var(--danger-soft)",
            borderLeft: "3px solid var(--danger)",
          }}
        >
          <strong>却下理由:</strong> {rejectReason}
        </div>
      )}

      {(docId || edinetCode || referenceLinks) && (
        <div
          style={{
            marginTop: "0.4rem",
            paddingTop: "0.8rem",
            borderTop: "1px dashed var(--line)",
            fontSize: "0.7rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
          }}
        >
          {docId && (
            <span
              className="pill ready"
              style={{ opacity: 0.8 }}
              title="Source Document ID"
            >
              DOC_DATA: {docId}
            </span>
          )}
          {edinetCode && (
            <span
              className="pill ready"
              style={{ opacity: 0.8 }}
              title="EDINET Code"
            >
              ENTITY_CODE: {edinetCode}
            </span>
          )}
          {referenceLinks?.map((link, idx) => (
            <a
              key={link}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="pill ready"
              style={{ textDecoration: "none", opacity: 0.9 }}
            >
              外部参照 {idx + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
