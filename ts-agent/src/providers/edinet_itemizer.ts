// Backward-compatible EDINET itemizer entrypoint.
// The implementation was consolidated into utils/edinet_utils.ts; keep a
// re-export here while maintained scripts are migrated to the canonical module.
export {
  EdinetItemizer,
  type EdinetSegment,
} from "../utils/edinet_utils.ts";
