import { describe, it, expect } from "vitest";
import { mediaHeaderComponent } from "../src/providers/meta.js";

// Parameter header media kirim template Meta: tanpa ini, template ber-header media
// ditolak Meta (error 132018 "issue with the parameters in your template").

describe("mediaHeaderComponent", () => {
  it("image → parameter header {image:{link}}", () => {
    expect(mediaHeaderComponent("image", "https://x.id/uploads/a.jpg")).toEqual({
      type: "header",
      parameters: [{ type: "image", image: { link: "https://x.id/uploads/a.jpg" } }],
    });
  });

  it("video → parameter header {video:{link}}", () => {
    expect(mediaHeaderComponent("video", "https://x.id/v.mp4")).toEqual({
      type: "header",
      parameters: [{ type: "video", video: { link: "https://x.id/v.mp4" } }],
    });
  });

  it("document → menyertakan filename dari segmen akhir URL (tanpa query)", () => {
    expect(mediaHeaderComponent("document", "https://x.id/uploads/rilis.pdf?v=2")).toEqual({
      type: "header",
      parameters: [{ type: "document", document: { link: "https://x.id/uploads/rilis.pdf?v=2", filename: "rilis.pdf" } }],
    });
  });
});
