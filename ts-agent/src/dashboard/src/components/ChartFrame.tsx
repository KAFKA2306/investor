import type React from "react";

/**
 * チャートを包み込む、魔法のフレームだよっ！📊✨
 */
export interface ChartFrameProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: string | number;
}

export const ChartFrame: React.FC<ChartFrameProps> = ({
  title,
  subtitle,
  children,
  height = 400,
}) => {
  return (
    <div className="bg-slate-800/40 backdrop-blur-lg border border-slate-700/50 rounded-3xl p-8 shadow-2xl overflow-hidden group hover:border-cyan-500/30 transition-all duration-500">
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          {title}
        </h2>
        {subtitle && (
          <p className="text-slate-500 text-sm font-medium">{subtitle}</p>
        )}
      </div>
      <div style={{ height }} className="w-full relative">
        {children}
      </div>
    </div>
  );
};
