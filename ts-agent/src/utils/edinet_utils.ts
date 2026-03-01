import { join } from "node:path";
import { paths } from "./path_registry.ts";

/**
 * 書類IDを生成するよっ！📄✨
 */
export function toDocId(symbol: string, date: string): string {
  return `EDINET-${symbol}-${date}`;
}

/**
 * イベントIDを生成するよっ！🔔✨
 */
export function toEventId(symbol: string, date: string): string {
  return `EVENT-${symbol}-${date}`;
}

export const edinetIds = { toDocId, toEventId };

/**
 * EDINET関連のパス定数だよっ！📍✨
 */
export const edinetPaths = {
  knowledgebase: paths.uqtlSqlite,
  intelligenceMap: join(paths.dataRoot, "edinet_10k_intelligence_map.json"),
  report: join(paths.verificationRoot, "edinet_io_verify_report.json"),
  repairReport: join(paths.verificationRoot, "edinet_io_repair_report.json"),
  quarantine: join(paths.verificationRoot, "edinet_io_quarantine.json"),
};

export interface EdinetSegment {
  title: string;
  content: string;
  startIndex: number;
}

/**
 * EDINETの書類をセグメント分割するエンジニア、EdinetItemizerだよっ！✂️✨
 */
export class EdinetItemizer {
  private static readonly SECTION_PATTERNS = [
    "【事業の内容】",
    "【主要な経営指標等の推移】",
    "【事業等のリスク】",
    "【経営者による財政状態、経営成績及びキャッシュ・フローの状況の分析】",
    "【経営上の重要な契約等】",
    "【研究開発活動】",
    "【設備のスキャニング】",
    "【主要な設備の状況】",
    "【設備の新設、除却等の計画】",
    "【コーポレート・ガバナンスの状況等】",
    "【役員の状況】",
    "【株式等の状況】",
    "【自己株式の取得等の状況】",
    "【配当政策】",
    "【大株主の状況】",
    "【議決権の状況】",
  ];

  public segment(text: string): EdinetSegment[] {
    const segments: EdinetSegment[] = [];
    const matches: { title: string; index: number; matchedText: string }[] = [];

    for (const pattern of EdinetItemizer.SECTION_PATTERNS) {
      const escaped = pattern.replace(/[【】]/g, "");
      const regex = new RegExp(
        `(?:[第\\d]+\\s*[・．\\.]?\\s*)?【\\s*${escaped}\\s*】`,
        "g",
      );

      let match = regex.exec(text);
      while (match !== null) {
        matches.push({
          title: pattern,
          index: match.index,
          matchedText: match[0],
        });
        match = regex.exec(text);
      }
    }

    matches.sort((a, b) => a.index - b.index);

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      if (!current) continue;

      const next = matches[i + 1];

      const segmentContent = next
        ? text.substring(current.index + current.matchedText.length, next.index)
        : text.substring(current.index + current.matchedText.length);

      segments.push({
        title: current.title,
        content: segmentContent.trim(),
        startIndex: current.index,
      });
    }

    return segments;
  }

  public extractSection(text: string, titlePattern: string): string | null {
    const segments = this.segment(text);
    const match = segments.find((s) => s.title.includes(titlePattern));
    return match ? match.content : null;
  }
}

/**
 * EDINETの便利ツール、edinetUtilsだよっ！🎀✨
 */
export const edinetUtils = {
  ids: edinetIds,
  paths: edinetPaths,
  Itemizer: EdinetItemizer,
};
