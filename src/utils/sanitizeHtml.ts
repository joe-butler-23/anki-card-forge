import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'b', 'i', 'em', 'strong', 'code', 'pre', 'sup', 'sub',
  'br', 'hr', 'p', 'div', 'span', 'ul', 'ol', 'li'
];

export const sanitizeCardHtml = (html: string) => DOMPurify.sanitize(html, {
  ALLOWED_TAGS,
  ALLOWED_ATTR: []
});
