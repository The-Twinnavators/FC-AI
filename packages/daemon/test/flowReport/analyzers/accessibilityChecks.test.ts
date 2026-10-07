// daemon/src/flow-reports/analyzers/__tests__/accessibilityChecks.test.ts
//
// Half of these assert that a check stays quiet. That is deliberate: the
// expensive failure in this report has never been missing a finding, it has
// been producing one that is not true — a gate matching a word rather than a
// thing the code does. An accessibility check is especially prone to it,
// because the evidence is markup and markup is full of near misses.

import { describe, it, expect } from 'vitest'
import { accessibilityChecks, NOT_STATICALLY_CHECKABLE } from '../../../src/flowReport/analyzers/launchChecks.js'

const file = (path: string, text: string) => ({ path, text })
const ids = (files: Array<{ path: string; text: string }>) =>
  accessibilityChecks(files).map((f) => f.id)
const fired = (files: Array<{ path: string; text: string }>, id: string) => ids(files).includes(id)

describe('a control the keyboard cannot reach', () => {
  it('fires on a div with an onClick and nothing else', () => {
    expect(fired([file('a.tsx', '<div onClick={save}>Save</div>')], 'LX-A11Y-001')).toBe(true)
  })

  it('stays quiet when the div carries a role and a tabIndex', () => {
    expect(fired([file('a.tsx',
      '<div role="button" tabIndex={0} onClick={save}>Save</div>')], 'LX-A11Y-001')).toBe(false)
  })

  it('stays quiet for a real button, which is the whole point', () => {
    expect(fired([file('a.tsx', '<button onClick={save}>Save</button>')], 'LX-A11Y-001')).toBe(false)
  })
})

describe('a button with no name', () => {
  it('fires on an icon-only button', () => {
    expect(fired([file('a.tsx', '<button onClick={x}><Trash2 size={11} /></button>')],
      'LX-A11Y-002')).toBe(true)
  })

  it('stays quiet once it has an aria-label', () => {
    expect(fired([file('a.tsx',
      '<button aria-label="Remove this response" onClick={x}><Trash2 /></button>')],
      'LX-A11Y-002')).toBe(false)
  })

  it('stays quiet for a button with visible text', () => {
    expect(fired([file('a.tsx', '<button onClick={x}>Remove</button>')], 'LX-A11Y-002')).toBe(false)
  })
})

describe('fields with no label', () => {
  it('fires when inputs exist and nothing labels them', () => {
    expect(fired([file('a.tsx', '<input type="text" placeholder="Your name" />')],
      'LX-A11Y-003')).toBe(true)
  })

  // Placeholder is not a label, and this is the check that says so.
  it('is not satisfied by a placeholder', () => {
    const only = accessibilityChecks([file('a.tsx', '<input placeholder="Name" />')])
    expect(only.map((f) => f.id)).toContain('LX-A11Y-003')
  })

  it('stays quiet with an htmlFor label', () => {
    expect(fired([file('a.tsx',
      '<label htmlFor="n">Name</label><input id="n" />')], 'LX-A11Y-003')).toBe(false)
  })
})

describe('focus that cannot be seen', () => {
  it('fires when the outline is removed with nothing put back', () => {
    expect(fired([file('a.css', 'button { outline: none; }')], 'LX-A11Y-004')).toBe(true)
  })

  it('stays quiet when focus-visible replaces it', () => {
    expect(fired([file('a.css',
      'button { outline: none; } button:focus-visible { outline: 2px solid blue; }')],
      'LX-A11Y-004')).toBe(false)
  })

  it('stays quiet for a Tailwind focus ring beside the reset', () => {
    expect(fired([file('a.tsx', '<button className="focus:outline-none focus:ring-2" />')],
      'LX-A11Y-004')).toBe(false)
  })
})

describe('tab order', () => {
  it('fires on a positive tabindex', () => {
    expect(fired([file('a.tsx', '<input tabIndex={3} />')], 'LX-A11Y-005')).toBe(true)
  })

  it('stays quiet for 0 and -1, which are the correct uses', () => {
    expect(fired([file('a.tsx', '<div tabIndex={0} /><div tabIndex={-1} />')],
      'LX-A11Y-005')).toBe(false)
  })
})

