#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const POSTS_PER_PAGE = 12;

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

// Build a single post
function buildPost(markdownFile, templatePath, outputDir) {
  const content = fs.readFileSync(markdownFile, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);
  
  // Extract headings before parsing
  const headings = extractHeadings(body);
  
  // Generate TOC
  const toc = generateTOC(headings);
  
  // Parse markdown to HTML
  let htmlContent = parseMarkdown(body);
  
  // Add IDs to headings in HTML
  htmlContent = addHeadingIds(htmlContent, headings);
  
  // Read template
  let template = fs.readFileSync(templatePath, 'utf-8');
  
  // Replace placeholders
  const replacements = {
    TITLE: frontmatter.title || 'Untitled',
    DESCRIPTION: frontmatter.description || '',
    SLUG: frontmatter.slug || path.basename(markdownFile, '.md'),
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
    RELATED_POSTS: '', // Will be populated later
    TITLE_ENCODED: encodeURIComponent(frontmatter.title || ''),
    URL_ENCODED: encodeURIComponent(`https://alphawhale.trade/blog/${frontmatter.slug || path.basename(markdownFile, '.md')}`)
  };
  
  Object.keys(replacements).forEach(key => {
    template = template.replace(new RegExp(`{{${key}}}`, 'g'), replacements[key]);
  });
  
  // Write output
  const outputFile = path.join(outputDir, `${frontmatter.slug || path.basename(markdownFile, '.md')}.html`);
  fs.writeFileSync(outputFile, template, 'utf-8');
  
  return {
    ...frontmatter,
    slug: frontmatter.slug || path.basename(markdownFile, '.md'),
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
      <a href="posts/${post.slug}.html">
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
  
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
  
  // Generate featured posts (top 3)
  let featuredHTML = '';
  posts.slice(0, 3).forEach(post => {
    featuredHTML += `
      <div class="featured-post">
        <a href="posts/${post.slug}.html">
          <div class="featured-post-title">${post.title}</div>
          <div class="featured-post-date">${new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        </a>
      </div>
    `;
  });
  
  // Build each page
  for (let page = 1; page <= totalPages; page++) {
    let index = fs.readFileSync(indexTemplatePath, 'utf-8');
    
    const startIdx = (page - 1) * POSTS_PER_PAGE;
    const endIdx = startIdx + POSTS_PER_PAGE;
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
    <loc>${baseUrl}/about.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}/documentation.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}/privacy-policy.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}/terms-of-service.html</loc>
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

  // Add blog index pages (skip page 1 since it's already added above)
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
  for (let page = 2; page <= totalPages; page++) {
    sitemap += `
  <url>
    <loc>${baseUrl}/blog/page-${page}.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
  </url>`;
  }

  // Add individual blog posts
  posts.forEach(post => {
    const postDate = new Date(post.date).toISOString().split('T')[0];
    sitemap += `
  <url>
    <loc>${baseUrl}/blog/posts/${post.slug}.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <lastmod>${postDate}</lastmod>
  </url>`;
  });

  sitemap += `
</urlset>`;

  fs.writeFileSync(outputPath, sitemap, 'utf-8');
  console.log(`📋 Generated sitemap.xml with ${posts.length + 5 + totalPages} URLs`);
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
  
  // Build all posts
  const posts = [];
  markdownFiles.forEach(file => {
    try {
      console.log(`Building: ${path.relative(blogContentDir, file)}`);
      const post = buildPost(file, templatePath, postsOutputDir);
      posts.push(post);
    } catch (error) {
      console.error(`Error building ${file}:`, error.message);
    }
  });
  
  // Build index with pagination
  console.log('Building index pages...');
  const totalPages = buildIndex(posts, actualIndexTemplate, blogOutputDir);
  
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
