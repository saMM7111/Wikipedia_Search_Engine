"use strict";

const axios  = require("axios");
const cheerio = require("cheerio");
const { EventEmitter } = require("events");

const WIKI_BASE = "https://en.wikipedia.org";
const USER_AGENT = "SearchrBot/2.0 (educational search engine; polite crawler)";

class WikiCrawler extends EventEmitter {
  /**
   * @param {object} options
   * @param {string[]} options.seeds       
   * @param {number}  options.maxPages     
   * @param {number}  options.delayMs      
   * @param {number}  options.maxContentLen 
   * @param {boolean} options.followLinks  
   */
  constructor(options = {}) {
    super();
    this.seeds       = options.seeds       || ["JavaScript"];
    this.maxPages    = options.maxPages    || 80;
    this.delayMs     = options.delayMs     || 600;
    this.maxContent  = options.maxContentLen || 3000;
    this.followLinks = options.followLinks !== false;

    this.visited  = new Set();
    this.queue    = [];
    this.docs     = [];
    this.running  = false;
  }

  _titleToUrl(title) {
    return `${WIKI_BASE}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  }

  _extractContent($) {
    $(
      ".infobox, .navbox, .reflist, .references, .mw-editsection, " +
      ".hatnote, .sistersitebox, .noprint, sup.reference, .toc"
    ).remove();

    const paragraphs = [];
    $("#mw-content-text p").each((_, el) => {
      const text = $(el)
        .text()
        .replace(/\[\d+\]/g, "")  
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > 40) paragraphs.push(text);
    });

    return paragraphs.join(" ").slice(0, this.maxContent);
  }

  _extractLinks($) {
    const links = [];
    $("#mw-content-text a[href^='/wiki/']").each((_, el) => {
      const href = $(el).attr("href");
      if (href && !href.includes(":") && !href.includes("#")) {
        links.push(`${WIKI_BASE}${href}`);
      }
    });
    return links;
  }

  _extractCategories($) {
    const cats = [];
    $("#mw-normal-catlinks li a").each((_, el) => {
      cats.push($(el).text().trim());
    });
    return cats;
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async _fetchPage(pageUrl) {
    const { data } = await axios.get(pageUrl, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 10000,
    });
    const $ = cheerio.load(data);

    const title      = $("#firstHeading").text().trim();
    const content    = this._extractContent($);
    const categories = this._extractCategories($);
    const links      = this.followLinks ? this._extractLinks($) : [];

    return { title, content, categories, links };
  }

  async crawl() {
    if (this.running) throw new Error("Crawler already running");
    this.running = true;

    this.queue = this.seeds.map((s) => this._titleToUrl(s));

    while (this.queue.length > 0 && this.docs.length < this.maxPages) {
      const pageUrl = this.queue.shift();
      if (this.visited.has(pageUrl)) continue;
      this.visited.add(pageUrl);

      try {
        const { title, content, categories, links } = await this._fetchPage(pageUrl);

        if (!title || content.length < 80) continue;

        const doc = {
          id:         this.docs.length + 1,
          title,
          url:        pageUrl,
          content,
          categories,
        };

        this.docs.push(doc);
        this.emit("document", doc);
        this.emit("progress", {
          crawled: this.visited.size,
          queued:  this.queue.length,
          indexed: this.docs.length,
        });

        if (this.followLinks) {
          for (const link of links) {
            if (!this.visited.has(link)) this.queue.push(link);
          }
        }

        await this._sleep(this.delayMs);
      } catch (err) {
        this.emit("error", { url: pageUrl, message: err.message });
      }
    }

    this.running = false;
    this.emit("done", { total: this.docs.length });
    return this.docs;
  }

  stop() {
    this.maxPages = this.docs.length; 
  }
}

module.exports = WikiCrawler;