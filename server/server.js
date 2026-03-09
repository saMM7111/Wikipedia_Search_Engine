"use strict";

const path    = require("path");
const express = require("express");
const axios   = require("axios");
const cheerio = require("cheerio");
const { tokenize } = require("../indexer/tokenizer");

//  BM25 INDEX

class BM25Index {
  constructor({ k1 = 1.5, b = 0.75 } = {}) {
    this.k1 = k1; this.b = b;
    this.docs = new Map(); 
    this.index = new Map(); 
    this.totalTokens = 0;
  }
  get docCount() { return this.docs.size; }
  get avgdl()    { return this.docCount ? this.totalTokens / this.docCount : 1; }

  addDocument(doc) {
    if (this.docs.has(doc.id)) return;
    const tokens = [
      ...tokenize(doc.title.repeat(3)),
      ...tokenize(doc.content),
      ...tokenize((doc.categories || []).join(" ").repeat(2)),
    ];
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [term, freq] of tf) {
      if (!this.index.has(term)) this.index.set(term, new Map());
      this.index.get(term).set(doc.id, freq);
    }
    this.docs.set(doc.id, { doc, tokenCount: tokens.length });
    this.totalTokens += tokens.length;
  }

  _idf(term) {
    const df = this.index.has(term) ? this.index.get(term).size : 0;
    if (df === 0) return 0;
    return Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1);
  }

  _termScore(term, docId, tokenCount) {
    const postings = this.index.get(term);
    if (!postings || !postings.has(docId)) return 0;
    const tf   = postings.get(docId);
    const idf  = this._idf(term);
    const norm = 1 - this.b + this.b * (tokenCount / this.avgdl);
    return idf * (tf * (this.k1 + 1)) / (tf + this.k1 * norm);
  }

  search(queryStr, limit = 10) {
    const terms = tokenize(queryStr);
    if (!terms.length) return [];
    const scores = new Map();
    for (const term of terms) {
      const postings = this.index.get(term);
      if (!postings) continue;
      for (const [docId] of postings) {
        const { tokenCount } = this.docs.get(docId);
        scores.set(docId, (scores.get(docId) || 0) + this._termScore(term, docId, tokenCount));
      }
    }
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([docId, score]) => {
        const { doc } = this.docs.get(docId);
        return { doc, score, snippet: buildSnippet(doc.content, terms) };
      });
  }

  titles() { return [...this.docs.values()].map(({ doc }) => doc.title); }
  stats()  { return { documents: this.docCount, terms: this.index.size, avgdl: Math.round(this.avgdl) }; }
}

//  WIKIPEDIA REAL-TIME FETCHER

const WIKI_API  = "https://en.wikipedia.org/w/api.php";
const WIKI_BASE = "https://en.wikipedia.org/wiki/";

const httpClient = axios.create({
  headers: { "User-Agent": "Searchr/3.0 (educational real-time search)" },
  timeout: 10000,
});

async function wikiSuggest(query, limit = 8) {
  const { data } = await httpClient.get(WIKI_API, {
    params: { action: "opensearch", search: query, limit, format: "json", redirects: "resolve" },
  });
  return data[1] || [];
}

async function fetchWikiArticle(title, id) {
  try {
    const pageUrl = WIKI_BASE + encodeURIComponent(title.replace(/ /g, "_"));
    const { data } = await httpClient.get(pageUrl);
    const $ = cheerio.load(data);
    $(".infobox,.navbox,.reflist,.references,.mw-editsection,.hatnote,.toc,.noprint,sup.reference").remove();
    const cleanTitle = $("#firstHeading").text().trim() || title;
    const paragraphs = [];
    $("#mw-content-text p").each((_, el) => {
      const text = $(el).text().replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
      if (text.length > 40) paragraphs.push(text);
    });
    const content = paragraphs.join(" ").slice(0, 4000);
    const categories = [];
    $("#mw-normal-catlinks li a").each((_, el) => categories.push($(el).text().trim()));
    if (!content || content.length < 80) return null;
    return { id, title: cleanTitle, url: pageUrl, content, categories };
  } catch { return null; }
}

async function realTimeSearch(query, bm25) {
  const titles = await wikiSuggest(query, 10);
  if (!titles.length) return [];
  let nextId = bm25.docCount + 1;
  const articles = (await Promise.all(
    titles.slice(0, 8).map(t => fetchWikiArticle(t, nextId++))
  )).filter(Boolean);
  for (const article of articles) bm25.addDocument(article);
  return bm25.search(query, 10);
}

//  SNIPPET BUILDER

function buildSnippet(content, terms, maxLen = 240) {
  const lower = content.toLowerCase();
  let bestPos = 0, bestHits = 0;
  for (let i = 0; i < lower.length - maxLen; i += 30) {
    const hits = terms.filter(t => lower.slice(i, i + maxLen).includes(t)).length;
    if (hits > bestHits) { bestHits = hits; bestPos = i; }
  }
  let s = content.slice(bestPos, bestPos + maxLen).trim();
  if (bestPos > 0) s = "…" + s;
  if (bestPos + maxLen < content.length) s += "…";
  for (const t of terms) {
    s = s.replace(
      new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*)`, "gi"),
      "<mark>$1</mark>"
    );
  }
  return s;
}

//  EXPRESS APP

const app  = express();
const bm25 = new BM25Index();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const FRONTEND = path.join(__dirname, "../frontend");
app.use(express.static(FRONTEND));

app.get("/api/search", async (req, res) => {
  const query = (req.query.q || "").trim();
  const limit = Math.min(parseInt(req.query.limit) || 10, 30);
  if (!query) return res.json({ error: "Missing ?q= param" });

  try {
    const results = await realTimeSearch(query, bm25);
    res.json({
      query,
      count: results.length,
      results: results.slice(0, limit).map(({ doc, score, snippet }) => ({
        id:         doc.id,
        title:      doc.title,
        url:        doc.url,
        categories: doc.categories,
        snippet,                            
        bm25Score:  parseFloat(score.toFixed(4)),
      })),
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/suggest", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json({ suggestions: [] });
  try {
    const suggestions = await wikiSuggest(q, 8);
    res.json({ prefix: q, suggestions });
  } catch {
    res.json({ prefix: q, suggestions: [] });
  }
});

app.get("/api/stats", (req, res) => {
  res.json({
    index:         bm25.stats(),
    cachedTitles:  bm25.titles().slice(0, 100),
  });
});

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(FRONTEND, "index.html"));
});

if (process.env.RENDER_EXTERNAL_URL) {
  const https = require("https");
  setInterval(() => {
    https.get(process.env.RENDER_EXTERNAL_URL, () => {}).on("error", () => {});
  }, 10 * 60 * 1000);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Search engine server running on http://localhost:${PORT}`);
});

module.exports = app;