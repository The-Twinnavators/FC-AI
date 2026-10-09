/** Settings → Start page: the page FlowCode opens on, chosen from the side navigation's pages (saved for this browser). */
import { useState } from "react";
import { NAV_GROUPS, readStartPage, saveStartPage } from "../nav";
import { navigate } from "../router";
import { Icon } from "./ui";

export function StartPageSettings() {
  const [start, setStart] = useState(readStartPage);
  const choose = (path: string) => {
    setStart(path);
    saveStartPage(path);
  };
  const label = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.path === start)?.label ?? "Dashboard";
  return (
    <section className="section" aria-labelledby="start-title">
      <div className="section__head">
        <h2 className="section__title" id="start-title">
          Start page
        </h2>
      </div>
      <div className="section__body appear">
        <div className="appear__pages-head">
          <p className="appear__note">
            FlowCode opens on <strong>{label}</strong> when you start it. The logo and Dashboard in the navigation still go to the Dashboard.
          </p>
          <button type="button" className="btn btn--sm" onClick={() => navigate(start)}>
            Open {label}
          </button>
        </div>
        <div className="startpage" role="radiogroup" aria-labelledby="start-title" data-cp="start-pages">
          {NAV_GROUPS.map((g, gi) => (
            <div key={g.label ?? gi} className="startpage__group">
              {g.label ? <p className="startpage__heading">{g.label}</p> : null}
              <ul className="appear__list">
                {g.items.map((i) => (
                  <li key={i.path} className="appear__row">
                    <label className="startpage__row">
                      <input type="radio" name="start-page" value={i.path} checked={start === i.path} onChange={() => choose(i.path)} />
                      <Icon name={i.icon} size={16} />
                      <span className="appear__page">{i.label}</span>
                      {start === i.path ? <span className="startpage__tag">Opens here</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
