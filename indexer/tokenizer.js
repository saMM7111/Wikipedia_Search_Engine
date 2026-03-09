"use strict";

const STOP_WORDS = require("./stopwords");

function stem(word) {
  if (word.length <= 2) return word;

  if (word.endsWith("sses")) word = word.slice(0, -2);
  else if (word.endsWith("ies")) word = word.slice(0, -2);
  else if (word.endsWith("ss")) { /* keep */ }
  else if (word.endsWith("s") && word.length > 3) word = word.slice(0, -1);

  if (word.endsWith("eed")) {
    if (word.length > 4) word = word.slice(0, -1);
  } else if (word.endsWith("ing") && word.length > 5) {
    word = word.slice(0, -3);
    if (word.endsWith("at") || word.endsWith("bl") || word.endsWith("iz")) word += "e";
  } else if (word.endsWith("ed") && word.length > 4) {
    word = word.slice(0, -2);
    if (word.endsWith("at") || word.endsWith("bl") || word.endsWith("iz")) word += "e";
  }

  const step2map = {
    ational: "ate", tional: "tion", enci: "ence", anci: "ance",
    izer: "ize", iser: "ise", alism: "al", ness: "", ment: "",
    fulness: "ful", ousness: "ous", iveness: "ive", ization: "ize",
  };
  for (const [suf, rep] of Object.entries(step2map)) {
    if (word.endsWith(suf) && word.length > suf.length + 2) {
      word = word.slice(0, -suf.length) + rep;
      break;
    }
  }

  if (word.endsWith("e") && word.length > 4) word = word.slice(0, -1);

  return word;
}

/**
 * @param {string} text
 * @returns {string[]} 
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s*-\s*/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem);
}

function tokenizeWithOriginals(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map((t) => ({ original: t, stem: stem(t) }));
}

module.exports = { tokenize, tokenizeWithOriginals, stem };