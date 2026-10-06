import { describe, expect, it } from "vitest";
import { DASHBOARD_FIELDS, PRIVATE_DETAILS, normalizePrivacy, privatePageFor } from "@/lib/privacy";
import { youtubeId } from "@/components/announcements/AnnouncementMedia";

/** `src/lib/privacy.ts` is COPIED from the web app — the server reads the same list. */
describe("privatePageFor", () => {
  it("matches a private page and everything under it", () => {
    expect(privatePageFor("/reports")?.key).toBe("page.reports");
    expect(privatePageFor("/payroll/payslips/abc")?.key).toBe("page.payroll");
  });
  it("does not match a page that merely starts with the same letters", () => {
    expect(privatePageFor("/reports-old")).toBeNull();
    expect(privatePageFor("/dashboard")).toBeNull();
  });
});

describe("normalizePrivacy", () => {
  it("keeps only known keys, once each", () => {
    expect(normalizePrivacy({ items: ["page.reports", "page.reports", "nope", 3] })).toEqual({ items: ["page.reports"] });
    expect(normalizePrivacy(null)).toEqual({ items: [] });
  });
});

describe("dashboard figures", () => {
  it("every private dashboard item hides at least one figure", () => {
    for (const d of PRIVATE_DETAILS) expect(DASHBOARD_FIELDS[d.key]?.length).toBeGreaterThan(0);
  });
});

describe("youtubeId", () => {
  it("reads the usual link shapes", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=5")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/abcDEF12345")).toBe("abcDEF12345");
    expect(youtubeId("https://example.com/video.mp4")).toBeNull();
  });
});
