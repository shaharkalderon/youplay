import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Where you are in the workspace.
 *
 * A **section** is a top-level destination reached from the sidebar. An **open
 * object** is layered over whichever section you were in, so closing it puts you
 * back exactly where you came from — the list, a tag, a folder, a search — with
 * no need to remember and restore that separately.
 */
export type Section = 'type' | 'tags' | 'search' | 'profile'

/** Marks the history entries this app pushed, and how deep they are. Reading
 *  the depth back out of the event is what makes the system Back button and the
 *  in-app one the same gesture rather than two that can disagree. */
type ObjectHistoryState = { youplayObject?: number }

const depthOf = (state: unknown): number => {
  const depth = (state as ObjectHistoryState | null)?.youplayObject
  return typeof depth === 'number' && depth > 0 ? depth : 0
}

/**
 * The stack of open objects, wired to browser history.
 *
 * A stack rather than a single key because an object page links on to related
 * items: opening three in a row and pressing Back three times should walk back
 * through them, not dump you at the list.
 *
 * Every open pushes a history entry with no URL change, so the phone's back
 * gesture closes the object instead of closing the app — which is the whole
 * reason this is not just a piece of component state. Closing never pops the
 * stack directly; it asks history to go back and lets the one `popstate`
 * handler do it, so both routes through the code end in the same place.
 */
export function useObjectStack() {
  const [stack, setStack] = useState<string[]>([])
  // The callbacks below have to read the current depth without being rebuilt on
  // every change, or every consumer re-renders whenever anything is opened.
  const depth = useRef(0)
  depth.current = stack.length

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const next = depthOf(event.state)
      setStack((current) => (current.length === next ? current : current.slice(0, next)))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = useCallback((key: string) => {
    const next = depth.current + 1
    // Outside the state updater: StrictMode runs updaters twice in development,
    // which would push two entries and take two Backs to undo one open.
    window.history.pushState({ youplayObject: next } satisfies ObjectHistoryState, '')
    depth.current = next
    setStack((current) => [...current, key])
  }, [])

  const close = useCallback(() => {
    if (depth.current > 0) window.history.back()
  }, [])

  /** Leaves every open object at once — what sidebar navigation does. */
  const closeAll = useCallback(() => {
    if (depth.current > 0) window.history.go(-depth.current)
  }, [])

  return { stack, openKey: stack.length > 0 ? stack[stack.length - 1] : null, open, close, closeAll }
}
