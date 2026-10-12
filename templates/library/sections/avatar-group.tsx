/** @flowcode-library avatar-group · Avatar group (classic) (Small components)
 * Catalog ID: c.avatar-stack@classic (component version)
 * Version of: c.avatar-stack
 * Function: Initial avatars on theme colors in four sizes with status dots, a stacked group ending in "+5" that expands, and a filterable list of people.
 * Use it as: import { AvatarStack } from "./avatars-variants"; <AvatarStack version="classic" people={[{ name, tone?, status?: "online"|"away"|"busy"|"offline" }]} max?={4} size?={48} label?="Team on the rota" showStatus? statusKey?={[{ id: "busy", label: "Teaching" }]} onMore? expanded? />
 * Look: Larger themed initials discs that overlap, ending in a +N button that opens the full list, with presence dots in four states (online, away, busy, offline) explained by a key.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-success --color-warning --color-danger --color-text-muted --space-3 --text-sm
 * Use cases: team members; collaborators; attendee list; online presence; shared with; project members; participants; assignees
 * Jobs to be done: see who is on the team; check who is online now; see everyone attending; find a specific person
 * Keywords: avatars, team, presence, status, people
 */
/**
 * Avatars: initials on theme colors in four sizes, with status dots, a stacked group that ends in "+5", and the
 * full list of people behind it. This is c.avatar-stack@classic with this piece's sample content; the implementation
 * lives in the component, in ./avatars-variants. Use it to show who is on a team, a booking or a shared list.
 * Make it the app's own: replace SAMPLE with your people (photos can replace the initials) and real presence data.
 */
import { ClassicAvatarGroup, type ClassicAvatarGroupProps } from "./avatars-variants";

// flowcode:sample
const SAMPLE: ClassicAvatarGroupProps = {
  eyebrow: "Studio team",
  title: "Who's in today",
  stackLabel: "Team on the Saturday rota",
  stackShown: 4,
  statuses: [
    { id: "online", label: "In the studio" },
    { id: "away", label: "On a break" },
    { id: "busy", label: "Teaching" },
    { id: "offline", label: "Off today" },
  ],
  people: [
    { name: "Ana Ruiz", role: "Studio lead", status: "busy", tone: "a" },
    { name: "Tom Okafor", role: "Wheel tutor", status: "online", tone: "b" },
    { name: "Mei Lin", role: "Glaze technician", status: "away", tone: "c" },
    { name: "Sam Patel", role: "Front desk", status: "online", tone: "d" },
    { name: "Jo Byrne", role: "Kiln and firing", status: "offline", tone: "e" },
    { name: "Lena Fischer", role: "Kids' club tutor", status: "busy", tone: "a" },
    { name: "Kofi Mensah", role: "Hand-building tutor", status: "offline", tone: "b" },
    { name: "Priya Shah", role: "Shop and orders", status: "online", tone: "c" },
    { name: "Rory Walsh", role: "Weekend assistant", status: "away", tone: "d" },
  ],
  sizes: ["sm", "md", "lg", "xl"],
  emptyText: "No one is in the studio right now.",
};

export default function AvatarGroup() {
  return <ClassicAvatarGroup {...SAMPLE} />;
}
