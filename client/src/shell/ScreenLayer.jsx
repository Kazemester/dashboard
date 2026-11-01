import React, { useEffect, useRef } from 'react';

/*
 * Pins its children (the header on phones, the category rail and the dock) to the visible screen. iOS lays out position: fixed
 * against the layout viewport, so after a pinch zoom — or when Safari leaves the visual viewport offset after
 * scrolling / the keyboard — they slide away or grow. This layer follows window.visualViewport and undoes the
 * zoom; the children's position: fixed then resolves against the layer (a transformed ancestor).
 * While the keyboard is up (a text field has focus on a touch screen) the rail and the dock hide, as native bars do.
 */
const EDITABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=range]), textarea, select, [contenteditable="true"]';

export default function ScreenLayer({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    let frame = 0;
    let settle = 0;
    const place = () => {
      frame = 0;
      const s = vv.scale || 1;
      // Not zoomed: plain position: fixed (the CSS default). iOS often leaves visualViewport.height short
      // after the keyboard closes, so its numbers are used only while the page is pinch-zoomed.
      if (Math.abs(s - 1) < 0.01) {
        el.style.width = el.style.height = el.style.transform = '';
        return;
      }
      el.style.width = `${vv.width * s}px`;
      el.style.height = `${vv.height * s}px`;
      el.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop}px) scale(${1 / s})`;
    };
    // a second look shortly after: iOS settles the viewport a moment after the keyboard / a zoom ends
    const schedule = () => {
      frame ||= requestAnimationFrame(place);
      clearTimeout(settle);
      settle = setTimeout(place, 350);
    };
    const touch = matchMedia('(pointer: coarse)');
    const keyboard = () => el.classList.toggle('kb-open', touch.matches && Boolean(document.activeElement?.matches?.(EDITABLE)));
    place();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('focusin', keyboard);
    const blur = () => setTimeout(() => (keyboard(), schedule()), 50);
    document.addEventListener('focusout', blur);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', keyboard);
      document.removeEventListener('focusout', blur);
    };
  }, []);
  return (
    <div ref={ref} className="screen-layer">
      {children}
    </div>
  );
}