describe('dialogs', () => {
  const modal = '<Modal open={open}><h2>Confirm</h2></Modal>'

  it('fires when a dialog does not declare itself', () => {
    expect(fired([file('a.tsx', modal)], 'LX-A11Y-006')).toBe(true)
  })

  it('stays quiet once role and aria-modal are there', () => {
    expect(fired([file('a.tsx',
      '<Modal role="dialog" aria-modal="true"><h2>Confirm</h2></Modal>')],
      'LX-A11Y-006')).toBe(false)
  })

  it('fires when nothing marks the control that opens one', () => {
    expect(fired([file('a.tsx', modal)], 'LX-A11Y-007')).toBe(true)
  })

  it('stays quiet with aria-haspopup present', () => {
    expect(fired([file('a.tsx', `${modal}<button aria-haspopup="dialog" />`)],
      'LX-A11Y-007')).toBe(false)
  })

  // No dialog, no finding. A report that invents a dialog to complain about is
  // worse than one that says nothing.
  it('says nothing about dialogs in a file that has none', () => {
    const out = ids([file('a.tsx', '<p>Hello</p>')])
    expect(out).not.toContain('LX-A11Y-006')
    expect(out).not.toContain('LX-A11Y-007')
  })
})

describe('status nobody is told about', () => {
  it('fires when messages are set and nothing announces them', () => {
    expect(fired([file('a.tsx', 'const [e, setError] = useState(); return <p>{e}</p>')],
      'LX-A11Y-008')).toBe(true)
  })

  it('stays quiet with a live region', () => {
    expect(fired([file('a.tsx',
      'const [e, setError] = useState(); return <p role="status">{e}</p>')],
      'LX-A11Y-008')).toBe(false)
  })
})

describe('images', () => {
  it('fires when images carry no alt', () => {
    expect(fired([file('a.tsx', '<img src="/logo.png" />')], 'LX-A11Y-011')).toBe(true)
  })

  it('stays quiet for an empty alt, which is how decoration is marked', () => {
    expect(fired([file('a.tsx', '<img src="/bg.png" alt="" />')], 'LX-A11Y-011')).toBe(false)
  })
})

describe('what it will not look at', () => {
  // The point of the section: a clean accessibility score is not a claim that
  // the product is accessible, and the report has to say which half it read.
  it.each([
    [/3:1/, 'focus indicator contrast'],
    [/moves into a dialog/, 'focus moving into a dialog'],
    [/live region is announced/, 'live region announcement'],
    [/24×24/, 'tap target size'],
    [/400% zoom/, 'reflow at zoom'],
    [/reading order/, 'reading order'],
    [/alt text is any good/, 'alt text quality'],
  ])('records that %s cannot be checked from source', (pattern) => {
    expect(NOT_STATICALLY_CHECKABLE.some((s) => pattern.test(s))).toBe(true)
  })
})

describe('a repository with no interface', () => {
  it('produces nothing rather than passing a product it never saw', () => {
    expect(ids([file('lib/math.ts', 'export const add = (a: number, b: number) => a + b')]))
      .toEqual([])
  })
})

// ── The two false positives this found on a real repository ─────────────────
//
// Both were caught by running the checks over 418 of FlowAgent's own interface
// files and reading what came back, rather than by trusting the patterns.

describe('what it learned from a real codebase', () => {
  it('does not call a stopPropagation wrapper an unreachable control', () => {
    // Not a control. It exists to keep a click from reaching the thing behind
    // it, so there is nothing for a keyboard to reach and nothing to fix.
    expect(fired([file('a.tsx', '<div key={t.id} onClick={(e) => e.stopPropagation()}><Chip /></div>')],
      'LX-A11Y-001')).toBe(false)
  })

  it('still fires on the real thing beside it', () => {
    expect(fired([file('a.tsx',
      '<div ref={stageRef} className="stage" onClick={() => setOpen(true)}>x</div>')],
      'LX-A11Y-001')).toBe(true)
  })

  it.each([
    ['focus:border-violet-500/50', 'a border change'],
    ['focus:shadow-lg', 'a shadow'],
    ['focus:ring-2', 'a ring'],
    ['focus:outline-2', 'a different outline'],
  ])('accepts %s as a focus indicator (%s)', (util) => {
    expect(fired([file('a.tsx', `<input className="focus:outline-none ${util}" />`)],
      'LX-A11Y-004')).toBe(false)
  })

  it('still fires when the outline goes and nothing replaces it', () => {
    expect(fired([file('a.tsx',
      '<textarea className="bg-transparent outline-none resize-none" />')],
      'LX-A11Y-004')).toBe(true)
  })
})
