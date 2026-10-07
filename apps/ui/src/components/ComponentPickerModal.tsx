/**
 * ComponentPickerModal - Fullscreen modal for selecting UI components to add (ported from CSSVibes).
 * Shows a tiled grid of available components with descriptions and token chips.
 * Users select multiple components, then click "Add" to enable them all.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AppWindow,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleCheckBig,
  CloudUpload,
  Command,
  Ellipsis,
  Film,
  Focus,
  Folder,
  GitCommitHorizontal,
  Image,
  Inbox,
  LayoutGrid,
  List,
  ListChecks,
  Loader,
  Menu,
  MessageSquare,
  MessagesSquare,
  PanelLeft,
  PanelRight,
  SeparatorHorizontal,
  SlidersHorizontal,
  Sparkles,
  Square,
  Table,
  Tag,
  TextCursorInput,
  ToggleLeft,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { COMPONENT_CATALOG, COMPONENT_TIPS, MiniPreview } from "./componentPickerData";

/** CSSVibes' Remix icons, as the closest Lucide icons. */
const ICONS: Record<string, LucideIcon> = {
  "ri-checkbox-blank-line": Square,
  "ri-input-field": TextCursorInput,
  "ri-arrow-down-s-line": ChevronDown,
  "ri-checkbox-circle-line": CircleCheck,
  "ri-toggle-line": ToggleLeft,
  "ri-equalizer-line": SlidersHorizontal,
  "ri-price-tag-3-line": Tag,
  "ri-upload-cloud-line": CloudUpload,
  "ri-layout-4-line": LayoutGrid,
  "ri-side-bar-line": PanelRight,
  "ri-folder-line": Folder,
  "ri-menu-line": Menu,
  "ri-layout-left-line": PanelLeft,
  "ri-arrow-right-s-line": ChevronRight,
  "ri-more-line": Ellipsis,
  "ri-notification-line": Bell,
  "ri-loader-line": Loader,
  "ri-bookmark-line": Bookmark,
  "ri-window-line": AppWindow,
  "ri-chat-1-line": MessageSquare,
  "ri-focus-2-line": Focus,
  "ri-table-line": Table,
  "ri-list-check": ListChecks,
  "ri-git-commit-line": GitCommitHorizontal,
  "ri-inbox-line": Inbox,
  "ri-sparkling-line": Sparkles,
  "ri-chat-3-line": MessagesSquare,
  "ri-command-line": Command,
  "ri-user-3-line": User,
  "ri-image-line": Image,
  "ri-separator": SeparatorHorizontal,
  "ri-movie-line": Film,
};
const Ico = ({ name, size = 18 }: { name: string; size?: number }) => {
  const C = ICONS[name] ?? Square;
  return <C size={size} aria-hidden="true" />;
};

const CSS_PROPS: Record<string, string> = { Colors: "background, color", Radius: "border-radius", Shadows: "box-shadow", Motion: "transition", Spacing: "padding, gap", "Border Width": "border-width", "Z-Index": "z-index", Easing: "transition-timing-function", Opacity: "opacity" };

interface ComponentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Catalogue ids already in the design. */
  configured: string[];
  onAdd: (ids: string[]) => void;
  primaryColor: string;
  radiusSm: string;
  radiusMd: string;
}

