/**
 * The look-up pieces' sample: children's books and the libraries near you that hold them, in three ZIP code areas.
 * Shared by the look-up specimens (catalog, entry page, place finder, list builder), so a like, a rating or a list made
 * on one shows on all of them. Not food on purpose: the pieces work for any "find it and where to get it" app.
 * Written for FlowCode.
 */
import { createStore, type AppSchema, type RecordData } from "./app-data";
import { createLookup, type LookupConfig, type LookupSeed } from "./lookup-data";

const GENRES = ["Picture books", "Early readers", "Chapter books", "Middle grade", "Graphic novels", "Nonfiction", "Poetry"];
const AGES = ["0-3", "3-5", "5-7", "7-9", "9-12"];

export const LOOKUP_SCHEMA: AppSchema = {
  appKey: "lookup-sample",
  roles: ["Reader"],
  entities: [
    {
      key: "book",
      label: "Book",
      plural: "Books",
      titleField: "title",
      subtitleField: "author",
      idPrefix: "BK",
      fields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "author", label: "Author", type: "text", required: true },
        { key: "genre", label: "Genre", type: "select", options: GENRES, required: true },
        { key: "ages", label: "Ages", type: "select", options: AGES },
        { key: "tags", label: "Themes", type: "text" },
        { key: "summary", label: "About it", type: "longtext" },
        { key: "pages", label: "Pages", type: "number" },
        { key: "published", label: "Published", type: "date" },
        { key: "award", label: "Award", type: "text" },
      ],
    },
    {
      key: "library",
      label: "Library",
      plural: "Libraries",
      titleField: "name",
      subtitleField: "address",
      idPrefix: "LIB",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "address", label: "Address", type: "text" },
        { key: "zip", label: "ZIP code", type: "text" },
        { key: "hours", label: "Hours", type: "text" },
        { key: "phone", label: "Phone", type: "text" },
      ],
    },
  ],
};

export const LOOKUP_CONFIG: LookupConfig = {
  entries: "book",
  places: "library",
  categoryField: "genre",
  placesField: "heldAt",
  placeWord: "library",
  carryWord: "has",
  nearMiles: 8,
  areas: [
    { zip: "94110", label: "San Francisco, CA", lat: 37.7486, lng: -122.4158 },
    { zip: "78704", label: "Austin, TX", lat: 30.2433, lng: -97.7659 },
    { zip: "10025", label: "New York, NY", lat: 40.7986, lng: -73.9667 },
    // No library within 8 miles: the entry page shows the nearest one farther away.
    { zip: "78660", label: "Pflugerville, TX", lat: 30.4394, lng: -97.62 },
  ],
};

