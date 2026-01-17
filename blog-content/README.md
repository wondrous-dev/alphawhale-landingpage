# Blog Content Guide

This directory contains Markdown source files for the Alpha Whale blog.

## Adding a New Post

1. Create a new `.md` file in this directory
2. Add YAML frontmatter at the top:

```yaml
---
title: "Your Post Title"
slug: "your-post-slug"
description: "SEO description for search engines"
category: "how-to" # Options: how-to, strategy, copy-trading, markets
author: "Alpha Whale Team"
date: "2026-01-16" # YYYY-MM-DD format
readTime: "8 min"
keywords: ["keyword1", "keyword2", "keyword3"]
---
```

3. Write your content in Markdown below the frontmatter
4. Run the build script: `node scripts/build-blog.js`
5. Your post will be generated at `blog/posts/your-post-slug.html`

## Frontmatter Fields

- **title**: Post title (used in HTML title tag)
- **slug**: URL-friendly identifier (used in URL: `/blog/slug`)
- **description**: Meta description for SEO
- **category**: Post category (used for filtering on blog index)
- **author**: Author name
- **date**: Publication date (YYYY-MM-DD)
- **readTime**: Estimated reading time
- **keywords**: Array of SEO keywords

## Markdown Support

The build script supports:
- Headers (`#`, `##`, `###`)
- Bold (`**text**`)
- Italic (`*text*`)
- Links (`[text](url)`)
- Lists (`* item`)
- Paragraphs (separated by blank lines)

## Building the Blog

Run from the project root:
```bash
node scripts/build-blog.js
```

This will:
1. Parse all `.md` files in `blog-content/`
2. Generate HTML posts in `blog/posts/`
3. Update `blog/index.html` with post listings

## SEO Best Practices

- Use descriptive titles with target keywords
- Write compelling meta descriptions (150-160 chars)
- Include keywords naturally in content
- Use H2/H3 headers for structure
- Link to related posts and pillar pages
- Include internal links to Alpha Whale product pages



