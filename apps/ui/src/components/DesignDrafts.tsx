/**
 * Design drafts in Look and Feel: the proposals FlowCode made (contracts designDrafts.ts), the same screen drawn three
 * ways (or one), each labeled with its direction. Enlarge one to compare them full size; choose one, or choose it to
 * refine it in the studio. "None of these fit" asks what to change and makes a new set from it; earlier sets stay, to
 * compare or go back to. They are proposed designs, not screenshots of a built app.
 */
import { useMemo, useState } from "react";
import { appearanceTokens, gradientUseCss, LIBRARY_SECTIONS, type DesignDraft, type DraftSet } from "@flowcode/contracts";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Icon } from "./ui";
import { LiveTemplate, TemplateThumb } from "./LiveTemplate";
import { Modal } from "./Modal";

const templateName = (id: string) => LIBRARY_SECTIONS.find((x) => x.id === id)?.name ?? id;

function DraftPicture({ d, big, site }: { d: DesignDraft; big?: boolean; site?: string }) {
  const tokens = useMemo(() => appearanceTokens(d.appearance), [d]);
  const css = useMemo(() => gradientUseCss(d.appearance), [d]);
  return big ? <LiveTemplate id={d.template} title={d.label} tokens={tokens} css={css} device="desktop" site={site ?? "yourapp.com"} reserve={120} /> : <TemplateThumb id={d.template} title={d.label} tokens={tokens} css={css} />;
}

export function DesignDrafts({ sets, chosen, site, busy, error, onChoose, onRevise, children }: { sets: DraftSet[]; chosen?: string; site: string; busy?: string; error?: string; onChoose: (d: DesignDraft, refine: boolean) => void; onRevise: (feedback: string) => void; children?: React.ReactNode }) {
  const [at, setAt] = useState(sets.length - 1);
  const [big, setBig] = useState<number>();
  const [none, setNone] = useState(false);
  const [feedback, setFeedback] = useState("");
  const set = sets[Math.min(at, sets.length - 1)];
  if (!set) return null;
  const shown = big !== undefined ? set.drafts[big] : undefined;
  return (
    <section className="dsd" aria-labelledby="dsd-title">
      <header className="dsd__head">
        <div>
          <h2 id="dsd-title" className="dsd__title">{set.drafts.length > 1 ? "Three design drafts" : "A design proposal"}</h2>
          <p className="dsd__basis">{set.basis}</p>
        </div>
        {sets.length > 1 ? (
          <div className="ls-seg" role="radiogroup" aria-label="Draft sets">
            {sets.map((s, i) => (
              <button key={s.id} type="button" role="radio" aria-checked={i === at} className={i === at ? "is-on" : ""} title={s.feedback ? `From: "${s.feedback}"` : "The first set"} onClick={() => (setAt(i), setBig(undefined))}>
                Set {i + 1}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <ul className={`dsd__grid dsd__grid--${set.drafts.length}`}>
        {set.drafts.map((d, i) => (
          <li key={d.id} className={`dsd-card${d.id === chosen ? " is-chosen" : ""}`}>
            <button type="button" className="dsd-card__pic" onClick={() => setBig(i)} aria-label={`Enlarge ${d.label}`}>
              <DraftPicture d={d} />
              <span className="dsd-card__tag">Proposed design</span>
              <span className="dsd-card__zoom" aria-hidden="true"><Maximize2 size={14} strokeWidth={1.8} /></span>
            </button>
            <div className="dsd-card__body">
              <strong className="dsd-card__label">
                {d.label}
                {d.id === chosen ? <span className="dsd-card__on">Chosen</span> : null}
              </strong>
              <p className="dsd-card__why">{d.why}</p>
              <div className="dsd-card__actions">
                <button type="button" className="btn btn--primary btn--sm" disabled={!!busy} onClick={() => onChoose(d, false)}>Choose this design</button>
                <button type="button" className="btn btn--sm" disabled={!!busy} onClick={() => onChoose(d, true)}>Refine this design</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {set.unread?.length ? <p className="dsd__unread">Couldn't turn into a design change: {set.unread.join(", ")}. Say it another way, or add it to your notes for the build.</p> : null}

      <div className="dsd__none">
        {none ? (
          <form
            className="dsd__revise"
            onSubmit={(e) => {
              e.preventDefault();
              if (!feedback.trim()) return;
              onRevise(feedback.trim());
              setFeedback("");
              setNone(false);
              setAt(sets.length);
            }}
          >
            <label htmlFor="dsd-feedback" className="dsd__revise-k">Describe what you want to change</label>
            <textarea id="dsd-feedback" className="ls-ask__input dsd__revise-input" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="e.g. darker and calmer, serif headings, a big photo at the top" autoFocus />
            <div className="dsd__revise-actions">
              <button type="button" className="btn btn--sm" onClick={() => setNone(false)}>Cancel</button>
              <button type="submit" className="btn btn--primary btn--sm" disabled={!feedback.trim() || !!busy}>{busy ?? "Make new drafts"}</button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn--sm" onClick={() => setNone(true)}>None of these fit</button>
        )}
        {error ? <p className="psetup__err" role="alert">{error}</p> : null}
      </div>
      {children ? <div className="dsd__foot">{children}</div> : null}

      {shown ? (
        <Modal onClose={() => setBig(undefined)} labelledBy="dsd-big-title" className="dsd-big">
          <header className="dsd-big__head">
            <button type="button" className="ls-icon-btn" disabled={big === 0} onClick={() => setBig((big ?? 0) - 1)} aria-label="Previous draft"><ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" /></button>
            <div className="dsd-big__name">
              <h2 id="dsd-big-title">{shown.label}</h2>
              <p>{templateName(shown.template)} · proposed design, not a built app</p>
            </div>
            <button type="button" className="ls-icon-btn" disabled={big === set.drafts.length - 1} onClick={() => setBig((big ?? 0) + 1)} aria-label="Next draft"><ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" /></button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => (onChoose(shown, false), setBig(undefined))}>Choose this design</button>
            <button type="button" className="ls-icon-btn" onClick={() => setBig(undefined)} aria-label="Close"><Icon name="x" size={15} /></button>
          </header>
          <DraftPicture d={shown} big site={site} />
        </Modal>
      ) : null}
    </section>
  );
}