const libraries: RecordData[] = [
  { id: "LIB-1001", name: "Mission Bay Branch Library", address: "960 4th St, San Francisco", zip: "94158", lat: 37.7746, lng: -122.3925, hours: "Mon-Sat 10-6", phone: "(415) 555-0141" },
  { id: "LIB-1002", name: "Bernal Heights Branch", address: "500 Cortland Ave, San Francisco", zip: "94110", lat: 37.7393, lng: -122.4153, hours: "Tue-Sun 10-8", phone: "(415) 555-0177" },
  { id: "LIB-1003", name: "Noe Valley Library", address: "451 Jersey St, San Francisco", zip: "94114", lat: 37.7505, lng: -122.4335, hours: "Mon-Sat 10-6", phone: "(415) 555-0108" },
  { id: "LIB-1004", name: "Glen Park Branch", address: "2825 Diamond St, San Francisco", zip: "94131", lat: 37.7338, lng: -122.4339, hours: "Wed-Mon 12-7", phone: "(415) 555-0193" },
  { id: "LIB-1005", name: "Twin Oaks Branch", address: "1800 S 5th St, Austin", zip: "78704", lat: 30.2483, lng: -97.7591, hours: "Mon-Sat 10-8", phone: "(512) 555-0122" },
  { id: "LIB-1006", name: "Ruiz Branch Library", address: "1600 Grove Blvd, Austin", zip: "78741", lat: 30.2253, lng: -97.7135, hours: "Mon-Sat 10-6", phone: "(512) 555-0150" },
  { id: "LIB-1007", name: "Central Library Austin", address: "710 W Cesar Chavez St, Austin", zip: "78701", lat: 30.2659, lng: -97.7514, hours: "Daily 9-9", phone: "(512) 555-0100" },
  { id: "LIB-1008", name: "Manchaca Road Branch", address: "5500 Manchaca Rd, Austin", zip: "78745", lat: 30.2163, lng: -97.7997, hours: "Tue-Sat 10-6", phone: "(512) 555-0164" },
  { id: "LIB-1009", name: "Bloomingdale Library", address: "150 W 100th St, New York", zip: "10025", lat: 40.7963, lng: -73.9681, hours: "Mon-Sat 10-6", phone: "(212) 555-0136" },
  { id: "LIB-1010", name: "St. Agnes Library", address: "444 Amsterdam Ave, New York", zip: "10024", lat: 40.7843, lng: -73.9776, hours: "Mon-Sat 10-7", phone: "(212) 555-0182" },
  { id: "LIB-1011", name: "Morningside Heights Library", address: "2900 Broadway, New York", zip: "10025", lat: 40.8058, lng: -73.9654, hours: "Daily 10-8", phone: "(212) 555-0119" },
  { id: "LIB-1012", name: "Harlem Library", address: "9 W 124th St, New York", zip: "10027", lat: 40.8064, lng: -73.9446, hours: "Mon-Fri 10-6", phone: "(212) 555-0157" },
];

const BOOKS: Array<[string, string, number, number, string, string]> = [
  ["The Lantern Fox", "Mira Okafor", 0, 1, "kindness, night, animals", "A small fox carries a lantern through the woods to light the way home for every lost animal it meets."],
  ["Puddle Jump Day", "Theo Brandt", 0, 0, "weather, play", "Rain boots on, a toddler and a grandpa count every puddle between home and the bakery."],
  ["Goodnight, Harbor", "Ana Sol", 0, 0, "bedtime, boats", "The boats, the gulls and the lighthouse settle down one by one as the harbor goes to sleep."],
  ["Bea Builds a Bridge", "Kofi Mensah", 0, 1, "engineering, friendship", "Bea's bridge keeps falling into the creek until she asks her friends to help her test it."],
  ["Sam and the Big Snow", "Lena Hart", 1, 2, "winter, first reader", "Sam wants to build the biggest snowman on the street. Short sentences for brand-new readers."],
  ["Pip Can Fly", "Jonah Reyes", 1, 2, "birds, courage", "A little bird is scared of the high branch, and then of nothing at all."],
  ["Max Makes Soup", "Priya Raman", 1, 2, "cooking, family", "Max reads the recipe card one word at a time and makes soup for his whole family."],
  ["The Case of the Missing Kite", "Hana Ito", 2, 3, "mystery, friendship", "Two friends follow clues across the park to find who took the class kite."],
  ["Juniper's Garden Club", "Rosa Delgado", 2, 3, "gardening, community", "Juniper starts a club to turn an empty lot into a garden the whole street can share."],
  ["Robo-Dog Saves the Day", "Eli Grant", 2, 3, "robots, humor", "A robot dog that can't stop fetching finally fetches exactly what the town needs."],
  ["The Map of Small Things", "Noor Haddad", 3, 4, "adventure, maps", "Twelve-year-old Lina finds a map that shows every lost thing in her city, and one that isn't a thing at all."],
  ["Starlight Station", "Callum Price", 3, 4, "space, family", "Living on a research station orbiting Mars, Jem has to keep a secret that could send everyone home."],
  ["The Year of Tides", "Imani Brooks", 3, 4, "ocean, grief, friendship", "After her grandmother dies, Tali spends a year on the coast learning the tides and herself."],
  ["Comet & Cat", "Yuki Mori", 4, 3, "space, cats, humor", "A cat accidentally launches herself into orbit and makes friends with a lonely comet."],
  ["Hero Next Door", "Dante Wells", 4, 4, "superheroes, family", "The quiet kid in 4B finds out his neighbor used to be a superhero, and still has the cape."],
  ["Volcanoes Up Close", "Dr. Sara Lind", 5, 3, "science, earth", "Real photographs and simple diagrams show how volcanoes form, erupt and build new land."],
  ["How Bridges Hold Up", "Marcus Ode", 5, 3, "engineering, science", "Arches, beams and cables, explained with experiments you can do with paper and books."],
  ["Bugs of the Backyard", "Lucia Ferro", 5, 2, "insects, nature", "A field guide to 40 insects you can find within a few steps of your back door."],
  ["The Whale Who Sang", "Owen Tate", 6, 1, "ocean, poems", "Short poems about the ocean's creatures, from tiny krill to the biggest whale."],
  ["Morning Songs", "Adaeze Nwosu", 6, 2, "poems, everyday life", "Poems for every part of a school morning, from the alarm clock to the bell."],
];

