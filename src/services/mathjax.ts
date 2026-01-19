const mathJaxConfig = {
  tex: {
    inlineMath: [['\\(', '\\)'], ['$', '$']],
    displayMath: [['\\[', '\\]'], ['$$', '$$']],
    processEscapes: true
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
  },
  startup: {
    typeset: false
  }
};

let loadPromise: Promise<void> | null = null;

export const ensureMathJaxReady = async () => {
  if (typeof window === 'undefined') return;

  const existing = (window as any).MathJax;
  if (existing?.typesetPromise) return;

  if (!loadPromise) {
    (window as any).MathJax = mathJaxConfig;
    loadPromise = import('mathjax-full/es5/tex-chtml.js').then(() => undefined);
  }

  await loadPromise;
};
