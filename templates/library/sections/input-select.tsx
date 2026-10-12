/** @flowcode-library input-select · Selects (classic) (Forms)
 * Catalog ID: c.combobox@classic (component version)
 * Version of: c.combobox
 * Function: A custom listbox select with type-ahead, arrow keys and Escape, a native select styled to match, and a searchable select that filters as you type.
 * Use it as: import { Combobox, Select } from "./dropdowns-states"; <Combobox version="classic" variant?="listbox"|"search" options={[{ value, label, detail?, avatar?: { name } }]} placeholder? emptyText? invalid? describedBy? value? onChange? />; <Select version="classic" options={["A","B"]} placeholder? />  // c.select@classic is the matching native select
 * Look: A bordered button with a chevron that opens a list whose options carry a small initial-letter chip, a name and a muted detail line; the search version has a magnifier at the left and narrows as you type; the native select is drawn to match.
 * Tokens: --color-surface --color-border --color-border-strong --color-accent --color-text-muted --color-danger --radius-md --space-2 --space-3 --focus-ring
 * Use cases: country picker; category select; searchable dropdown; form selects; timezone picker; assignee picker; settings options
 * Jobs to be done: pick an option from a long list; find my option by typing; choose a category for my item
 * Keywords: select, dropdown, listbox, combobox, searchable select, type-ahead, native select
 */
/**
 * Input: selects. This is c.combobox@classic (and c.select@classic) with this piece's sample content; the
 * implementation lives in the component, in ./dropdowns-states. Three ways to pick from a list: a custom select (a
 * button that opens a listbox; arrow keys, Home, End, type a letter to jump, Enter to pick, Escape to close), a native
 * select styled to match it, and a searchable select that filters as you type and says when nothing matches. A save
 * button checks a choice was made. Use the native one by default and the custom or searchable ones when options need
 * detail or the list is long. Make it the app's own: replace SAMPLE with the real options.
 */
import { ClassicSelects } from "./dropdowns-states";

// flowcode:sample
const SAMPLE = {
  title: "Book a session",
  lede: "Pick a teacher, a room and the class you're joining.",
  teacher: {
    label: "Teacher",
    placeholder: "Choose a teacher",
    options: [
      { id: "ana", label: "Ana Ferreira", meta: "Wheel and glazing" },
      { id: "ben", label: "Ben Okafor", meta: "Hand building" },
      { id: "cleo", label: "Cleo Marsh", meta: "Beginners" },
      { id: "dev", label: "Dev Patel", meta: "Raku firing" },
      { id: "erin", label: "Erin Walsh", meta: "Sculpture" },
    ],
  },
  room: {
    label: "Room",
    placeholder: "Choose a room",
    options: ["Front studio", "Kiln room", "Garden shed", "Upstairs loft"],
  },
  klass: {
    label: "Class",
    placeholder: "Search classes",
    empty: "No classes match. Try a shorter word.",
    options: [
      "Beginners wheel, Monday 6pm",
      "Beginners wheel, Wednesday 10am",
      "Hand building, Tuesday 7pm",
      "Glazing workshop, Thursday 6pm",
      "Raku evening, Friday 7pm",
      "Family clay, Saturday 10am",
      "Sculpture club, Saturday 2pm",
      "Open studio, Sunday 11am",
    ],
  },
  submit: "Save booking",
  required: (what: string) => `Choose a ${what.toLowerCase()}.`,
  done: "Booking saved. We've added it to your calendar on this device.",
};

export default function InputSelect() {
  return <ClassicSelects {...SAMPLE} />;
}
