/**
 * Copy from a user click, including opaque-origin sandboxed panes where the
 * asynchronous Clipboard API is unavailable. The selection fallback runs before
 * any await to retain user activation. Never reads the clipboard or widens grants.
 */
export async function copyText(
  text: string,
  container: HTMLElement,
): Promise<boolean> {
  const previous = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.setAttribute("aria-label", "Text to copy");
  field.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
  container.append(field);
  let copied = false;
  try {
    field.focus({ preventScroll: true });
    field.select();
    copied = document.execCommand("copy");
  } catch {
    // Some runtimes disallow legacy selection copy; try the modern API next.
  } finally {
    if (previous instanceof HTMLElement && previous.isConnected)
      previous.focus({ preventScroll: true });
    field.remove();
  }
  if (copied) return true;
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
