/**
 * Shortens a text to a maximum length, with an ellipsis at the end.
 * @param {string} text - The text to shorten
 * @param {number} max - The maximum length
 * @returns {string} The text, at most max characters long
 */
export function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
