const mathJaxConfig = {
  tex: {
    inlineMath: [['\\(', '\\)'], ['$', '$']],
    displayMath: [['\\[', '\\]'], ['$$', '$$']],
    processEscapes: true,
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
  },
  startup: {
    typeset: false,
  },
};

let loadPromise: Promise<void> | null = null;

export async function ensureMathJaxReady(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.MathJax?.typesetPromise) {
    return;
  }

  if (!loadPromise) {
    window.MathJax = mathJaxConfig;
    loadPromise = import('mathjax-full/es5/tex-chtml.js').then(() => undefined);
  }

  await loadPromise;
}
