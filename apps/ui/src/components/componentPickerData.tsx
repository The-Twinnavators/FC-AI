/**
 * The "Add components" picker, ported from CSSVibes' ComponentPickerModal (copy, tips, previews and animations
 * unchanged). Previews draw in the app's accent colour and corner radius. The catalogue lists CSSVibes' components;
 * the ones FlowCode's starter kit already has also show in the design sheet, and every pick is passed to the builder.
 */
import React from "react";
import { Inbox } from "lucide-react";

export interface CatalogItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  tokens: string[];
}

export const COMPONENT_CATALOG: CatalogItem[] = [
  // ── Inputs & Forms ──
  { id: 'buttons', label: 'Buttons', icon: 'ri-checkbox-blank-line', description: 'Primary, secondary, tertiary, and destructive button variants with hover, active, and disabled states.', tokens: ['Colors', 'Radius', 'Shadows', 'Motion'] },
  { id: 'text-fields', label: 'Text Fields', icon: 'ri-input-field', description: 'Text inputs and textareas with outlined, filled, and underlined variants plus validation states.', tokens: ['Colors', 'Radius', 'Border Width', 'Spacing'] },
  { id: 'dropdowns', label: 'Dropdowns', icon: 'ri-arrow-down-s-line', description: 'Select menus and combo boxes with configurable trigger, menu, and option styling.', tokens: ['Colors', 'Radius', 'Border Width', 'Shadows'] },
  { id: 'checkboxes-radios', label: 'Checkboxes & Radios', icon: 'ri-checkbox-circle-line', description: 'Selection controls - checkboxes for multiple choices, radios for single selection.', tokens: ['Colors', 'Radius', 'Border Width'] },
  { id: 'switches', label: 'Switches', icon: 'ri-toggle-line', description: 'Toggle switches for on/off settings with track and thumb styling.', tokens: ['Colors', 'Radius', 'Motion'] },
  { id: 'sliders', label: 'Sliders', icon: 'ri-equalizer-line', description: 'Range inputs with configurable track, thumb, and tick mark styling for continuous value selection.', tokens: ['Colors', 'Radius', 'Spacing'] },
  { id: 'chips-tags', label: 'Chips & Tags', icon: 'ri-price-tag-3-line', description: 'Compact elements for filters, selections, and metadata display with dismiss actions.', tokens: ['Colors', 'Radius', 'Spacing'] },
  { id: 'file-upload', label: 'File Upload', icon: 'ri-upload-cloud-line', description: 'Dropzone and file input styling with drag-and-drop states and progress indication.', tokens: ['Colors', 'Radius', 'Border Width', 'Spacing'] },

  // ── Content Containers ──
  { id: 'cards', label: 'Cards', icon: 'ri-layout-4-line', description: 'Content containers for blog posts, products, stats, and profiles with configurable elevation.', tokens: ['Colors', 'Radius', 'Shadows', 'Spacing'] },
  { id: 'panels-drawers', label: 'Panels & Drawers', icon: 'ri-side-bar-line', description: 'Side sheets and slide-out panels for secondary content and detail views.', tokens: ['Colors', 'Shadows', 'Motion', 'Z-Index'] },

  // ── Navigation & Structure ──
  { id: 'tabs', label: 'Tabs', icon: 'ri-folder-line', description: 'Navigation tabs in underline, pills, and enclosed variants for organizing sections.', tokens: ['Colors', 'Radius', 'Spacing', 'Motion'] },
  { id: 'top-nav', label: 'Top Nav / App Bar', icon: 'ri-menu-line', description: 'Primary navigation bar with logo, links, and actions. Sticky positioning with shadow.', tokens: ['Colors', 'Shadows', 'Spacing', 'Z-Index'] },
  { id: 'sidebar-nav', label: 'Sidebar / Drawer', icon: 'ri-layout-left-line', description: 'Vertical navigation sidebar with collapsible sections and active states.', tokens: ['Colors', 'Spacing', 'Motion'] },
  { id: 'breadcrumbs', label: 'Breadcrumbs', icon: 'ri-arrow-right-s-line', description: 'Hierarchical navigation trail showing the user\'s current location in the app.', tokens: ['Colors', 'Spacing'] },
  { id: 'pagination', label: 'Pagination', icon: 'ri-more-line', description: 'Page navigation controls for lists, tables, and galleries.', tokens: ['Colors', 'Radius', 'Spacing'] },

  // ── Feedback & Status ──
  { id: 'alerts-tooltips', label: 'Alerts & Tooltips', icon: 'ri-notification-line', description: 'Toast notifications, inline alerts, banners, and contextual tooltips.', tokens: ['Colors', 'Radius', 'Shadows', 'Motion'] },
  { id: 'progress', label: 'Progress Indicators', icon: 'ri-loader-line', description: 'Progress bars, spinners, and skeleton loaders for loading and processing states.', tokens: ['Colors', 'Radius', 'Motion'] },
  { id: 'badges', label: 'Badges & Status', icon: 'ri-bookmark-line', description: 'Status pills, notification badges, and count indicators for state communication.', tokens: ['Colors', 'Radius', 'Spacing'] },

  // ── Overlays & Focus ──
  { id: 'modals', label: 'Modals & Dialogs', icon: 'ri-window-line', description: 'Overlay dialogs for confirmations, forms, and critical decision points.', tokens: ['Colors', 'Radius', 'Shadows', 'Motion', 'Z-Index'] },
  { id: 'popovers', label: 'Popovers & Menus', icon: 'ri-chat-1-line', description: 'Contextual menus, dropdown panels, and floating content containers.', tokens: ['Colors', 'Radius', 'Shadows', 'Z-Index'] },
  { id: 'focus-rings', label: 'Focus Rings', icon: 'ri-focus-2-line', description: 'Keyboard focus indicators for accessibility - thickness, color, offset, and radius.', tokens: ['Colors', 'Radius', 'Border Width'] },

  // ── Lists, Tables & Data ──
  { id: 'tables', label: 'Tables', icon: 'ri-table-line', description: 'Data table styling with headers, zebra striping, borders, and row states.', tokens: ['Colors', 'Border Width', 'Spacing'] },
  { id: 'lists', label: 'Lists', icon: 'ri-list-check', description: 'List item rows with separators, hover/active states, and typography.', tokens: ['Colors', 'Spacing', 'Border Width'] },

  // ── Navigation Helpers ──
  { id: 'steppers', label: 'Steppers & Wizards', icon: 'ri-git-commit-line', description: 'Multi-step flow indicators with step numbers, connectors, and progress states.', tokens: ['Colors', 'Spacing', 'Motion'] },
  { id: 'empty-states', label: 'Empty States', icon: 'ri-inbox-line', description: 'Placeholder views for empty pages, no results, and onboarding screens.', tokens: ['Colors', 'Spacing'] },

  // ── AI & System ──
  { id: 'ai-indicators', label: 'AI Indicators', icon: 'ri-sparkling-line', description: 'Special accents, glow effects, and motion patterns for AI-driven UI elements.', tokens: ['Colors', 'Shadows', 'Motion'] },
  { id: 'chat-bubbles', label: 'Chat Bubbles', icon: 'ri-chat-3-line', description: 'Conversational message containers with avatar, timestamp, and bubble styling.', tokens: ['Colors', 'Radius', 'Spacing'] },
  { id: 'command-palette', label: 'Command Palette', icon: 'ri-command-line', description: 'Power-user search surface with result items, keyboard navigation, and highlight colors.', tokens: ['Colors', 'Radius', 'Shadows', 'Z-Index'] },

  // ── Media & Avatars ──
  { id: 'avatars', label: 'Avatars', icon: 'ri-user-3-line', description: 'User identity indicators in multiple sizes and shapes with status badges.', tokens: ['Colors', 'Radius', 'Border Width'] },
  { id: 'media-frames', label: 'Media & Thumbnails', icon: 'ri-image-line', description: 'Image frames, thumbnails, and media containers with aspect ratio presets.', tokens: ['Radius', 'Shadows', 'Border Width'] },

  // ── Icons & Decoration ──
  { id: 'dividers', label: 'Dividers & Rules', icon: 'ri-separator', description: 'Horizontal and vertical separators for section and content division.', tokens: ['Colors', 'Border Width', 'Spacing'] },

  // ── Animation ──
  { id: 'token-animations', label: 'Animations', icon: 'ri-movie-line', description: 'Opt-in CSS keyframe animations - select which presets to include in your export.', tokens: ['Motion', 'Easing'] },
];

