/**
 * The sample app the working patterns demo against: vendor contracts, with statuses, a three-step create wizard, two
 * roles and the status changes each may make, and two dozen seeded records. One store, shared, so a contract created in
 * the wizard's preview shows up in the index's. An app replaces all of this with its own schema and seed.
 *
 * Not a screen: the patterns' reference sheets bring it with them. Written for FlowCode.
 */
import { createStore, type AppSchema, type RecordData } from "./app-data";

// flowcode:sample
export const SAMPLE_SCHEMA: AppSchema = {
  appKey: "fl-sample-contracts",
  roles: ["Contract owner", "Manager"],
  entities: [
    {
      key: "contract",
      label: "Contract",
      plural: "Contracts",
      titleField: "name",
      subtitleField: "vendor",
      idPrefix: "CTR",
      statusField: "status",
      statuses: [
        { key: "draft", label: "Draft", tone: "neutral" },
        { key: "review", label: "In review", tone: "info" },
        { key: "active", label: "Active", tone: "success" },
        { key: "expiring", label: "Expiring soon", tone: "warning" },
        { key: "ended", label: "Ended", tone: "danger" },
      ],
      fields: [
        { key: "name", label: "Contract name", type: "text", required: true },
        { key: "vendor", label: "Vendor", type: "text", required: true },
        { key: "category", label: "Category", type: "select", options: ["Software", "Facilities", "Logistics", "Marketing", "Professional services"], required: true },
        { key: "value", label: "Annual value", type: "money", required: true, min: 0, max: 5000000 },
        { key: "start", label: "Start date", type: "date", required: true },
        { key: "end", label: "End date", type: "date", required: true },
        { key: "owner", label: "Owner", type: "text" },
        { key: "risk", label: "Risk", type: "select", options: ["Low", "Medium", "High"] },
        { key: "autoRenew", label: "Renews automatically", type: "boolean" },
        { key: "notes", label: "Notes", type: "longtext", help: "Anything the approver should know." },
      ],
      columns: ["name", "vendor", "category", "value", "end", "status"],
      filters: ["status", "category", "risk"],
      steps: [
        { key: "basics", label: "Basics", fields: ["name", "vendor", "category", "owner"], help: "Who the contract is with and what it covers." },
        { key: "terms", label: "Terms", fields: ["value", "start", "end", "autoRenew"], help: "What it costs and how long it runs." },
        { key: "risk", label: "Risk and notes", fields: ["risk", "notes"], help: "What the approver should weigh." },
      ],
      transitions: [
        { key: "submit", label: "Submit for review", from: ["draft"], to: "review", tone: "primary" },
        { key: "approve", label: "Approve", from: ["review"], to: "active", roles: ["Manager"], tone: "primary" },
        { key: "decline", label: "Send back", from: ["review"], to: "draft", roles: ["Manager"], needsReason: true },
        { key: "end", label: "End contract", from: ["active", "expiring"], to: "ended", needsReason: true, tone: "danger" },
      ],
    },
  ],
};

const VENDORS = ["Northwind Cloud", "Brightline Facilities", "Harbor Freight Co.", "Lumen Creative", "Fairfield Legal", "Atlas Hosting", "Greenleaf Cleaning", "Swift Couriers", "Meridian Analytics", "Oakridge Consulting", "Pioneer Print", "Clearpath Security"];
const WHAT = ["Platform licence", "Office cleaning", "Freight lanes", "Brand refresh", "Contract review", "Hosting", "Building security", "Courier service", "Data warehouse", "Advisory retainer", "Print run", "Support plan"];
const CATS = ["Software", "Facilities", "Logistics", "Marketing", "Professional services", "Software", "Facilities", "Logistics", "Software", "Professional services", "Marketing", "Facilities"];
const OWNERS = ["Ana Reyes", "Sam Okafor", "Lee Park", "Mo Haddad"];
const STATUS = ["active", "active", "review", "expiring", "draft", "active", "ended", "active", "review", "active", "expiring", "active"];

function seedContracts(): RecordData[] {
  const out: RecordData[] = [];
  for (let i = 0; i < 24; i++) {
    const k = i % 12;
    const start = new Date(2025, (i * 2) % 12, 1 + (i % 27));
    const end = new Date(start.getFullYear() + 1 + (i % 2), start.getMonth(), start.getDate());
    out.push({
      id: `CTR-${1001 + i}`,
      name: `${WHAT[k]}${i >= 12 ? " (renewal)" : ""}`,
      vendor: VENDORS[(k + Math.floor(i / 12)) % 12],
      category: CATS[k],
      value: 12000 + ((i * 37919) % 480000),
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      owner: OWNERS[i % 4],
      risk: ["Low", "Medium", "High"][(i * 7) % 3],
      autoRenew: i % 3 === 0,
      status: STATUS[(k + Math.floor(i / 12)) % 12],
      updatedAt: new Date(2026, 8, 1 + (i % 28)).toISOString(),
    });
  }
  return out;
}

export const SAMPLE_SEED = { contract: seedContracts() };

/** The one store every sample shares. */
export const sampleStore = createStore(SAMPLE_SCHEMA, SAMPLE_SEED, { user: "Ana Reyes" });
