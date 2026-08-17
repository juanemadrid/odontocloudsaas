/**
 * Global guard for date inputs (type="date").
 * Automatically sets max="9999-12-31" and min="1900-01-01" if missing,
 * and restricts manual year input to 4 digits maximum to avoid 5-digit years (e.g. 29999).
 */

if (typeof window !== 'undefined') {
  const enforceFourDigitYear = (element) => {
    if (element && element.tagName === 'INPUT' && element.type === 'date') {
      if (!element.hasAttribute('max')) {
        element.setAttribute('max', '9999-12-31');
      }
      if (!element.hasAttribute('min')) {
        element.setAttribute('min', '1900-01-01');
      }
    }
  };

  // Enforce attributes on focus/click
  document.addEventListener('focusin', (e) => {
    enforceFourDigitYear(e.target);
  }, true);

  document.addEventListener('click', (e) => {
    enforceFourDigitYear(e.target);
  }, true);

  // Sanitize any typed or pasted value exceeding 4 digits in year
  document.addEventListener('input', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'date') {
      enforceFourDigitYear(e.target);
      const val = e.target.value;
      if (val) {
        const parts = val.split('-');
        if (parts[0] && parts[0].length > 4) {
          parts[0] = parts[0].slice(0, 4);
          e.target.value = parts.join('-');
        }
      }
    }
  }, true);

  // Observe dynamically added date inputs to set max/min proactively
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.tagName === 'INPUT' && node.type === 'date') {
              enforceFourDigitYear(node);
            }
            if (node.querySelectorAll) {
              const dateInputs = node.querySelectorAll('input[type="date" max="9999-12-31" min="1900-01-01"]');
              dateInputs.forEach(enforceFourDigitYear);
            }
          }
        });
      });
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }
}
