<div align="center">

# 🔍 WSearch

### Real-time Wikipedia Search Engine with BM25 Ranking

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-wsearch.onrender.com-gold?style=for-the-badge)](https://wsearch.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

**WSearch** is a fast, elegant search engine that queries Wikipedia in real-time and ranks results using the Okapi BM25 algorithm — the same ranking model used by Elasticsearch and Solr.

[**→ Try it live at wsearch.onrender.com**](https://wsearch.onrender.com)

</div>

---

## ✨ Features

- **Real-time Wikipedia crawling** — fetches fresh articles on every search, no stale index
- **Okapi BM25 ranking** — industry-standard relevance scoring (k1=1.5, b=0.75) with title boosting (3×) and category boosting (2×)
- **Autocomplete** — Wikipedia OpenSearch API suggestions with keyboard navigation
- **In-memory caching** — previously fetched articles are cached to speed up repeat searches
- **Dark luxury UI** — Vyntr-inspired design with Playfair Display serif, gold accents, frosted glass search bar
- **SPA navigation** — URL updates on search, browser back/forward works correctly
- **Zero dependencies on the frontend** — pure vanilla JS, no React or Vue

---

## 🖥️ Screenshots

| Homepage | Search Results |
|---|---|
| Full-screen centered hero with gold serif logo | Sticky topbar + left-aligned result cards |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│         frontend/index.html + main.js               │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────────────┐
│              Express Server (Node.js)                │
│                 server/server.js                     │
│                                                     │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────┐  │
│  │  BM25 Index │   │   Crawler    │   │ Tokenizer│  │
│  │  (in-memory)│   │ (real-time)  │   │ (Porter) │  │
│  └─────────────┘   └──────┬───────┘   └──────────┘  │
└─────────────────────────┬─┼───────────────────────-─┘
                          │ │
              ┌───────────▼─▼──────────┐
              │    Wikipedia API        │
              │  en.wikipedia.org       │
              └────────────────────────┘
```

### How a search works

```
User types query
      ↓
Wikipedia OpenSearch API → fetch 8–10 article titles
      ↓
Parallel fetch of each Wikipedia article (cheerio scraping)
      ↓
Strip infoboxes, navboxes, references → extract clean text + categories
      ↓
Feed into BM25Index → score every document against query terms
      ↓
Return top 10 results with highlighted snippets
```

---

## 📁 Project Structure

```
search_engine/
├── frontend/
│   ├── index.html        # SPA shell — hero + sticky topbar + results
│   ├── style.css         # Dark luxury theme (Playfair Display, gold palette)
│   └── main.js           # Search, autocomplete, layout switching
│
├── server/
│   └── server.js         # Express app — BM25 engine + Wikipedia fetcher + API routes
│
├── crawler/
│   └── crawler.js        # WikiCrawler EventEmitter (optional batch crawling)
│
├── indexer/
│   ├── tokenizer.js      # Lowercase → strip punctuation → stopwords → Porter stem
│   └── stopwords.js      # ~80 common English stopwords
│
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/wsearch.git
cd wsearch/search_engine

# Install dependencies
npm install

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development (auto-reload)

```bash
npm run dev
```

## ⚙️ BM25 Configuration

The ranking algorithm is tuned with the following parameters in `server/server.js`:

| Parameter | Value | Effect |
|---|---|---|
| `k1` | `1.5` | Term frequency saturation — higher = more weight on repeated terms |
| `b` | `0.75` | Document length normalization — 0 = no normalization, 1 = full |
| Title boost | `3×` | Title tokens are indexed 3 times for higher relevance |
| Category boost | `2×` | Category tokens indexed twice |

---

## 🌐 Deployment

### Render (current — free tier)

Live at **[wsearch.onrender.com](https://wsearch.onrender.com)**

```bash
# Build command
npm install

# Start command
node server/server.js
```

Environment variables:
```
NODE_ENV=production
RENDER_EXTERNAL_URL=https://wsearch.onrender.com
```

### Railway

```bash
# Auto-detected as Node.js
# Start command: node server/server.js
# No sleep on free tier — always on
```

### Local / Self-hosted

```bash
npm start
# → http://localhost:3000
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Server | Express 4 |
| HTTP client | Axios |
| HTML parsing | Cheerio |
| Ranking | Okapi BM25 (custom implementation) |
| Stemming | Porter Stemmer (custom, zero dependencies) |
| Frontend | Vanilla JS, CSS3 |
| Fonts | Playfair Display, Inter (Google Fonts) |
| Wikipedia | OpenSearch API + HTML scraping |

---

## 📄 License

MIT — free to use, modify and deploy.

---

<div align="center">

Built with ☕ and Node.js &nbsp;·&nbsp; [wsearch.onrender.com](https://wsearch.onrender.com)

</div>