/** The starter-kit building block that draws each component in the sheet, where FlowCode has one. */
export const KIT_BLOCK: Record<string, string> = {
  buttons: "ui-btn",
  "text-fields": "ui-field",
  switches: "ui-switch",
  cards: "ui-card",
  tabs: "ui-tabs",
  "alerts-tooltips": "ui-notice",
  progress: "ui-progress",
  badges: "ui-badge",
  tables: "ui-table",
  lists: "ui-settings",
  "empty-states": "ui-empty",
  avatars: "ui-avatar",
  "top-nav": "ui-shell",
};

/* ── Quick tips per component ── */
export const COMPONENT_TIPS: Record<string, string[]> = {
  'buttons': ['Use your brand colors for primary buttons', 'Configure hover/active states for feedback', 'Exported CSS includes all variant classes'],
  'text-fields': ['Outlined, filled, and underlined variants available', 'Validation states use your semantic colors', 'Supports prefix/suffix icon slots'],
  'dropdowns': ['Menu width matches trigger by default', 'Uses your shadow tokens for elevation', 'Supports search and multi-select modes'],
  'checkboxes-radios': ['Colors sync with your primary palette', 'Indeterminate state supported for checkboxes', 'Group layout uses your spacing tokens'],
  'switches': ['Track and thumb colors are independently configurable', 'Motion tokens control the slide animation', 'Includes disabled and loading states'],
  'sliders': ['Track, thumb, and tick marks are all styled', 'Supports range (dual thumb) mode', 'Colors follow your brand palette'],
  'chips-tags': ['Dismiss button inherits icon sizing tokens', 'Outlined and filled variants included', 'Great for filter bars and tag inputs'],
  'file-upload': ['Drag-and-drop zone uses your border tokens', 'Progress indicator included', 'Supports file type and size validation UI'],
  'cards': ['Cards use your shadow and radius tokens', 'Configure padding with spacing tokens', 'Multiple card types: blog, product, stat'],
  'panels-drawers': ['Slide direction is configurable (left/right)', 'Backdrop opacity uses your opacity tokens', 'Z-index tokens control stacking'],
  'tabs': ['Underline, pill, and enclosed variants', 'Active indicator uses your motion tokens', 'Scrollable tabs for overflow content'],
  'top-nav': ['Sticky positioning with shadow on scroll', 'Responsive: collapses to hamburger on mobile', 'Z-index tokens control stacking order'],
  'sidebar-nav': ['Collapsible sections with smooth transitions', 'Active item styling uses your brand color', 'Supports nested navigation groups'],
  'breadcrumbs': ['Separator character is configurable', 'Truncation for deep hierarchies', 'Last item is non-interactive by default'],
  'pagination': ['Page buttons use your radius tokens', 'Supports compact and full layouts', 'Integrates with your color palette'],
  'alerts-tooltips': ['Semantic colors for info/success/warn/error', 'Dismiss animation uses motion tokens', 'Tooltip arrow size is configurable'],
  'progress': ['Linear and circular variants included', 'Skeleton loaders use your radius tokens', 'Indeterminate animation uses motion tokens'],
  'badges': ['Numeric, dot, and text badge types', 'Position offset is configurable', 'Colors map to your semantic palette'],
  'modals': ['Backdrop blur and opacity configurable', 'Entrance animation uses motion tokens', 'Focus trap and scroll lock built in'],
  'popovers': ['Auto-placement avoids viewport edges', 'Arrow inherits container background', 'Shadows provide floating elevation'],
  'focus-rings': ['Ring color defaults to your primary hue', 'Offset and width are token-driven', 'Critical for keyboard accessibility'],
  'tables': ['Zebra striping uses alternating row colors', 'Sticky header option available', 'Border tokens control grid lines'],
  'lists': ['Divider lines use your border tokens', 'Hover and active states included', 'Supports leading icons and trailing actions'],
  'steppers': ['Connector line uses your border tokens', 'Completed steps get a check icon', 'Horizontal and vertical layouts'],
  'empty-states': ['Illustration area supports custom SVGs', 'CTA button uses your button tokens', 'Text hierarchy follows your typography'],
  'ai-indicators': ['Glow effect uses your shadow tokens', 'Shimmer animation is motion-token driven', 'Special accent colors for AI elements'],
  'chat-bubbles': ['Sent vs received use different colors', 'Radius tokens shape the bubble corners', 'Timestamp and avatar slots included'],
  'command-palette': ['Search highlight uses your accent color', 'Shadow tokens create floating effect', 'Keyboard shortcut hints included'],
  'avatars': ['Circular and rounded-square shapes', 'Fallback initials use your typography', 'Status badge position is configurable'],
  'media-frames': ['Aspect ratio presets: 1:1, 4:3, 16:9', 'Border radius from your shape tokens', 'Hover overlay uses your opacity tokens'],
  'dividers': ['Horizontal and vertical orientations', 'Thickness uses your border-width tokens', 'Supports label-in-divider pattern'],
  'token-animations': ['Pick only the animations you need', 'Duration and easing are token-driven', 'Includes entrance, exit, and attention seekers'],
};

