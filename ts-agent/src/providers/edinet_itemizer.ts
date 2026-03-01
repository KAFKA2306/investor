/**
 * EdinetItemizer
 *
 * Logic to segment Japanese EDINET documents (Annual Reports, etc.) into logical sections.
 */

export interface EdinetSegment {
  title: string;
  content: string;
  startIndex: number;
}

export class EdinetItemizer {
  /**
   * Standard Japanese section headers in EDINET reports.
   * These are usually enclosed in 【 】.
   */
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

  /**
   * Segment the provided HTML/Text into logical units based on headers.
   */
  public segment(text: string): EdinetSegment[] {
    const segments: EdinetSegment[] = [];
    const matches: { title: string; index: number; matchedText: string }[] = [];

    for (const pattern of EdinetItemizer.SECTION_PATTERNS) {
      // Escape special chars and allow for optional numbering/whitespace
      // Supports: 【...】, 1【...】, 第1【...】, 1.【...】, etc.
      const escaped = pattern.replace(/[【】]/g, "");
      const regex = new RegExp(
        `(?:[第\\d]+\\s*[・．\\.]?\\s*)?【\\s*${escaped}\\s*】`,
        "g",
      );

      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          title: pattern,
          index: match.index,
          matchedText: match[0],
        });
      }
    }

    // Sort by index to maintain document order
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

  /**
   * Extract only a specific section.
   */
  public extractSection(text: string, titlePattern: string): string | null {
    const segments = this.segment(text);
    const match = segments.find((s) => s.title.includes(titlePattern));
    return match ? match.content : null;
  }
}
