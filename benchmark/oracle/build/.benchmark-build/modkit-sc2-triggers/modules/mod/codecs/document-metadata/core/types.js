/**
 * Types for the StarCraft II DocumentHeader binary format.
 *
 * The DocumentHeader file appears inside every .SC2Mod, .SC2Campaign,
 * and .SC2Map MPQ archive at the path "DocumentHeader".
 *
 * Format fingerprint: magic bytes "H2CS" at offset 0.
 */
// ---------------------------------------------------------------------------
// Enums / constants
// ---------------------------------------------------------------------------
/**
 * Known flag values observed across 666 real files (661 parsed).
 * Flags live at offset 0x0C (uint16 LE).
 *
 * Bit correlations (derived from mods-analysis-results.json, R3):
 *   bit 0  (0x0001) — "standard/full" profile. Only ever set in 0x0501 and
 *                     0x0401. Present in every CAMPAIGN and the large
 *                     full-featured group (avg ~64 entries, up to 2191).
 *   bit 2  (0x0004) — map-only minimal profile. 0x0004 appears alone on 22
 *                     files, all MAP, all unknown3===0.
 *   bit 3  (0x0008) — "extended/custom" format. Set in 0x0008/0x0108/0x0308/
 *                     0x0408/0x0508. Never appears on a CAMPAIGN.
 *   bit 8  (0x0100) — rich-metadata profile. Set in the standard group plus
 *                     the website and extended-full variants.
 *   bit 9  (0x0200) — website present. Only ever set as part of 0x0308
 *                     (126 mods + 9 maps, avg ~36 entries).
 *   bit 10 (0x0400) — full entries section present. Set in 0x0401/0x0408/
 *                     0x0501/0x0508; always set on CAMPAIGN files.
 *
 * NOTE: file TYPE (MAP vs MOD/CAMPAIGN) is NOT carried by flags — it is the
 * `unknown3` field (0 = MAP, 2 = MOD/CAMPAIGN) that distinguishes them.
 */
export const KNOWN_FLAGS = {
    /** 0x0501 — bits 0+8+10. Most common (301 files); all 15 campaigns, plus
     *  full-featured mods/maps. Largest entry counts. */
    STANDARD: 0x0501,
    /** 0x0401 — bits 0+10. Rare (1 file, a 2-entry mod). Minimal standard. */
    ALT_STANDARD: 0x0401,
    /** 0x0408 — bits 3+10. Extended/custom mods only (98 files, all MOD). */
    EXTENDED: 0x0408,
    /** 0x0508 — bits 3+8+10. Extended + rich metadata (14 files, MOD+MAP). */
    EXTENDED_B: 0x0508,
    /** 0x0308 — bits 3+8+9. Website group (135 files, mostly MOD). bit 9 = website. */
    HAS_WEBSITE: 0x0308,
    /** 0x0008 — bit 3 only. Extended-minimal (89 files, MOD+MAP). */
    EXTENDED_MINIMAL: 0x0008,
    /** 0x0004 — bit 2 only. Map-only minimal profile (22 files, all MAP). */
    MAP_MINIMAL: 0x0004,
    /** 0x0108 — bits 3+8. Old/rare variant (1 file). */
    RARE_B: 0x0108,
};
/**
 * Known entry type codes (4-byte ASCII strings).
 * The meaning of these codes is under investigation.
 */
export const ENTRY_TYPES = {
    /** Most common — standard UTF-8 string values */
    SUNE: 'SUne',
    /** Loading screen tips — abab pattern */
    URUR: 'URur',
    /** MapInfo / DocInfo entries */
    RFRF: 'RFrf',
    EDED: 'EDed',
    SESE: 'SEse',
    XMSE: 'XMse',
    RKOK: 'RKok',
    NCHZ: 'NChz',
    WTHZ: 'WThz',
    LPLP: 'LPlp',
    TITI: 'TIti',
    RBTP: 'RBtp',
};