/* ── Mini preview per component ── */
export function MiniPreview({ id, animated, primaryColor, radiusSm, radiusMd }: { id: string; animated?: boolean; primaryColor: string; radiusSm: string; radiusMd: string }) {
  /* ── Static previews ── */
  const previews: Record<string, React.ReactNode> = {
    'buttons': (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ background: primaryColor, color: '#fff', padding: '5px 14px', borderRadius: radiusSm, fontSize: 11, fontWeight: 600 }}>Primary</span>
        <span style={{ border: `1.5px solid ${primaryColor}`, color: primaryColor, padding: '4px 12px', borderRadius: radiusSm, fontSize: 11, fontWeight: 600 }}>Secondary</span>
      </div>
    ),
    'text-fields': (
      <div style={{ border: '1.5px solid #d4d4d8', borderRadius: radiusSm, padding: '6px 10px', fontSize: 11, color: '#a1a1aa', width: 160 }}>Enter your name...</div>
    ),
    'dropdowns': (
      <div style={{ border: '1.5px solid #d4d4d8', borderRadius: radiusSm, padding: '6px 10px', fontSize: 11, color: '#52525b', width: 140, display: 'flex', justifyContent: 'space-between' }}>
        <span>Select...</span><span style={{ color: '#a1a1aa' }}>&#9662;</span>
      </div>
    ),
    'cards': (
      <div style={{ border: '1px solid #e4e4e7', borderRadius: radiusMd, padding: 10, width: 140, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ background: '#f4f4f5', borderRadius: 4, height: 32, marginBottom: 6 }} />
        <div style={{ height: 4, background: '#d4d4d8', borderRadius: 2, marginBottom: 4, width: '80%' }} />
        <div style={{ height: 4, background: '#e4e4e7', borderRadius: 2, width: '60%' }} />
      </div>
    ),
    'tabs': (
      <div style={{ display: 'flex', gap: 12,  borderBottom: '2px solid #e4e4e7', paddingBottom: 4, fontSize: 11 }}>
        <span style={{ color: primaryColor, fontWeight: 600, borderBottom: `2px solid ${primaryColor}`, paddingBottom: 4, marginBottom: -6 }}>Tab 1</span>
        <span style={{ color: '#a1a1aa' }}>Tab 2</span>
        <span style={{ color: '#a1a1aa' }}>Tab 3</span>
      </div>
    ),
    'checkboxes-radios': (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: primaryColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9 }}>&#10003;</span> Option</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${primaryColor}`, display: 'inline-block' }} /> Radio</span>
      </div>
    ),
    'switches': (
      <div style={{ width: 36, height: 20, borderRadius: 10, background: primaryColor, position: 'relative' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, right: 2, boxShadow: '0 1px 2px rgba(0,0,0,.15)' }} />
      </div>
    ),
    'alerts-tooltips': (
      <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: radiusSm, padding: '5px 10px', fontSize: 10, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>&#9888;</span> Warning message
      </div>
    ),
    'progress': (
      <div style={{ width: 120, height: 6, background: '#e4e4e7', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: '65%', height: '100%', background: primaryColor, borderRadius: 3 }} />
      </div>
    ),
    'badges': (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ background: primaryColor, color: '#fff', fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>New</span>
        <span style={{ background: '#dcfce7', color: '#166534', fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Active</span>
      </div>
    ),
    'modals': (
      <div style={{ border: '1px solid #e4e4e7', borderRadius: radiusMd, padding: 8, width: 130, boxShadow: '0 4px 12px rgba(0,0,0,.1)', background: '#fff' }}>
        <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}>Confirm?</div>
        <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, marginBottom: 6, width: '90%' }} />
        <div style={{ display: 'flex', gap: 4 }}><span style={{ background: primaryColor, color: '#fff', fontSize: 8, padding: '2px 8px', borderRadius: 4 }}>OK</span><span style={{ border: '1px solid #d4d4d8', fontSize: 8, padding: '2px 8px', borderRadius: 4 }}>Cancel</span></div>
      </div>
    ),
    'avatars': (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: primaryColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>A</div>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#71717a' }}>B</div>
      </div>
    ),
    'tables': (
      <div style={{ border: '1px solid #e4e4e7', borderRadius: 4, overflow: 'hidden', fontSize: 9, width: 150 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f4f4f5', padding: '3px 6px', fontWeight: 600, color: '#52525b' }}><span>Name</span><span>Role</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '3px 6px', borderTop: '1px solid #e4e4e7', color: '#71717a' }}><span>Alice</span><span>Admin</span></div>
      </div>
    ),
    'sliders': (
      <div style={{ width: 130, padding: '8px 0' }}>
        <div style={{ position: 'relative', height: 6, background: '#e4e4e7', borderRadius: 3 }}>
          <div style={{ position: 'absolute', left: 0, width: '45%', height: '100%', background: primaryColor, borderRadius: 3 }} />
          <div style={{ position: 'absolute', left: 'calc(45% - 7px)', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: primaryColor, boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
        </div>
      </div>
    ),
    'chips-tags': (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ background: `${primaryColor}20`, border: `1px solid ${primaryColor}50`, color: primaryColor, fontSize: 10, padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Design <span>✕</span></span>
        <span style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', color: '#52525b', fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>React</span>
      </div>
    ),
    'file-upload': (
      <div style={{ border: '1.5px dashed #d4d4d8', borderRadius: radiusSm, padding: '8px 12px', textAlign: 'center', fontSize: 10, color: '#a1a1aa', width: 130 }}>
        <div style={{ fontSize: 16, marginBottom: 2 }}>⬆</div>
        Drop files here
      </div>
    ),
    'panels-drawers': (
      <div style={{ position: 'relative', width: 140, height: 50, border: '1px solid #e4e4e7', borderRadius: radiusSm, background: '#f9fafb', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 58, background: '#fff', borderLeft: '1.5px solid #e4e4e7', boxShadow: '-4px 0 12px rgba(0,0,0,.06)', padding: 6 }}>
          <div style={{ height: 3, background: '#d4d4d8', borderRadius: 2, marginBottom: 4, width: '80%' }} />
          <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, width: '55%' }} />
        </div>
      </div>
    ),
    'top-nav': (
      <div style={{ width: 150, background: primaryColor, borderRadius: radiusSm, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,255,255,0.35)' }} />
        <div style={{ display: 'flex', gap: 8, flex: 1 }}>
          {[22, 16, 20].map((w, i) => <div key={i} style={{ height: 3, width: w, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />)}
        </div>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
      </div>
    ),
    'sidebar-nav': (
      <div style={{ width: 90, border: '1px solid #e4e4e7', borderRadius: radiusSm, overflow: 'hidden', fontSize: 9 }}>
        <div style={{ padding: '5px 8px', background: `${primaryColor}12`, borderLeft: `2px solid ${primaryColor}` }}>
          <div style={{ height: 3, background: primaryColor, borderRadius: 2, width: '65%' }} />
        </div>
        {[0, 1].map(i => (
          <div key={i} style={{ padding: '5px 8px', borderTop: '1px solid #f4f4f5', borderLeft: '2px solid transparent' }}>
            <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, width: i === 0 ? '75%' : '55%' }} />
          </div>
        ))}
      </div>
    ),
    'breadcrumbs': (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
        <span style={{ color: '#71717a' }}>Home</span>
        <span style={{ color: '#d4d4d8' }}>›</span>
        <span style={{ color: '#71717a' }}>Docs</span>
        <span style={{ color: '#d4d4d8' }}>›</span>
        <span style={{ color: primaryColor, fontWeight: 600 }}>Guide</span>
      </div>
    ),
    'pagination': (
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {['‹', '1', '2', '3', '›'].map((label, i) => (
          <span key={i} style={{ width: 22, height: 22, border: `1px solid ${i === 1 ? primaryColor : '#e4e4e7'}`, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: i === 1 ? 600 : 400, background: i === 1 ? primaryColor : '#fff', color: i === 1 ? '#fff' : '#71717a' }}>
            {label}
          </span>
        ))}
      </div>
    ),
    'popovers': (
      <div style={{ position: 'relative', paddingBottom: 2 }}>
        <div style={{ border: '1px solid #e4e4e7', borderRadius: radiusSm, padding: '6px 10px', fontSize: 10, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,.10)', color: '#52525b', width: 110 }}>
          <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 10 }}>Popover title</div>
          <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, width: '85%' }} />
        </div>
        <div style={{ position: 'absolute', bottom: -6, left: 18, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #e4e4e7' }} />
      </div>
    ),
    'focus-rings': (
      <div style={{ position: 'relative', display: 'inline-block', padding: 3 }}>
        <span style={{ background: '#f4f4f5', border: '1px solid #d4d4d8', borderRadius: radiusSm, padding: '5px 14px', fontSize: 10, color: '#52525b', display: 'inline-block' }}>Button</span>
        <div style={{ position: 'absolute', inset: 0, borderRadius: `calc(${radiusSm} + 2px)`, border: `2px solid ${primaryColor}`, pointerEvents: 'none' }} />
      </div>
    ),
    'lists': (
      <div style={{ width: 140, border: '1px solid #e4e4e7', borderRadius: radiusSm, overflow: 'hidden' }}>
        {['Dashboard', 'Projects', 'Settings'].map((item, i) => (
          <div key={i} style={{ padding: '5px 8px', borderTop: i > 0 ? '1px solid #f4f4f5' : 'none', fontSize: 10, color: i === 0 ? primaryColor : '#52525b', display: 'flex', alignItems: 'center', gap: 6, background: i === 0 ? `${primaryColor}08` : '#fff', fontWeight: i === 0 ? 600 : 400 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: i === 0 ? primaryColor : '#d4d4d8', flexShrink: 0 }} />
            {item}
          </div>
        ))}
      </div>
    ),
    'steppers': (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {[1, 2, 3].map((step, i) => (
          <React.Fragment key={step}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: step <= 2 ? primaryColor : '#e4e4e7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: step <= 2 ? '#fff' : '#a1a1aa', fontWeight: 600, flexShrink: 0 }}>
              {step < 2 ? '✓' : step}
            </div>
            {i < 2 && <div style={{ height: 2, width: 20, background: step < 2 ? primaryColor : '#e4e4e7' }} />}
          </React.Fragment>
        ))}
      </div>
    ),
    'empty-states': (
      <div style={{ textAlign: 'center', width: 120 }}>
        <Inbox size={22} color="#d4d4d8" style={{ display: 'block', marginBottom: 3 }} />
        <div style={{ height: 3, background: '#d4d4d8', borderRadius: 2, width: '65%', margin: '0 auto 3px' }} />
        <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, width: '45%', margin: '0 auto 6px' }} />
        <span style={{ background: primaryColor, color: '#fff', fontSize: 8, padding: '2px 10px', borderRadius: 4 }}>Get started</span>
      </div>
    ),
    'ai-indicators': (
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${primaryColor}, #7C3AED)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, boxShadow: `0 0 10px ${primaryColor}50` }}>✦</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 3, background: `${primaryColor}70`, borderRadius: 2, width: 50 }} />
          <div style={{ height: 3, background: `${primaryColor}35`, borderRadius: 2, width: 34 }} />
        </div>
      </div>
    ),
    'chat-bubbles': (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
        <div style={{ alignSelf: 'flex-end', background: primaryColor, color: '#fff', borderRadius: '10px 10px 2px 10px', padding: '4px 9px', fontSize: 9 }}>Hey there! 👋</div>
        <div style={{ alignSelf: 'flex-start', background: '#f4f4f5', color: '#52525b', borderRadius: '10px 10px 10px 2px', padding: '4px 9px', fontSize: 9 }}>Hello! How can I help?</div>
      </div>
    ),
    'command-palette': (
      <div style={{ border: '1px solid #e4e4e7', borderRadius: radiusSm, overflow: 'hidden', width: 150, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
        <div style={{ padding: '5px 8px', borderBottom: '1px solid #f4f4f5', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: '#a1a1aa', fontSize: 10 }}>⌘</span>
          <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, flex: 1 }} />
        </div>
        {[{w:'80%',hl:true},{w:'62%',hl:false},{w:'72%',hl:false}].map(({w,hl}, i) => (
          <div key={i} style={{ padding: '4px 8px', background: hl ? `${primaryColor}10` : '#fff', borderBottom: i < 2 ? '1px solid #f9fafb' : 'none' }}>
            <div style={{ height: 3, background: hl ? primaryColor : '#e4e4e7', borderRadius: 2, width: w, opacity: hl ? 0.9 : 0.5 }} />
          </div>
        ))}
      </div>
    ),
    'media-frames': (
      <div style={{ display: 'flex', gap: 5 }}>
        <div style={{ width: 55, height: 55, borderRadius: radiusMd, overflow: 'hidden', border: '1px solid #e4e4e7', background: 'linear-gradient(135deg, #f4f4f5, #e4e4e7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#d4d4d8' }}>🖼</div>
        <div style={{ width: 80, height: 46, borderRadius: radiusSm, overflow: 'hidden', border: '1px solid #e4e4e7', background: 'linear-gradient(135deg, #f4f4f5, #e4e4e7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#d4d4d8' }}>▶</div>
      </div>
    ),
    'dividers': (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 140 }}>
        <div style={{ height: 1, background: '#e4e4e7', width: '100%' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ height: 1, background: '#e4e4e7', flex: 1 }} />
          <span style={{ fontSize: 9, color: '#a1a1aa', whiteSpace: 'nowrap' }}>or</span>
          <div style={{ height: 1, background: '#e4e4e7', flex: 1 }} />
        </div>
        <div style={{ height: 2, background: `${primaryColor}40`, width: '100%', borderRadius: 1 }} />
      </div>
    ),
    'token-animations': (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ width: 24, height: 24, borderRadius: 5, background: primaryColor }} />
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${primaryColor}60` }} />
        <div style={{ width: 24, height: 24, borderRadius: 5, background: `${primaryColor}30`, transform: 'rotate(45deg)' }} />
      </div>
    ),
  };

  /* ── Animated previews (shown on hover) ── */
  const animatedPreviews: Record<string, React.ReactNode> = {
    'buttons': (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ background: primaryColor, color: '#fff', padding: '5px 14px', borderRadius: radiusSm, fontSize: 11, fontWeight: 600, display: 'inline-block', animation: 'btnPulse 1.6s ease-in-out infinite' }}>Primary</span>
        <span style={{ border: `1.5px solid ${primaryColor}`, color: primaryColor, padding: '4px 12px', borderRadius: radiusSm, fontSize: 11, fontWeight: 600 }}>Secondary</span>
      </div>
    ),
    'text-fields': (
      <div style={{ border: `1.5px solid ${primaryColor}`, borderRadius: radiusSm, padding: '6px 10px', fontSize: 11, color: '#52525b', width: 160, display: 'flex', alignItems: 'center', gap: 1 }}>
        <span>Type here</span>
        <span style={{ display: 'inline-block', width: 1.5, height: 13, background: '#52525b', marginLeft: 1, animation: 'cursorBlink 1s step-end infinite' }} />
      </div>
    ),
    'dropdowns': (
      <div style={{ border: '1.5px solid #d4d4d8', borderRadius: radiusSm, padding: '6px 10px', fontSize: 11, color: '#52525b', width: 140, display: 'flex', justifyContent: 'space-between' }}>
        <span>Select...</span>
        <span style={{ color: '#a1a1aa', display: 'inline-block', animation: 'chevronBob 1.4s ease-in-out infinite' }}>&#9662;</span>
      </div>
    ),
    'switches': (
      <div style={{ width: 36, height: 20, borderRadius: 10, background: primaryColor, position: 'relative' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: 2, boxShadow: '0 1px 2px rgba(0,0,0,.15)', animation: 'switchThumb 1.8s ease-in-out infinite' }} />
      </div>
    ),
    'progress': (
      <div style={{ width: 120, height: 6, background: '#e4e4e7', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: primaryColor, borderRadius: 3, animation: 'progressFill 2.4s ease-in-out infinite' }} />
      </div>
    ),
    'tabs': (
      <div style={{ position: 'relative', borderBottom: '2px solid #e4e4e7', paddingBottom: 6, fontSize: 11, display: 'flex', gap: 14 }}>
        <span style={{ color: '#a1a1aa' }}>Tab 1</span>
        <span style={{ color: '#a1a1aa' }}>Tab 2</span>
        <span style={{ color: '#a1a1aa' }}>Tab 3</span>
        <div style={{ position: 'absolute', bottom: -2, height: 2, background: primaryColor, width: 30, animation: 'tabUnderlineSlide 2.8s ease-in-out infinite' }} />
      </div>
    ),
    'checkboxes-radios': (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: primaryColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, animation: 'checkPop 1.8s ease-in-out infinite' }}>&#10003;</span>
          Option
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${primaryColor}`, display: 'inline-block' }} /> Radio
        </span>
      </div>
    ),
    'cards': (
      <div style={{ border: '1px solid #e4e4e7', borderRadius: radiusMd, padding: 10, width: 140, animation: 'shadowFloat 2s ease-in-out infinite' }}>
        <div style={{ background: '#f4f4f5', borderRadius: 4, height: 32, marginBottom: 6 }} />
        <div style={{ height: 4, background: '#d4d4d8', borderRadius: 2, marginBottom: 4, width: '80%' }} />
        <div style={{ height: 4, background: '#e4e4e7', borderRadius: 2, width: '60%' }} />
      </div>
    ),
    'badges': (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ background: primaryColor, color: '#fff', fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 600, display: 'inline-block', animation: 'badgePop 1.6s ease-in-out infinite' }}>New</span>
        <span style={{ background: '#dcfce7', color: '#166534', fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Active</span>
      </div>
    ),
    'alerts-tooltips': (
      <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: radiusSm, padding: '5px 10px', fontSize: 10, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6, animation: 'alertBounce 2.6s ease-in-out infinite' }}>
        <span>&#9888;</span> Warning message
      </div>
    ),
    'modals': (
      <div style={{ border: '1px solid #e4e4e7', borderRadius: radiusMd, padding: 8, width: 130, background: '#fff', animation: 'modalFloat 2.2s ease-in-out infinite' }}>
        <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}>Confirm?</div>
        <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, marginBottom: 6, width: '90%' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ background: primaryColor, color: '#fff', fontSize: 8, padding: '2px 8px', borderRadius: 4 }}>OK</span>
          <span style={{ border: '1px solid #d4d4d8', fontSize: 8, padding: '2px 8px', borderRadius: 4 }}>Cancel</span>
        </div>
      </div>
    ),
    'avatars': (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: primaryColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, animation: 'avatarRing 1.8s ease-in-out infinite' }}>A</div>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#71717a' }}>B</div>
      </div>
    ),
    'tables': (
      <div style={{ border: '1px solid #e4e4e7', borderRadius: 4, overflow: 'hidden', fontSize: 9, width: 150 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f4f4f5', padding: '3px 6px', fontWeight: 600, color: '#52525b' }}><span>Name</span><span>Role</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '3px 6px', borderTop: '1px solid #e4e4e7', color: '#71717a', animation: 'rowHighlight 2s ease-in-out infinite' }}><span>Alice</span><span>Admin</span></div>
      </div>
    ),
    'sliders': (
      <div style={{ width: 130, padding: '8px 0' }}>
        <div style={{ position: 'relative', height: 6, background: '#e4e4e7', borderRadius: 3 }}>
          <div style={{ position: 'absolute', left: 0, height: '100%', background: primaryColor, borderRadius: 3, animation: 'sliderFill 2.4s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: primaryColor, boxShadow: '0 1px 3px rgba(0,0,0,.25)', animation: 'sliderThumb 2.4s ease-in-out infinite' }} />
        </div>
      </div>
    ),
    'chips-tags': (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ background: `${primaryColor}20`, border: `1px solid ${primaryColor}50`, color: primaryColor, fontSize: 10, padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 3, animation: 'chipPop 1.8s ease-in-out infinite' }}>Design <span>✕</span></span>
        <span style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', color: '#52525b', fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>React</span>
      </div>
    ),
    'file-upload': (
      <div style={{ border: `1.5px dashed ${primaryColor}`, borderRadius: radiusSm, padding: '8px 12px', textAlign: 'center', fontSize: 10, color: primaryColor, width: 130 }}>
        <div style={{ fontSize: 16, marginBottom: 2, display: 'inline-block', animation: 'uploadBounce 1.6s ease-in-out infinite' }}>⬆</div>
        <div>Drop files here</div>
      </div>
    ),
    'panels-drawers': (
      <div style={{ position: 'relative', width: 140, height: 50, border: '1px solid #e4e4e7', borderRadius: radiusSm, background: '#f9fafb', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, background: '#fff', borderLeft: '1.5px solid #e4e4e7', boxShadow: '-4px 0 12px rgba(0,0,0,.06)', padding: 6, animation: 'drawerSlide 2.6s ease-in-out infinite' }}>
          <div style={{ height: 3, background: '#d4d4d8', borderRadius: 2, marginBottom: 4, width: 40 }} />
          <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, width: 28 }} />
        </div>
      </div>
    ),
    'top-nav': (
      <div style={{ width: 150, background: primaryColor, borderRadius: radiusSm, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, animation: 'navShadow 2s ease-in-out infinite' }}>
        <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,255,255,0.35)' }} />
        <div style={{ display: 'flex', gap: 8, flex: 1 }}>
          {[22, 16, 20].map((w, i) => <div key={i} style={{ height: 3, width: w, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />)}
        </div>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
      </div>
    ),
    'sidebar-nav': (
      <div style={{ width: 90, border: '1px solid #e4e4e7', borderRadius: radiusSm, overflow: 'hidden', fontSize: 9 }}>
        <div style={{ padding: '5px 8px', borderLeft: `2px solid ${primaryColor}`, animation: 'navItemGlow 2s ease-in-out infinite' }}>
          <div style={{ height: 3, background: primaryColor, borderRadius: 2, width: '65%' }} />
        </div>
        {[0, 1].map(i => (
          <div key={i} style={{ padding: '5px 8px', borderTop: '1px solid #f4f4f5', borderLeft: '2px solid transparent' }}>
            <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, width: i === 0 ? '75%' : '55%' }} />
          </div>
        ))}
      </div>
    ),
    'breadcrumbs': (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
        <span style={{ color: '#71717a' }}>Home</span>
        <span style={{ color: '#d4d4d8' }}>›</span>
        <span style={{ color: '#71717a' }}>Docs</span>
        <span style={{ color: '#d4d4d8' }}>›</span>
        <span style={{ color: primaryColor, fontWeight: 600, display: 'inline-block', animation: 'crumbPulse 1.8s ease-in-out infinite' }}>Guide</span>
      </div>
    ),
    'pagination': (
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {['‹', '1', '2', '3', '›'].map((label, i) => (
          <span key={i} style={{ width: 22, height: 22, border: `1px solid ${i === 2 ? primaryColor : '#e4e4e7'}`, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: i === 2 ? 600 : 400, background: i === 2 ? primaryColor : '#fff', color: i === 2 ? '#fff' : '#71717a', ...(i === 2 ? { animation: 'pageActive 2s ease-in-out infinite' } : {}) }}>
            {label}
          </span>
        ))}
      </div>
    ),
    'popovers': (
      <div style={{ position: 'relative', paddingBottom: 2 }}>
        <div style={{ border: '1px solid #e4e4e7', borderRadius: radiusSm, padding: '6px 10px', fontSize: 10, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,.10)', color: '#52525b', width: 110, animation: 'popoverFloat 2.4s ease-in-out infinite' }}>
          <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 10 }}>Popover title</div>
          <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, width: '85%' }} />
        </div>
        <div style={{ position: 'absolute', bottom: -6, left: 18, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #e4e4e7' }} />
      </div>
    ),
    'focus-rings': (
      <div style={{ position: 'relative', display: 'inline-block', padding: 3 }}>
        <span style={{ background: '#f4f4f5', border: '1px solid #d4d4d8', borderRadius: radiusSm, padding: '5px 14px', fontSize: 10, color: '#52525b', display: 'inline-block' }}>Button</span>
        <div style={{ position: 'absolute', inset: 0, borderRadius: `calc(${radiusSm} + 2px)`, border: `2px solid ${primaryColor}`, pointerEvents: 'none', animation: 'focusRingPulse 1.8s ease-in-out infinite' }} />
      </div>
    ),
    'lists': (
      <div style={{ width: 140, border: '1px solid #e4e4e7', borderRadius: radiusSm, overflow: 'hidden' }}>
        {['Dashboard', 'Projects', 'Settings'].map((item, i) => (
          <div key={i} style={{ padding: '5px 8px', borderTop: i > 0 ? '1px solid #f4f4f5' : 'none', fontSize: 10, color: i === 0 ? primaryColor : '#52525b', display: 'flex', alignItems: 'center', gap: 6, background: i === 0 ? `${primaryColor}08` : '#fff', fontWeight: i === 0 ? 600 : 400 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: i === 0 ? primaryColor : '#d4d4d8', flexShrink: 0, ...(i === 0 ? { animation: 'dotPulse 1.6s ease-in-out infinite' } : {}) }} />
            {item}
          </div>
        ))}
      </div>
    ),
    'steppers': (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {[1, 2, 3].map((step, i) => (
          <React.Fragment key={step}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: step <= 2 ? primaryColor : '#e4e4e7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: step <= 2 ? '#fff' : '#a1a1aa', fontWeight: 600, flexShrink: 0, ...(step === 2 ? { animation: 'stepPop 2s ease-in-out infinite' } : {}) }}>
              {step < 2 ? '✓' : step}
            </div>
            {i < 2 && <div style={{ height: 2, width: 20, background: step < 2 ? primaryColor : '#e4e4e7' }} />}
          </React.Fragment>
        ))}
      </div>
    ),
    'empty-states': (
      <div style={{ textAlign: 'center', width: 120 }}>
        <Inbox size={22} color="#d4d4d8" style={{ display: 'inline-block', marginBottom: 3, animation: 'emptyIconBounce 1.8s ease-in-out infinite' }} />
        <div style={{ height: 3, background: '#d4d4d8', borderRadius: 2, width: '65%', margin: '0 auto 3px' }} />
        <div style={{ height: 3, background: '#e4e4e7', borderRadius: 2, width: '45%', margin: '0 auto 6px' }} />
        <span style={{ background: primaryColor, color: '#fff', fontSize: 8, padding: '2px 10px', borderRadius: 4, display: 'inline-block', animation: 'btnPulse 2s ease-in-out 0.4s infinite' }}>Get started</span>
      </div>
    ),
    'ai-indicators': (
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${primaryColor}, #7C3AED)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, animation: 'aiGlow 1.8s ease-in-out infinite' }}>✦</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 3, background: `${primaryColor}70`, borderRadius: 2, width: 50, animation: 'shimmerLine 1.8s ease-in-out infinite' }} />
          <div style={{ height: 3, background: `${primaryColor}35`, borderRadius: 2, width: 34, animation: 'shimmerLine 1.8s ease-in-out 0.35s infinite' }} />
        </div>
      </div>
    ),
    'chat-bubbles': (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
        <div style={{ alignSelf: 'flex-end', background: primaryColor, color: '#fff', borderRadius: '10px 10px 2px 10px', padding: '4px 9px', fontSize: 9 }}>Hey there! 👋</div>
        <div style={{ alignSelf: 'flex-start', background: '#f4f4f5', color: '#52525b', borderRadius: '10px 10px 10px 2px', padding: '5px 9px', fontSize: 9, display: 'flex', gap: 3, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#a1a1aa', display: 'inline-block', animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite` }} />
          ))}
        </div>
      </div>
    ),
    'command-palette': (
      <div style={{ border: '1px solid #e4e4e7', borderRadius: radiusSm, overflow: 'hidden', width: 150, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
        <div style={{ padding: '5px 8px', borderBottom: '1px solid #f4f4f5', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: '#a1a1aa', fontSize: 10 }}>⌘</span>
          <div style={{ height: 3, background: primaryColor, borderRadius: 2, flex: 1, animation: 'cmdTyping 2s ease-in-out infinite' }} />
        </div>
        {[{ w: '80%', hl: true }, { w: '62%', hl: false }, { w: '72%', hl: false }].map(({ w, hl }, i) => (
          <div key={i} style={{ padding: '4px 8px', background: hl ? `${primaryColor}10` : '#fff', borderBottom: i < 2 ? '1px solid #f9fafb' : 'none' }}>
            <div style={{ height: 3, background: hl ? primaryColor : '#e4e4e7', borderRadius: 2, width: w, opacity: hl ? 0.9 : 0.5 }} />
          </div>
        ))}
      </div>
    ),
    'media-frames': (
      <div style={{ display: 'flex', gap: 5 }}>
        <div style={{ width: 55, height: 55, borderRadius: radiusMd, overflow: 'hidden', border: '1px solid #e4e4e7', background: 'linear-gradient(135deg, #f4f4f5, #e4e4e7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#d4d4d8' }}>🖼</div>
        <div style={{ width: 80, height: 46, borderRadius: radiusSm, overflow: 'hidden', border: '1px solid #e4e4e7', background: 'linear-gradient(135deg, #f4f4f5, #e4e4e7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: primaryColor, animation: 'mediaPlayPulse 1.8s ease-in-out infinite' }}>▶</div>
      </div>
    ),
    'dividers': (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 140 }}>
        <div style={{ height: 1, background: '#e4e4e7', width: '100%' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ height: 1, background: '#e4e4e7', flex: 1 }} />
          <span style={{ fontSize: 9, color: '#a1a1aa', whiteSpace: 'nowrap' }}>or</span>
          <div style={{ height: 1, background: '#e4e4e7', flex: 1 }} />
        </div>
        <div style={{ height: 2, background: primaryColor, width: '100%', borderRadius: 1, animation: 'dividerGlow 2s ease-in-out infinite' }} />
      </div>
    ),
    'token-animations': (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ width: 24, height: 24, borderRadius: 5, background: primaryColor, animation: 'tokenBounce 1.4s ease-in-out infinite' }} />
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${primaryColor}60`, animation: 'tokenBounce 1.4s ease-in-out 0.2s infinite' }} />
        <div style={{ width: 24, height: 24, borderRadius: 5, background: `${primaryColor}30`, animation: 'tokenSpin 1.8s linear infinite' }} />
      </div>
    ),
  };

  const node = animated ? (animatedPreviews[id] ?? previews[id]) : previews[id];
  return <div className="cvp-preview">{node ?? <span className="cvp-preview__none">Preview not available</span>}</div>;
}
