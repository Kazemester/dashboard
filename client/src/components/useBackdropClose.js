import { useRef } from 'react';

// Close a dialog only on a real click on its backdrop. A plain onClick also fires when a press starts
// inside the dialog (e.g. selecting text in a field) and the button is released over the backdrop.
export default function useBackdropClose(onClose) {
  const downOnBackdrop = useRef(false);
  return {
    onMouseDown: (e) => {
      downOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e) => {
      if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
      downOnBackdrop.current = false;
    },
  };
}
