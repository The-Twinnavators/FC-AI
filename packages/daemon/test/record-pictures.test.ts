/**
 * Records without their picture get one from FlowCode (recordPictures.ts): an open photo found by the record's own
 * words, else a picture FlowCode draws with the record's title. The open-photo search turns away results that aren't
 * a photo of the subject or aren't fit for a client's app, and never offers a photo already in the app (Frameproof: a
 * 1958 camera advert and a palace in a portrait gallery, a lingerie shot offered first, 4 of 12 photos missing).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppModel } from "../src/orchestrator/appModel.js";
import { contentWords, pictureGaps, pictureQueries, pictureSvg, withRecordValue } from "../src/orchestrator/recordPictures.js";
import { UNSUITABLE, findOpenImage } from "../src/workspace/openImages.js";
import { PathJail } from "../src/security/pathJail.js";

const MODEL = {
  product: "Frameproof",
  roles: ["client"],
  entities: [
    {
      key: "photo",
      label: "Photo",
      plural: "Photos",
      titleField: "title",
      filters: ["category"],
      fields: [
        { key: "id", label: "ID", type: "text" },
        { key: "title", label: "Title", type: "text" },
        { key: "category", label: "Category", type: "select", options: ["Outdoor", "Studio"] },
        { key: "orientation", label: "Orientation", type: "select", options: ["Portrait", "Landscape"] },
        { key: "imageSource", label: "Image Source", type: "text" },
        { key: "altText", label: "Alt Text", type: "text" },
      ],
    },
  ],
  seed: {},
  nav: [{ label: "Gallery", items: [{ id: "gallery", label: "Gallery", kind: "list", entity: "photo" }] }],
} as unknown as AppModel;

const SCHEMA = `export const schema = { "appKey": "frameproof", "entities": [{ "key": "photo", "label": "Photo", "titleField": "title" }] };

export const seed = {
  "photo": [
    {
      "id": "photo-01",
      "title": "Golden Hour",
      "category": "Outdoor",
      "orientation": "Portrait",
        "imageSource": "/images/photo-01.jpg",
      "altText": "A portrait photo of a person during golden hour lighting."
    },
    {
      "id": "photo-04",
      "title": "Quiet Smile",
      "category": "Studio",
      "orientation": "Portrait",
      "imageSource": "",
      "altText": "A portrait photo of a person with a quiet smile."
    },
    {
      "id": "photo-07",
      "title": "Autumn Path",
      "category": "Outdoor",
      "orientation": "Landscape",
      "imageSource": "/images/gone.jpg",
      "altText": "A landscape portrait photo of a path in autumn."
    }
  ]
};
`;

function workspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-pictures-"));
  fs.mkdirSync(path.join(root, "src/app"), { recursive: true });
  fs.mkdirSync(path.join(root, "public/images"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/app/schema.ts"), SCHEMA);
  fs.writeFileSync(path.join(root, "public/images/photo-01.jpg"), "jpg");
  return root;
}

describe("records without their picture", () => {
  it("are found (empty, or naming a file that isn't there) with their words, category and orientation", () => {
    const found = pictureGaps(workspace(), MODEL)!;
    expect(found.field).toBe("imageSource");
    expect(found.kind).toBe("portrait");
    expect(found.gaps.map((g) => [g.id, g.category, g.orientation])).toEqual([
      ["photo-04", "Studio", "portrait"],
      ["photo-07", "Outdoor", "landscape"],
    ]);
    expect(found.gaps[0]!.words).toEqual(contentWords("Quiet Smile portrait person quiet smile"));
  });

  it("include a record whose picture the photo check turned away; the ones with a picture are listed with their file", () => {
    const found = pictureGaps(workspace(), MODEL, ["photo-01"])!;
    expect(found.gaps.map((g) => g.id)).toEqual(["photo-01", "photo-04", "photo-07"]);
    expect(found.present.map((p) => [p.id, p.file])).toEqual([["photo-01", "/images/photo-01.jpg"]]);
  });

  it("are searched for by their own words first, then their description, then their category", () => {
    const g = pictureGaps(workspace(), MODEL)!;
    expect(pictureQueries(g.gaps[0]!, g.kind)).toEqual([
      { query: "quiet smile portrait", mustMatch: ["quiet", "smile"] },
      { query: "quiet smile portrait", mustMatch: ["quiet", "smile", "portrait"] },
      { query: "studio portrait", mustMatch: ["portrait"] },
    ].filter((q, i, all) => all.findIndex((x) => x.query === q.query) === i));
  });

  it("get their picture set in the source, only in their own record", () => {
    const out = withRecordValue(SCHEMA, "photo-04", "imageSource", "/images/photo-04.svg")!;
    expect(out).toContain('"id": "photo-04",\n      "title": "Quiet Smile",\n      "category": "Studio",\n      "orientation": "Portrait",\n      "imageSource": "/images/photo-04.svg"');
    expect(out).toContain('"imageSource": "/images/photo-01.jpg"');
    expect(out).toContain('"imageSource": "/images/gone.jpg"');
    expect(withRecordValue(SCHEMA, "photo-99", "imageSource", "x")).toBeUndefined();
  });

  it("get a drawn picture with their title, in their orientation, when no photo fits", () => {
    const svg = pictureSvg("Linen Backdrop & Light", "landscape", 2);
    expect(svg).toContain('viewBox="0 0 1200 800"');
    expect(svg).toContain('aria-label="Linen Backdrop &amp; Light"');
    expect(svg).toContain(">Linen Backdrop &amp;</text>");
    expect(pictureSvg("Quiet Smile", "portrait", 0)).toContain('viewBox="0 0 800 1000"');
  });
});

describe("the open-photo search", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("knows an archive print or an advert by its own catalogue title", () => {
    for (const t of ["Arthur Roderick, Pelaw Main - studio portrait, [n.d.]", "1958 Sears: Why buy a 35mm Camera?", "General view, from the trees, 1906 (CHS-4332)", "Carte de visite of a lady", "Studio portrait of a bride, [1920s]", "Postcard studio portrait of a man posting with an automobile"]) expect(UNSUITABLE.test(t)).toBe(true);
    for (const t of ["Woman Window", "Business People", "Tasha 5th shoot 04", "Studio portrait European couple posing"]) expect(UNSUITABLE.test(t)).toBe(false);
  });

  it("turns away unsuitable and off-subject results and photos already in the app", async () => {
    const root = workspace();
    fs.mkdirSync(path.join(root, "src/content"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/content/image-credits.json"), JSON.stringify([{ file: "/images/photo-01.jpg", title: "Smile", creator: "x", license: "CC0", licenseUrl: "", source: "https://example.org/used" }]));
    const result = (id: string, title: string, tags: string[]) => ({ id, title, url: `https://img.example.org/${id}.jpg`, license: "cc0", width: 1200, height: 1500, foreign_landing_url: `https://example.org/${id}`, tags: tags.map((name) => ({ name })) });
    const jpeg = Buffer.alloc(4000, 1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("https://api.openverse.org")
          ? new Response(JSON.stringify({ results: [result("a", "Sexy sheer top, outdoor portrait", ["portrait", "smile"]), result("used", "Quiet smile", ["portrait"]), result("b", "Barista", ["coffee"]), result("c", "Woman with a quiet smile", ["portrait"])] }), { headers: { "content-type": "application/json" } })
          : new Response(jpeg, { headers: { "content-type": "image/jpeg", "content-length": String(jpeg.length) } }),
      ),
    );
    const res = await findOpenImage(new PathJail(root), { query: "quiet smile portrait", name: "photo-04", mustMatch: ["quiet", "smile"] });
    expect(res.ok).toBe(true);
    expect(res.paths[0]).toBe("public/images/photo-04.jpg");
    const credits = JSON.parse(fs.readFileSync(path.join(root, "src/content/image-credits.json"), "utf8")) as Array<{ title: string }>;
    expect(credits.at(-1)!.title).toBe("Woman with a quiet smile");
  });
});
