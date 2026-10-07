/**
 * About FlowCode. One page, one system: sections introduce one idea each, and the pictures are small UI fragments built
 * from FlowCode's own tokens (so they follow light and dark mode), drawn from what the product really shows: the
 * Overview, checks, an approval, a run review, the Screens list, an improvement. Grids are divided by hairlines, not
 * boxed. The full feature list is the separate Feature guide.
 */
import { BadgeCheck, ClipboardList, Eye, FileText, Hammer, Layers, LayoutGrid, Lightbulb, MessageSquareText, Search, ShieldCheck } from "lucide-react";
import { BannerHero, IntroActions as Actions } from "../components/IntroHero";
import { DemoCell } from "../components/AboutFragments";

/* ─── Page content ─── */

const FLOW = [
  { icon: MessageSquareText, title: "Describe the problem", text: "Say what you want to solve in your own words, or bring a PRD you already have." },
  { icon: FileText, title: "Shape the PRD", text: "FlowCode researches the problem with you and writes the requirements down." },
  { icon: ClipboardList, title: "Approve the plan", text: "See the screens, features and tests it will build. Nothing starts until you approve." },
  { icon: Hammer, title: "Watch it build", text: "Local models build one step at a time, and each step is checked before the next." },
  { icon: Search, title: "Review the result", text: "See what changed, what was checked, and anything that couldn't be verified." },
];

const FEATURES = [
  { icon: Eye, lead: "Follow the build.", text: "The Overview says what it's doing, what needs you and how each step went.", demo: "overview" as const },
  { icon: ShieldCheck, lead: "Decide what matters.", text: "Packages, commands and web searches wait for your OK, with the exact action shown.", demo: "approval" as const },
  { icon: BadgeCheck, lead: "Check the work.", text: "Every step is checked before the next starts; every build is reviewed.", demo: "checks" as const },
  { icon: Layers, lead: "See what wasn't verified.", text: "A check that couldn't run is named, never counted as passed.", demo: "review" as const },
  { icon: LayoutGrid, lead: "Design every screen.", text: "Screens without design work of their own, and tabs that overlap, are flagged.", demo: "screens" as const },
  { icon: Lightbulb, lead: "Improve from outcomes.", text: "Proposals are tested on later runs before they count as confirmed.", demo: "improve" as const },
];

// Who FlowCode is for: people building on their own, without a team. The person with the idea first
// (docs/flowcode-ai-opportunities.md: a product owner or designer-founder), then solo developers and vibe coders.
const WHO = [
  { title: "Founders and small-business owners", text: "Turn an idea into an app you can click through and show people, without writing code." },
  { title: "Solo developers and vibe coders", text: "Describe what you want in plain words and get tested, checked code you can keep building on." },
  { title: "Product owners and designers", text: "Set the look and the screens; FlowCode builds to them and checks every screen." },
];

export function AboutView() {
  return (
    <div className="page page-enter ab2">
      <BannerHero dark />

      <section className="ab2__section" aria-labelledby="ab2-how">
        <div className="ab2__head">
          <span className="ab2__eyebrow">How it works</span>
          <h2 className="ab2__h" id="ab2-how">
            From a problem to a reviewed prototype, <span className="ab2__accent">in five steps.</span>
          </h2>
        </div>
        <ol className="ab2__flow">
          {FLOW.map((s, i) => (
            <li key={s.title}>
              <span className="ab2__icon">
                <s.icon size={16} aria-hidden="true" />
              </span>
              <span className="ab2__step">Step {i + 1}</span>
              <strong>{s.title}</strong>
              <span className="ab2__muted">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="ab2__section ab2__section--panel" aria-labelledby="ab2-what">
        <div className="ab2__head">
          <span className="ab2__eyebrow">What you get</span>
          <h2 className="ab2__h" id="ab2-what">
            A builder that shows its work, <span className="ab2__accent">including the gaps.</span>
          </h2>
        </div>
        <ul className="ab2__grid">
          {FEATURES.map((f) => (
            <DemoCell key={f.lead} kind={f.demo}>
              <p className="ab2__cell-text">
                <span className="ab2__icon">
                  <f.icon size={16} aria-hidden="true" />
                </span>
                <strong>{f.lead}</strong> <span className="ab2__muted">{f.text}</span>
              </p>
            </DemoCell>
          ))}
        </ul>
      </section>

      <section className="ab2__section ab2__who" aria-labelledby="ab2-who">
        <div className="ab2__head">
          <span className="ab2__eyebrow">Who it&apos;s for</span>
          <h2 className="ab2__h" id="ab2-who">
            For people with an idea, <span className="ab2__accent">without a team.</span>
          </h2>
          <p className="ab2__lede">FlowCode does the work a small team would: it plans the build, writes and tests the code, and checks the design on every screen. It only stops to ask you when a decision is yours.</p>
        </div>
        <ul className="ab2__who-list">
          {WHO.map((w) => (
            <li key={w.title}>
              <strong>{w.title}</strong>
              <span className="ab2__muted">{w.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ab2__cta" aria-labelledby="ab2-start">
        <h2 className="ab2__h" id="ab2-start">
          Start with what you have.
        </h2>
        <p className="ab2__lede">A PRD, a problem to solve, or an existing project folder.</p>
        <Actions />
        <p className="ab2__fine">
          FlowCode builds prototypes, not production apps; each project&apos;s Launch readiness lists what the real app still needs. The pictures on this page are drawn from what FlowCode shows for the No BIO &amp; GMO project. Looking for something specific? <a href="#/guide">Browse the feature guide</a>.
        </p>
      </section>
    </div>
  );
}