export function ComponentPickerModal({ isOpen, onClose, configured: added, onAdd, primaryColor, radiusSm, radiusMd }: ComponentPickerModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const look = { primaryColor, radiusSm, radiusMd };

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAdd = useCallback(() => {
    onAdd([...selected]);
    onClose();
    setSelected(new Set());
  }, [selected, onAdd, onClose]);

  const handleClose = useCallback(() => {
    setSelected(new Set());
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detailId) setDetailId(null);
      else handleClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [isOpen, detailId, handleClose]);

  if (!isOpen) return null;

  const unconfigured = COMPONENT_CATALOG.filter((c) => !added.includes(c.id));
  const configured = COMPONENT_CATALOG.filter((c) => added.includes(c.id));
  const detailComp = detailId ? COMPONENT_CATALOG.find((c) => c.id === detailId) : null;
  const sorted = [...unconfigured].sort((a, b) => a.label.localeCompare(b.label));

  return createPortal(
    <div className="cvp" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cvp__dialog" role="dialog" aria-modal="true" aria-labelledby="cvp-title" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cvp__head">
          <div>
            <h2 id="cvp-title" className="cvp__title">
              Add Components
            </h2>
            <p className="cvp__sub">Select the UI components you want to configure. Each uses your design tokens.</p>
          </div>
          <div className="cvp__head-actions">
            {selected.size > 0 && <span className="cvp__count">{selected.size} selected</span>}
            {/* View mode toggle */}
            <div className="cvp__views">
              <button type="button" onClick={() => setViewMode("card")} className={viewMode === "card" ? "is-on" : ""} aria-label="Card view" aria-pressed={viewMode === "card"}>
                <LayoutGrid size={14} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setViewMode("list")} className={viewMode === "list" ? "is-on" : ""} aria-label="List view" aria-pressed={viewMode === "list"}>
                <List size={14} aria-hidden="true" />
              </button>
            </div>
            <button type="button" onClick={handleClose} className="cvp__close" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="cvp__body">
          {unconfigured.length === 0 ? (
            <div className="cvp__all">
              <CircleCheckBig size={30} aria-hidden="true" />
              <p className="cvp__all-title">All components added!</p>
              <p className="cvp__all-sub">You&apos;ve enabled every available component.</p>
            </div>
          ) : (
            <>
              {/* Already configured */}
              {configured.length > 0 && (
                <div className="cvp__added">
                  <p className="cvp__eyebrow">Already Added</p>
                  <div className="cvp__added-list">
                    {configured.map((comp) => (
                      <span key={comp.id} className="cvp__added-item">
                        <Ico name={comp.icon} size={12} />
                        {comp.label}
                        <Check size={12} className="cvp__ok" aria-hidden="true" />
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Available components */}
              {viewMode === "card" ? (
                /* ── Card grid ── */
                <div className="cvp__grid">
                  {sorted.map((comp) => {
                    const isSelected = selected.has(comp.id);
                    return (
                      <button key={comp.id} type="button" onClick={() => toggle(comp.id)} className={`cvp__card${isSelected ? " is-selected" : ""}`} aria-pressed={isSelected}>
                        {/* Animated preview — slides in on hover */}
                        <div className="cvp__card-preview">
                          <MiniPreview id={comp.id} animated {...look} />
                        </div>
                        {/* Icon */}
                        <div className="cvp__icon">
                          <Ico name={comp.icon} />
                        </div>
                        {/* Label */}
                        <div className="cvp__label-row">
                          <h3 className="cvp__label">{comp.label}</h3>
                          {isSelected && <CircleCheck size={14} className="cvp__tick" aria-hidden="true" />}
                        </div>
                        {/* Description */}
                        <p className="cvp__desc">{comp.description}</p>
                        {/* Token chips */}
                        <div className="cvp__tokens">
                          {comp.tokens.map((token) => (
                            <span key={token} className="cvp__token">
                              {token}
                            </span>
                          ))}
                        </div>
                        {/* View Details */}
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailId(comp.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              e.preventDefault();
                              setDetailId(comp.id);
                            }
                          }}
                          className="cvp__details"
                        >
                          View Details &rarr;
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* ── List view ── */
                <div className="cvp__list">
                  {sorted.map((comp) => {
                    const isSelected = selected.has(comp.id);
                    return (
                      <button key={comp.id} type="button" onClick={() => toggle(comp.id)} className={`cvp__row${isSelected ? " is-selected" : ""}`} aria-pressed={isSelected}>
                        {/* Checkbox indicator */}
                        <div className="cvp__check">{isSelected && <Check size={10} aria-hidden="true" />}</div>
                        {/* Icon */}
                        <div className="cvp__icon cvp__icon--sm">
                          <Ico name={comp.icon} size={16} />
                        </div>
                        {/* Label + description */}
                        <div className="cvp__row-text">
                          <p className="cvp__label">{comp.label}</p>
                          <p className="cvp__row-desc">{comp.description}</p>
                        </div>
                        {/* Token chips — hidden on small screens */}
                        <div className="cvp__tokens cvp__row-tokens">
                          {comp.tokens.map((token) => (
                            <span key={token} className="cvp__token">
                              {token}
                            </span>
                          ))}
                        </div>
                        {/* View Details */}
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailId(comp.id);
                          }}
                          className="cvp__details cvp__row-details"
                        >
                          Details
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="cvp__foot">
          <button type="button" onClick={handleClose} className="cvp__cancel">
            Cancel
          </button>
          <button type="button" onClick={handleAdd} disabled={selected.size === 0} className="cvp__add">
            {selected.size > 0 ? `Add ${selected.size} Component${selected.size > 1 ? "s" : ""}` : "Select Components"}
          </button>
        </div>

        {/* ── Detail Popup Overlay ── */}
        {detailComp && (
          <div className="cvp__detail-veil" onClick={() => setDetailId(null)}>
            <div className="cvp__detail" role="dialog" aria-modal="true" aria-labelledby="cvp-detail-title" onClick={(e) => e.stopPropagation()}>
              {/* Detail Header */}
              <div className="cvp__detail-head">
                <div className="cvp__detail-name">
                  <div className="cvp__icon cvp__icon--lg">
                    <Ico name={detailComp.icon} size={20} />
                  </div>
                  <h3 id="cvp-detail-title">{detailComp.label}</h3>
                </div>
                <button type="button" onClick={() => setDetailId(null)} className="cvp__close" aria-label="Close details">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="cvp__detail-body">
                {/* Description */}
                <div>
                  <p className="cvp__eyebrow">Description</p>
                  <p className="cvp__detail-text">{detailComp.description}</p>
                </div>

                {/* Example Output */}
                <div>
                  <p className="cvp__eyebrow">Example Output</p>
                  <MiniPreview id={detailComp.id} {...look} />
                </div>

                {/* Quick Tips */}
                {COMPONENT_TIPS[detailComp.id] && (
                  <div>
                    <p className="cvp__eyebrow">Quick Tips</p>
                    <ul className="cvp__tips">
                      {COMPONENT_TIPS[detailComp.id].map((tip, i) => (
                        <li key={i}>
                          <span className="cvp__bullet">&#8226;</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tokens Used */}
                <div>
                  <p className="cvp__eyebrow">Tokens Used</p>
                  <div className="cvp__tokens">
                    {detailComp.tokens.map((token) => (
                      <span key={token} className="cvp__token cvp__token--brand">
                        {token}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CSS Properties hint */}
                <div>
                  <p className="cvp__eyebrow">CSS Properties</p>
                  <p className="cvp__mono">{detailComp.tokens.map((t) => CSS_PROPS[t] || t.toLowerCase()).join(", ")}</p>
                </div>
              </div>

              {/* Detail Footer */}
              <div className="cvp__detail-foot">
                <button type="button" onClick={() => setDetailId(null)} className="cvp__cancel">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggle(detailComp.id);
                    setDetailId(null);
                  }}
                  className="cvp__add cvp__add--sm"
                >
                  {selected.has(detailComp.id) ? "Deselect Component" : "Select Component"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
