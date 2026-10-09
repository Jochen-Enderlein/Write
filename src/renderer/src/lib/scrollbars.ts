/**
 * Marks the page with `classic-scrollbars` when macOS shows scroll bars that take up room
 * ("Show scroll bars: Always", or a mouse attached). Only then does the app style them; with
 * overlay scroll bars the native ones fade in and out by themselves and stay as they are.
 */
function measure(): void {
  const root = document.documentElement
  // Measure the native bar: styled ones always take room
  root.classList.remove('classic-scrollbars')
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;top:-999px;width:50px;height:50px;overflow:scroll'
  document.body.appendChild(probe)
  const classic = probe.offsetWidth - probe.clientWidth > 0
  probe.remove()
  root.classList.toggle('classic-scrollbars', classic)
}

/** The setting (or the mouse) can change while the app runs; check again on focus. */
export function watchScrollbars(): void {
  measure()
  window.addEventListener('focus', measure)
}
