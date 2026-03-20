#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const POSTS_PER_PAGE = Infinity; // Show all posts on single page (no pagination)

// Simple Markdown parser (basic implementation)
function parseMarkdown(markdown) {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Unordered Lists - improved handling
  const lines = html.split('\n');
  let inList = false;
  let result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isListItem = line.trim().startsWith('- ') || line.trim().startsWith('* ');
    
    if (isListItem && !inList) {
      inList = true;
      result.push('<ul>');
    } else if (!isListItem && inList && line.trim() !== '') {
      inList = false;
      result.push('</ul>');
    }
    
    if (isListItem) {
      const content = line.trim().replace(/^[-*]\s+/, '');
      result.push(`<li>${content}</li>`);
    } else {
      result.push(line);
    }
  }
  
  if (inList) {
    result.push('</ul>');
  }
  
  html = result.join('\n');
  
  // Paragraphs
  html = html.split('\n\n').map(para => {
    const trimmed = para.trim();
    if (trimmed.startsWith('<') || trimmed === '') return para;
    return `<p>${trimmed}</p>`;
  }).join('\n\n');
  
  return html;
}

// Parse YAML frontmatter
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    throw new Error('Invalid frontmatter format');
  }
  
  const frontmatterText = match[1];
  const body = match[2];
  
  const frontmatter = {};
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Handle arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      }
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, body };
}

// Extract headings from markdown (only H2 for TOC, but keep H3 for IDs)
function extractHeadings(content) {
  const headings = [];
  const lines = content.split('\n');
  
  lines.forEach(line => {
    if (line.startsWith('## ')) {
      const text = line.replace(/^##\s+/, '').trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      headings.push({ level: 2, text, id, includeInTOC: true });
    } else if (line.startsWith('### ')) {
      const text = line.replace(/^###\s+/, '').trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      headings.push({ level: 3, text, id, includeInTOC: false });
    }
  });
  
  return headings;
}

// Generate table of contents from headings (only H2)
function generateTOC(headings) {
  const tocHeadings = headings.filter(h => h.includeInTOC);
  if (tocHeadings.length === 0) return '';
  
  let toc = '<div class="toc"><h3>Table of Contents</h3><ul>';
  tocHeadings.forEach(heading => {
    toc += `<li><a href="#${heading.id}">${heading.text}</a></li>`;
  });
  toc += '</ul></div>';
  
  return toc;
}

// Add IDs to HTML headings
function addHeadingIds(html, headings) {
  headings.forEach(heading => {
    const tag = `h${heading.level}`;
    // Match the heading tag with the exact text
    const regex = new RegExp(`<${tag}>${heading.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</${tag}>`, 'g');
    html = html.replace(regex, `<${tag} id="${heading.id}">${heading.text}</${tag}>`);
  });
  return html;
}

// Recursively find all markdown files
function findMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md') && file !== 'README.md') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Calculate relevance score between two posts based on category and keyword overlap
function getRelevanceScore(postA, postB) {
  let score = 0;

  // Same category = strong signal
  if (postA.category && postB.category && postA.category === postB.category) {
    score += 3;
  }

  // Keyword overlap
  const keywordsA = Array.isArray(postA.keywords) ? postA.keywords : (postA.keywords || '').split(',').map(k => k.trim());
  const keywordsB = Array.isArray(postB.keywords) ? postB.keywords : (postB.keywords || '').split(',').map(k => k.trim());

  // Check individual keyword word overlap (more granular than exact match)
  const wordsA = new Set(keywordsA.join(' ').toLowerCase().split(/\s+/));
  const wordsB = new Set(keywordsB.join(' ').toLowerCase().split(/\s+/));
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'on', 'of', 'is', 'how', 'what', 'vs']);
  
  for (const word of wordsA) {
    if (!stopWords.has(word) && wordsB.has(word)) {
      score += 1;
    }
  }

  // Title word overlap
  const titleWordsA = new Set((postA.title || '').toLowerCase().split(/\s+/));
  const titleWordsB = new Set((postB.title || '').toLowerCase().split(/\s+/));
  for (const word of titleWordsA) {
    if (word.length > 3 && !stopWords.has(word) && titleWordsB.has(word)) {
      score += 0.5;
    }
  }

  return score;
}

