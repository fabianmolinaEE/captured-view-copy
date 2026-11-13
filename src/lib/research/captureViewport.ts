import type { CaptureController } from "./capture";
import type { Session } from "./types";

export function checkoutRegion(
  rect: DOMRect,
  width: number,
  height: number,
): Session["capture_region"] {
  if (
    ![rect.left, rect.top, rect.right, rect.bottom, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return undefined;
  const left = Math.max(0, rect.left),
    top = Math.max(0, rect.top);
  const right = Math.min(width, rect.right),
    bottom = Math.min(height, rect.bottom);
  if (right <= left || bottom <= top) return undefined;
  return {
    x: left / width,
    y: top / height,
    width: (right - left) / width,
    height: (bottom - top) / height,
  };
}

/** Browser share UI can resize the viewport at startup. Keep capture running and revalidate the crop. */
export function watchCaptureViewport(
  element: HTMLElement,
  controller: Pick<CaptureController, "setRegion" | "invalidateRegion" | "elapsed">,
  onAdjusted: () => void,
) {
  let width = window.innerWidth,
    height = window.innerHeight;
  let settle: ReturnType<typeof setTimeout> | undefined;
  const measure = (validFromMs: number) => {
    const region = checkoutRegion(
      element.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
    );
    if (region) controller.setRegion(region, validFromMs);
    else controller.invalidateRegion();
    return !!region;
  };
  measure(0);
  const resized = () => {
    if (width === window.innerWidth && height === window.innerHeight) return;
    width = window.innerWidth;
    height = window.innerHeight;
    controller.invalidateRegion();
    clearTimeout(settle);
    settle = setTimeout(() => {
      if (measure(controller.elapsed())) onAdjusted();
    }, 250);
  };
  window.addEventListener("resize", resized);
  return () => {
    window.removeEventListener("resize", resized);
    clearTimeout(settle);
  };
}
