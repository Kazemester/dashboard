import React, { useEffect, useRef } from 'react';

/*
 * Pins its children (the category rail and the dock) to the visible screen. iOS lays out position: fixed
 * against the layout viewport, so after a pinch zoom — or when Safari leaves the visual viewport offset after
 * scrolling / the keyboard — they slide away or grow. This layer follows window.visualViewport and undoes the
 * zoom; the children's position: fixed then resolves against the layer (a transformed ancestor).
 * While the keyboard is up (a text field has focus on a touch screen) the layer hides, as native bars do.
 */
const EDITABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=range]), textarea, select, [contenteditable="true"]';

export default function ScreenLayer({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const s = vv.scale || 1;
      el.style.width = `${vv.width * s}px`;
      el.style.height = `${vv.height * s}px`;
      el.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop}px) scale(${1 / s})`;
    };
    const schedule = () => (frame ||= requestAnimationFrame(place));
    const touch = matchMedia('(pointer: coarse)');
    const keyboard = () => el.classList.toggle('kb-open', touch.matches && Boolean(document.activeElement?.matches?.(EDITABLE)));
    place();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('focusin', keyboard);
    document.addEventListener('focusout', () => setTimeout(keyboard, 50));
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', keyboard);
    };
  }, []);
  return (
    <div ref={ref} className="screen-layer">
      {children}
    </div>
  );
}
