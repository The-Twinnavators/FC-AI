/**
 * Planning clean-up of the sample records: picture addresses the planner made up are dropped (they showed broken
 * images), and fields filled with other records' codes show those records' names (ShelfSure's "Items: REG-1003").
 */
import { describe, expect, it } from "vitest";
import { withoutInventedImages, withReadableReferences, type AppModel, type ModelEntity } from "../src/orchestrator/appModel.js";

const entity = (key: string, titleField: string, fields: ModelEntity["fields"]): ModelEntity => ({ key, label: key, plural: `${key}s`, titleField, fields });

const model: AppModel = {
  product: "ShelfSure",
  roles: ["Shopper"],
  nav: [],
  entities: [
    entity("product", "name", [
      { key: "name", label: "Name", type: "text" },
      { key: "image", label: "Image", type: "text" },
    ]),
    entity("regular", "product", [{ key: "product", label: "Product", type: "text" }]),
    entity("list", "name", [
      { key: "name", label: "Name", type: "text" },
      { key: "items", label: "Items", type: "select", options: ["REG-1", "REG-2", "REG-9"] },
    ]),
  ],
  seed: {
    product: [
      { id: "PROD-1", name: "Whole Milk", image: "https://shelfsure.com/images/milk.jpg" },
      { id: "PROD-2", name: "Oat Milk", image: "https://cdn.example.org/oat.png" },
    ],
    regular: [
      { id: "REG-1", product: "PROD-1" },
      { id: "REG-2", product: "PROD-2" },
    ],
    list: [
      { id: "LIST-1", name: "Weekly", items: "REG-2" },
      { id: "LIST-2", name: "Party", items: "REG-9" },
    ],
  },
};

describe("sample record clean-up at planning", () => {
  it("drops invented picture addresses and keeps one the PRD gives", () => {
    const m = withoutInventedImages(model, "Oat milk's picture: https://cdn.example.org/oat.png");
    expect(m.seed.product!.map((r) => r.image)).toEqual(["", "https://cdn.example.org/oat.png"]);
    expect(m.seed.list).toBe(model.seed.list);
  });

  it("shows record names instead of codes, following a code to its name and leaving out codes for missing records", () => {
    const m = withReadableReferences(model);
    expect(m.seed.regular!.map((r) => r.product)).toEqual(["Whole Milk", "Oat Milk"]);
    expect(m.entities.find((e) => e.key === "list")!.fields[1]!.options).toEqual(["Whole Milk", "Oat Milk"]);
    expect(m.seed.list!.map((r) => r.items)).toEqual(["Oat Milk", ""]);
    expect(m.seed.product).toEqual(model.seed.product);
  });
});
