# Alpha Whale Website

Alpha Whale is the leading copy trading platform for Polymarket prediction markets. This repository contains the static website and blog for alphawhale.trade.

## Project Structure

```
├── index.html              # Main homepage
├── home2.html              # Staging/homepage variant
├── about.html              # About/Philosophy page
├── documentation.html      # Product guide
├── privacy-policy.html     # Privacy policy
├── terms-of-service.html   # Terms of service
├── robots.txt              # Search engine crawler instructions
├── sitemap.xml             # Auto-generated sitemap (updated on blog build)
├── blog/                   # Generated blog posts
│   ├── index.html          # Blog listing page 1
│   ├── page-2.html         # Blog listing page 2+
│   ├── index-template.html # Template for blog index
│   └── posts/              # Individual articles (100+ posts)
├── blog-content/           # Markdown source files
│   ├── polymarket-core/    # Core Polymarket articles
│   ├── prediction-markets/  # Prediction market articles
│   ├── copy-trading/       # Copy trading articles
│   ├── automation-bots/    # Automation articles
│   ├── strategy-education/ # Strategy articles
│   ├── comparisons/        # Comparison articles
│   ├── market-specific/    # Market-specific articles
│   ├── trust-safety/       # Trust & safety articles
│   ├── advanced/           # Advanced topics
│   └── brand/              # Brand-focused articles
├── scripts/
│   └── build-blog.js       # Blog build script (generates HTML + sitemap)
└── templates/
    └── blog-post.html      # Blog post template
```

## Development

### Run Locally

Start a local HTTP server:

```bash
python3 -m http.server 8000
```

Then visit: http://localhost:8000

### Build Blog

The blog is built from Markdown files in `blog-content/`. To build:

```bash
node scripts/build-blog.js
```

This will:
1. Parse all `.md` files in `blog-content/` (including subdirectories)
2. Generate HTML posts in `blog/posts/`
3. Generate paginated index pages in `blog/`
4. Auto-generate `sitemap.xml` with all pages and posts

### Adding Blog Posts

1. Create a new `.md` file in the appropriate category directory under `blog-content/`
2. Add YAML frontmatter:

```yaml
---
title: "Your Post Title"
slug: "your-post-slug"
description: "SEO description for search engines"
category: "polymarket-core"
author: "Alpha Whale Team"
date: "2026-01-16"
readTime: "8 min"
keywords: ["keyword1", "keyword2", "keyword3"]
---
```

3. Write content in Markdown below the frontmatter
4. Run `node scripts/build-blog.js`
5. Post will be generated at `blog/posts/your-post-slug.html`

See `blog-content/README.md` for more details on blog content structure.

## SEO

The site includes comprehensive SEO optimizations:

- **100+ SEO-optimized blog articles** covering Polymarket, copy trading, and prediction markets
- **Sitemap** at `/sitemap.xml` (auto-generated on blog build)
- **robots.txt** at `/robots.txt`
- **Schema.org structured data** (SoftwareApplication, Organization) on homepage
- **Open Graph & Twitter Cards** on all pages
- **Meta tags** (title, description, keywords, canonical) on all pages
- **Internal linking** between blog posts and main pages

### SEO Strategy

- **Pillar pages**: Core topics like `/polymarket-trading-bot`, `/polymarket-copy-trading`
- **High-intent keywords**: Polymarket how-to guides, copy trading strategies, prediction market automation
- **Programmatic SEO**: Market-specific pages (e.g., `/polymarket/us-election-trading-strategy`)
- **Comparison pages**: "Alpha Whale vs manual Polymarket trading"
- **Technical SEO**: Fast load times, clean URLs, semantic HTML

## Deployment

Deploy to any static hosting service:

- **Vercel**: `vercel deploy`
- **Netlify**: Drag & drop or connect Git repo
- **Cloudflare Pages**: Connect Git repo
- **GitHub Pages**: Push to `gh-pages` branch

The site is fully static HTML/CSS/JS - no build step required (except for blog generation).

## Blog Categories

- **Polymarket Core**: Fundamental Polymarket guides
- **Prediction Markets**: General prediction market content
- **Copy Trading**: Copy trading strategies and guides
- **Automation/Bots**: Trading automation and bots
- **Strategy & Education**: Trading strategies and education
- **Comparisons**: Platform and service comparisons
- **Market-Specific**: Specific market trading guides
- **Trust & Safety**: Security and trust topics
- **Advanced**: Advanced trading topics
- **Brand**: Alpha Whale brand-focused content

## License

Copyright © Alpha Whale. All rights reserved.