const books: RecordData[] = BOOKS.map(([title, author, genre, ages, tags, summary], i) => ({
  id: `BK-${1001 + i}`,
  title,
  author,
  genre: GENRES[genre],
  ages: AGES[ages],
  tags,
  summary,
  pages: [32, 32, 40, 48, 64, 64, 72, 112, 128, 96, 288, 312, 264, 160, 176, 64, 72, 96, 48, 56][i],
  published: `20${18 + (i % 8)}-${String((i % 12) + 1).padStart(2, "0")}-15`,
  award: i % 6 === 0 ? "Readers' Choice 2025" : "",
  // Each library holds most books; which ones varies, so availability differs by area and branch.
  heldAt: libraries.filter((_, j) => (i * 7 + j * 3) % 10 < 7).map((l) => l.id),
}));

const seed: LookupSeed = {
  likes: Object.fromEntries(books.map((b, i) => [b.id, 12 + ((i * 37) % 180)])),
  saves: Object.fromEntries(books.map((b, i) => [b.id, 4 + ((i * 23) % 60)])),
  ratings: [
    { entryId: "BK-1001", who: "Dana W.", stars: 5, text: "My four-year-old asks for this every night. The lantern pages are beautiful.", at: "2026-09-28T19:12:00Z", helpful: 14 },
    { entryId: "BK-1001", who: "Marcus T.", stars: 4, text: "Lovely and calm. A little long for my youngest.", at: "2026-09-02T08:40:00Z", helpful: 3 },
    { entryId: "BK-1011", who: "Priya S.", stars: 5, text: "Read it in one weekend. The ending got me.", at: "2026-10-04T15:20:00Z", helpful: 9 },
    { entryId: "BK-1011", who: "Leo K.", stars: 4, text: "Great mystery for 10 to 12. The middle drags a bit.", at: "2026-08-17T12:00:00Z", helpful: 2 },
    { entryId: "BK-1016", who: "Hannah R.", stars: 5, text: "Perfect for our volcano project. Clear and not babyish.", at: "2026-09-21T10:05:00Z", helpful: 6 },
    { entryId: "BK-1008", who: "Sam P.", stars: 3, text: "Fun clues, but the solution was easy to guess.", at: "2026-07-30T17:45:00Z", helpful: 1 },
    { entryId: "BK-1014", who: "Ines M.", stars: 5, text: "We laughed out loud. The comet's jokes are the best part.", at: "2026-10-09T20:10:00Z", helpful: 4 },
  ],
  lists: [
    { id: "LST-1001", name: "Library run Saturday", placeId: "LIB-1002", items: [{ entryId: "BK-1001", qty: 1, done: false }, { entryId: "BK-1005", qty: 1, done: true }, { entryId: "BK-1011", qty: 1, done: false }, { entryId: "BK-1016", qty: 1, done: false }] },
    { id: "LST-1002", name: "Summer reading", placeId: "LIB-1003", items: [{ entryId: "BK-1012", qty: 1, done: false }, { entryId: "BK-1013", qty: 1, done: false }] },
  ],
};

/** The sample's app store and look-up layer. */
export const lookupApp = createStore(LOOKUP_SCHEMA, { book: books, library: libraries }, { user: "Jordan" });
export const sampleLookup = createLookup(lookupApp, LOOKUP_CONFIG, seed);