// Find the top N related posts for a given post
function findRelatedPosts(currentPost, allPosts, count = 3) {
  const scored = allPosts
    .filter(p => p.slug !== currentPost.slug)
    .map(p => ({ post: p, score: getRelevanceScore(currentPost, p) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map(s => s.post);
}

// Generate related posts HTML section
function generateRelatedPostsHTML(relatedPosts) {
  if (relatedPosts.length === 0) return '';

  let html = '<div class="related-posts"><h3>Related Articles</h3><div class="related-posts-grid">';

  relatedPosts.forEach(post => {
    const excerpt = (post.description || '').substring(0, 100);
    html += `
      <div class="related-post-card">
        <a href="${post.slug}">
          <h4>${post.title}</h4>
          <p>${excerpt}${excerpt.length >= 100 ? '...' : ''}</p>
        </a>
      </div>`;
  });

  html += '</div></div>';
  return html;
}

// Generate contextual inline links to insert into article content
function generateInlineLinks(currentPost, allPosts) {
  // Find top 5 related posts (we'll try to link up to 3 within the content)
  const candidates = findRelatedPosts(currentPost, allPosts, 5);
  
  // Build a map of anchor text -> link for insertion
  // We use the post title as potential anchor text triggers, and also short phrases
  const linkMap = [];
  candidates.forEach(post => {
    // Create natural anchor phrases from the post title
    const title = post.title || '';
    linkMap.push({
      slug: post.slug,
      title: title,
      href: `${post.slug}`
    });
  });

  return linkMap;
}

// Insert contextual links into HTML content (up to maxLinks)
function insertContextualLinks(htmlContent, linkMap, maxLinks = 3) {
  let linksInserted = 0;
  let modifiedContent = htmlContent;

  for (const link of linkMap) {
    if (linksInserted >= maxLinks) break;

    // Look for a good paragraph to append a "Related reading" link after
    // Strategy: find the first <h2> section boundary after the first section,
    // and insert a contextual link before it
    const h2Matches = [...modifiedContent.matchAll(/<h2\s[^>]*id="([^"]*)"[^>]*>/g)];
    
    if (h2Matches.length > linksInserted + 1) {
      // Insert before the (linksInserted + 1)th h2 (skip first h2, space links out)
      const targetH2 = h2Matches[linksInserted + 1];
      const insertPos = targetH2.index;
      
      const linkHTML = `<p class="contextual-link"><strong>Related:</strong> <a href="${link.href}">${link.title}</a></p>\n\n`;
      modifiedContent = modifiedContent.slice(0, insertPos) + linkHTML + modifiedContent.slice(insertPos);
      linksInserted++;
    }
  }

  return modifiedContent;
}

// Build a single post (first pass - collect metadata only)
function collectPostMetadata(markdownFile) {
  const content = fs.readFileSync(markdownFile, 'utf-8');
  const { frontmatter } = parseFrontmatter(content);
  
  return {
    ...frontmatter,
    slug: frontmatter.slug || path.basename(markdownFile, '.md'),
    date: frontmatter.date || new Date().toISOString(),
    readTime: frontmatter.readTime || '5 min',
    _markdownFile: markdownFile
  };
}

// Build a single post (second pass - generate HTML with cross-links)
function buildPost(markdownFile, templatePath, outputDir, allPosts) {
  const content = fs.readFileSync(markdownFile, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);
  
  const currentSlug = frontmatter.slug || path.basename(markdownFile, '.md');
  const currentPost = allPosts.find(p => p.slug === currentSlug) || frontmatter;

  // Extract headings before parsing
  const headings = extractHeadings(body);
  
  // Generate TOC
  const toc = generateTOC(headings);
  
  // Parse markdown to HTML
  let htmlContent = parseMarkdown(body);
  
  // Add IDs to headings in HTML
  htmlContent = addHeadingIds(htmlContent, headings);

  // Insert contextual inline links to related posts
  const linkMap = generateInlineLinks(currentPost, allPosts);
  htmlContent = insertContextualLinks(htmlContent, linkMap, 3);

  // Generate related posts section
  const relatedPosts = findRelatedPosts(currentPost, allPosts, 3);
  const relatedPostsHTML = generateRelatedPostsHTML(relatedPosts);
  
  // Read template
  let template = fs.readFileSync(templatePath, 'utf-8');
  
  // Replace placeholders
  const replacements = {
    TITLE: frontmatter.title || 'Untitled',
    DESCRIPTION: frontmatter.description || '',
    SLUG: currentSlug,
    CATEGORY: frontmatter.category || 'general',
    AUTHOR: frontmatter.author || 'Alpha Whale Team',
    DATE: new Date(frontmatter.date || Date.now()).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    DATE_ISO: new Date(frontmatter.date || Date.now()).toISOString(),
    READ_TIME: frontmatter.readTime || '5 min',
    KEYWORDS: Array.isArray(frontmatter.keywords) 
      ? frontmatter.keywords.join(', ') 
      : frontmatter.keywords || '',
    CONTENT: htmlContent,
    TOC: toc,
    CTA_BANNER: `
      <div class="article-cta">
        <h3>Ready to Automate Your Polymarket Trading?</h3>
        <p>Start copying top traders and maximize your returns with Alpha Whale.</p>
        <a href="https://app.alphawhale.trade/">Start Trading →</a>
      </div>
    `,
    ROBOTS: frontmatter.noindex ? 'noindex, follow' : 'index, follow',
    RELATED_POSTS: relatedPostsHTML,
    TITLE_ENCODED: encodeURIComponent(frontmatter.title || ''),
    URL_ENCODED: encodeURIComponent(`https://alphawhale.trade/blog/${currentSlug}`)
  };
  
  Object.keys(replacements).forEach(key => {
    template = template.replace(new RegExp(`{{${key}}}`, 'g'), replacements[key]);
  });
  
  // Write output
  const outputFile = path.join(outputDir, `${currentSlug}.html`);
  fs.writeFileSync(outputFile, template, 'utf-8');
  
  return {
    ...frontmatter,
    slug: currentSlug,
    date: frontmatter.date || new Date().toISOString(),
    readTime: frontmatter.readTime || '5 min'
  };
}

// Generate post card HTML
function generatePostCard(post) {
  const excerpt = post.description || 'Read more...';
  const categoryDisplay = (post.category || 'general').split('-').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
  
  return `
    <article class="post-card" data-category="${post.category}">
      <a href="posts/${post.slug}">
        <div class="post-card-image">📈</div>
        <div class="post-card-content">
          <span class="post-card-category">${categoryDisplay}</span>
          <h2 class="post-card-title">${post.title}</h2>
          <p class="post-card-excerpt">${excerpt.substring(0, 120)}${excerpt.length > 120 ? '...' : ''}</p>
          <div class="post-card-meta">
            <span>${new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>${post.readTime}</span>
          </div>
        </div>
      </a>
    </article>
  `;
}

// Generate pagination HTML
function generatePagination(currentPage, totalPages) {
  if (totalPages <= 1) return '';
  
  let html = '<div class="pagination">';
  
  // Previous button
  if (currentPage > 1) {
    const prevPage = currentPage === 2 ? 'index.html' : `page-${currentPage - 1}.html`;
    html += `<a href="${prevPage}" class="pagination-btn">← Previous</a>`;
  } else {
    html += `<span class="pagination-btn disabled">← Previous</span>`;
  }
  
  // Page numbers
  html += '<div class="pagination-numbers">';
  for (let i = 1; i <= totalPages; i++) {
    const pageUrl = i === 1 ? 'index.html' : `page-${i}.html`;
    if (i === currentPage) {
      html += `<span class="pagination-num active">${i}</span>`;
    } else {
      html += `<a href="${pageUrl}" class="pagination-num">${i}</a>`;
    }
  }
  html += '</div>';
  
  // Next button
  if (currentPage < totalPages) {
    html += `<a href="page-${currentPage + 1}.html" class="pagination-btn">Next →</a>`;
  } else {
    html += `<span class="pagination-btn disabled">Next →</span>`;
  }
  
  html += '</div>';
  return html;
}

// Build blog index with pagination
function buildIndex(posts, indexTemplatePath, outputDir) {
  // Sort posts by date (newest first)
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const postsPerPage = Number.isFinite(POSTS_PER_PAGE) ? POSTS_PER_PAGE : posts.length;
  const totalPages = Math.max(1, Math.ceil(posts.length / postsPerPage));
  
  // Generate featured posts (top 3)
  let featuredHTML = '';
  posts.slice(0, 3).forEach(post => {
    featuredHTML += `
      <div class="featured-post">
        <a href="posts/${post.slug}">
          <div class="featured-post-title">${post.title}</div>
          <div class="featured-post-date">${new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        </a>
      </div>
    `;
  });
  
  // Build each page
  for (let page = 1; page <= totalPages; page++) {
    let index = fs.readFileSync(indexTemplatePath, 'utf-8');
    
    const startIdx = (page - 1) * postsPerPage;
    const endIdx = startIdx + postsPerPage;
    const pagePosts = posts.slice(startIdx, endIdx);
    
    // Generate post cards HTML
    let postsHTML = '';
    pagePosts.forEach(post => {
      postsHTML += generatePostCard(post);
    });
    
    // Add pagination
    const paginationHTML = generatePagination(page, totalPages);
    postsHTML += paginationHTML;
    
    // Replace placeholders
    index = index.replace('<!-- Posts will be inserted here by build script -->', postsHTML);
    index = index.replace('<!-- Featured posts will be inserted here by build script -->', featuredHTML);
    
    // Write page
    const outputFile = page === 1 
      ? path.join(outputDir, 'index.html')
      : path.join(outputDir, `page-${page}.html`);
    fs.writeFileSync(outputFile, index, 'utf-8');
  }
  
  return totalPages;
}

// Generate sitemap.xml
function generateSitemap(posts, outputPath) {
  const baseUrl = 'https://alphawhale.trade';
  const today = new Date().toISOString().split('T')[0];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}/documentation</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}/privacy-policy</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}/terms-of-service</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}/blog/</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>`;

  // Add individual blog posts (no pagination pages in sitemap)
  // Deduplicate by slug to prevent duplicate entries from files with the same slug
  const seenSlugs = new Set();
  let duplicateCount = 0;
  let noindexCount = 0;
  posts.forEach(post => {
    if (post.noindex) {
      noindexCount++;
      return;
    }
    if (seenSlugs.has(post.slug)) {
      console.warn(`  ⚠️  Duplicate slug skipped in sitemap: ${post.slug}`);
      duplicateCount++;
      return;
    }
    seenSlugs.add(post.slug);
    const postDate = new Date(post.date).toISOString().split('T')[0];
    sitemap += `
  <url>
    <loc>${baseUrl}/blog/posts/${post.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <lastmod>${postDate}</lastmod>
  </url>`;
  });

  if (duplicateCount > 0) {
    console.warn(`  ⚠️  ${duplicateCount} duplicate slug(s) found — check blog-content/ for files with the same slug`);
  }

  sitemap += `
</urlset>`;

  const uniquePostCount = seenSlugs.size;
  fs.writeFileSync(outputPath, sitemap, 'utf-8');
  console.log(`📋 Generated sitemap.xml with ${uniquePostCount + 6} URLs (${noindexCount} noindex posts excluded)`);
}

// Main build function
function build() {
  const blogContentDir = path.join(__dirname, '..', 'blog-content');
  const templatePath = path.join(__dirname, '..', 'templates', 'blog-post.html');
  const indexTemplatePath = path.join(__dirname, '..', 'blog', 'index-template.html');
  const blogOutputDir = path.join(__dirname, '..', 'blog');
  const postsOutputDir = path.join(__dirname, '..', 'blog', 'posts');
  
  // Ensure output directory exists
  if (!fs.existsSync(postsOutputDir)) {
    fs.mkdirSync(postsOutputDir, { recursive: true });
  }
  
  // Check if index template exists, if not use index.html as template
  let actualIndexTemplate = indexTemplatePath;
  if (!fs.existsSync(indexTemplatePath)) {
    actualIndexTemplate = path.join(__dirname, '..', 'blog', 'index.html');
    console.log('Using index.html as template (index-template.html not found)');
  }
  
  // Find all markdown files recursively
  const markdownFiles = findMarkdownFiles(blogContentDir);
  
  if (markdownFiles.length === 0) {
    console.log('No markdown files found in blog-content/');
    return;
  }
  
  console.log(`Found ${markdownFiles.length} markdown file(s)`);
  
  // Pass 1: Collect all post metadata for cross-linking
  console.log('Pass 1: Collecting post metadata...');
  const allPostsMeta = [];
  markdownFiles.forEach(file => {
    try {
      const meta = collectPostMetadata(file);
      allPostsMeta.push(meta);
    } catch (error) {
      console.error(`Error reading metadata from ${file}:`, error.message);
    }
  });
  console.log(`Collected metadata for ${allPostsMeta.length} posts`);

  // Validate description lengths (Google truncates at ~160 chars)
  const DESC_MAX = 160;
  let descWarnings = 0;
  allPostsMeta.forEach(meta => {
    const desc = meta.description || '';
    if (desc.length > DESC_MAX) {
      console.warn(`  ⚠️  Description too long (${desc.length}/${DESC_MAX} chars): ${meta.slug}`);
      console.warn(`      "${desc.substring(0, 80)}..."`);
      descWarnings++;
    }
  });
  if (descWarnings > 0) {
    console.warn(`\n⚠️  ${descWarnings} post(s) have descriptions over ${DESC_MAX} characters. Trim them for better SEO.\n`);
  } else {
    console.log(`✅ All descriptions are within ${DESC_MAX} characters`);
  }

  // Pass 2: Build all posts with cross-links
  console.log('Pass 2: Building posts with cross-links...');
  const posts = [];
  markdownFiles.forEach(file => {
    try {
      console.log(`Building: ${path.relative(blogContentDir, file)}`);
      const post = buildPost(file, templatePath, postsOutputDir, allPostsMeta);
      posts.push(post);
    } catch (error) {
      console.error(`Error building ${file}:`, error.message);
    }
  });
  
  // Build index (single page, no pagination)
  console.log('Building blog index...');
  const totalPages = buildIndex(posts, actualIndexTemplate, blogOutputDir);

  // Clean up old pagination files
  for (let i = 2; i <= 20; i++) {
    const oldPage = path.join(blogOutputDir, `page-${i}.html`);
    if (fs.existsSync(oldPage)) {
      fs.unlinkSync(oldPage);
      console.log(`  Removed old pagination file: page-${i}.html`);
    }
  }
  
  // Generate sitemap
  console.log('Generating sitemap...');
  const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
  generateSitemap(posts, sitemapPath);
  
  console.log(`\n✅ Built ${posts.length} post(s) successfully!`);
  console.log(`📄 Index pages: ${totalPages}`);
  console.log(`📝 Posts: blog/posts/`);
  
  // Print category breakdown
  const categories = {};
  posts.forEach(post => {
    const cat = post.category || 'general';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  console.log('\n📊 Posts by category:');
  Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count}`);
  });
}

// Run build
build();
