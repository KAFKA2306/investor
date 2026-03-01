import type React from "react";

interface ASTViewerProps {
  ast?: unknown;
}

export const ASTViewer: React.FC<ASTViewerProps> = ({ ast }) => {
  if (!ast) return <div className="ast-viewer">No AST data available</div>;

  const renderNode = (node: unknown): string => {
    if (!node || typeof node !== "object") return String(node);

    const n = node as Record<string, any>;
    const type = n.type;
    const value = n.value;

    if (type === "Identifier") return String(value);
    if (type === "Literal") return String(value);

    if (type === "BinaryExpression") {
      return `(${renderNode(n.left)} ${n.operator} ${renderNode(n.right)})`;
    }

    if (type === "CallExpression") {
      const args = Array.isArray(n.arguments)
        ? n.arguments.map(renderNode).join(", ")
        : "";
      return `${n.callee?.name ?? "func"}(${args})`;
    }

    if (type === "UnaryExpression") {
      return `${n.operator}${renderNode(n.argument)}`;
    }

    // Fallback for unknown node types
    return JSON.stringify(n);
  };

  try {
    return <div className="ast-viewer">{renderNode(ast)}</div>;
  } catch (_e) {
    return (
      <div className="ast-viewer" style={{ color: "var(--danger)" }}>
        Error rendering AST
      </div>
    );
  }
};
