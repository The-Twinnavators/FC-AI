/** @flowcode-library input-radio-cards · Radio cards (Forms)
 * Use cases: plan selection; delivery options; shipping method; subscription tier; checkout options; membership choice; service package
 * Jobs to be done: pick the plan that suits me; choose how my order is delivered; compare options with prices; confirm my choice
 * Keywords: radio, radio cards, plan picker, delivery options, fieldset, choice
 */
/**
 * Input: radio cards. Choices shown as cards, each with a title, a short description and a price: one group for a
 * plan and one for delivery, including an option that can't be picked right now. They are real radio buttons in a
 * fieldset, so arrow keys move between them and screen readers announce the group. A summary and a confirm button
 * check that both are chosen. Use it for plans, delivery, time slots or room types. Make it the app's own: replace
 * SAMPLE with the real options and prices.
 */
import { useId, useState, type FormEvent } from "react";
import { Tick } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Set up your veg box",
  lede: "Pick a box size and how you'd like it to arrive. You can change both any week.",
  groups: [
    {
      id: "plan",
      legend: "Box size",
      options: [
        { id: "small", title: "Small box", text: "For one or two. About 6 kinds of veg.", price: "$18", per: "/week", badge: "" },
        { id: "family", title: "Family box", text: "For three to five. About 9 kinds, plus fruit.", price: "$29", per: "/week", badge: "Most chosen" },
        { id: "large", title: "Large box", text: "For big households or batch cooks.", price: "$38", per: "/week", badge: "" },
      ],
      disabled: [] as string[],
      initial: "family",
    },
    {
      id: "delivery",
      legend: "Delivery",
      options: [
        { id: "doorstep", title: "Doorstep, Thursday", text: "Left in a cool bag by 8am.", price: "Free", per: "", badge: "" },
        { id: "pickup", title: "Pick up from the shop", text: "Collect any time Thursday or Friday.", price: "$2 off", per: "", badge: "" },
        { id: "saturday", title: "Saturday morning", text: "Full until next month. Join the waiting list in the shop.", price: "$4", per: "", badge: "Full" },
      ],
      disabled: ["saturday"],
      initial: "",
    },
  ],
  submit: "Confirm box",
  missing: "Choose a delivery option.",
  done: (plan: string, delivery: string) => `All set: ${plan}, ${delivery.toLowerCase()}. Your first box arrives next week.`,
};

export default function InputRadioCards() {
  const d = SAMPLE;
  const uid = useId();
  const [picked, setPicked] = useState<Record<string, string>>(() => Object.fromEntries(d.groups.map((g) => [g.id, g.initial])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    d.groups.forEach((g) => {
      if (!picked[g.id]) next[g.id] = g.id === "delivery" ? d.missing : `Choose a ${g.legend.toLowerCase()}.`;
    });
    setErrors(next);
    if (Object.keys(next).length) {
      setDone("");
      return;
    }
    const title = (gid: string) => d.groups.find((g) => g.id === gid)?.options.find((o) => o.id === picked[gid])?.title ?? "";
    setDone(d.done(title("plan"), title("delivery")));
  }

  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <form className="fl-form" noValidate onSubmit={submit} style={{ gap: "var(--space-7)" }}>
          {d.groups.map((g) => {
            const err = errors[g.id];
            return (
              <fieldset key={g.id} className="fl-in-fieldset" aria-describedby={err ? `${uid}-${g.id}-err` : undefined}>
                <legend>{g.legend}</legend>
                <div className="fl-in-cards">
                  {g.options.map((o) => {
                    const off = g.disabled.includes(o.id);
                    const id = `${uid}-${g.id}-${o.id}`;
                    return (
                      <label key={o.id} htmlFor={id} className={`fl-in-rcard${off ? " fl-in-rcard--disabled" : ""}`}>
                        <input
                          id={id}
                          type="radio"
                          name={`${uid}-${g.id}`}
                          value={o.id}
                          checked={picked[g.id] === o.id}
                          disabled={off}
                          aria-describedby={`${id}-text`}
                          onChange={() => {
                            setPicked((p) => ({ ...p, [g.id]: o.id }));
                            setErrors((er) => ({ ...er, [g.id]: "" }));
                            setDone("");
                          }}
                        />
                        <span className="fl-in-rcard__mark" aria-hidden="true">
                          <Tick />
                        </span>
                        <span className="fl-in-rcard__body">
                          <span className="fl-in-rcard__top">
                            <span className="fl-in-rcard__title">{o.title}</span>
                            {o.badge && <span className="fl-badge">{o.badge}</span>}
                          </span>
                          <span id={`${id}-text`} className="fl-in-rcard__text">
                            {o.text}
                          </span>
                        </span>
                        <span className="fl-in-rcard__price">
                          <strong>{o.price}</strong>
                          {o.per && <span className="fl-meta">{o.per}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {err && (
                  <p id={`${uid}-${g.id}-err`} className="fl-in-error" role="alert">
                    {err}
                  </p>
                )}
              </fieldset>
            );
          })}
          {done && (
            <p className="fl-done" role="status">
              {done}
            </p>
          )}
          <div className="fl-actions">
            <button type="submit" className="fl-btn fl-btn--primary">
              {d.submit}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
