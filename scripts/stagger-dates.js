#!/usr/bin/env node

/**
 * One-off script to redistribute blog post dates so no more than 2 posts share the same day.
 * Preserves relative ordering of posts (earlier posts stay earlier).
 * Spreads posts backwards from the most recent date.
 */

const fs = require('fs');
const path = require('path');

const MAX_PER_DAY = 2;

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

// Extract date from frontmatter
function extractDate(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?\s*$/m);
  return match ? match[1] : null;
}

// Replace date in frontmatter
function replaceDate(filePath, oldDate, newDate) {
  let content = fs.readFileSync(filePath, 'utf-8');
  // Match the date line in frontmatter (between --- markers)
  content = content.replace(
    new RegExp(`(^date:\\s*)"?${oldDate.replace(/-/g, '\\-')}"?`, 'm'),
    `$1"${newDate}"`
  );
  fs.writeFileSync(filePath, content, 'utf-8');
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Add days to a date
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function main() {
  const blogContentDir = path.join(__dirname, '..', 'blog-content');
  const markdownFiles = findMarkdownFiles(blogContentDir);

  console.log(`Found ${markdownFiles.length} markdown files\n`);

  // Collect all posts with their dates
  const posts = [];
  markdownFiles.forEach(filePath => {
    const date = extractDate(filePath);
    if (date) {
      posts.push({ filePath, originalDate: date });
    } else {
      console.warn(`  WARNING: No date found in ${path.relative(blogContentDir, filePath)}`);
    }
  });

  // Sort by original date (earliest first), then by filename for stability
  posts.sort((a, b) => {
    const dateCmp = a.originalDate.localeCompare(b.originalDate);
    if (dateCmp !== 0) return dateCmp;
    return a.filePath.localeCompare(b.filePath);
  });

  // Find the latest date as anchor
  const latestDate = new Date(posts[posts.length - 1].originalDate + 'T00:00:00');
  
  // Calculate how many days we need: ceil(posts.length / MAX_PER_DAY) - 1
  const totalDaysNeeded = Math.ceil(posts.length / MAX_PER_DAY) - 1;
  
  // Start date = latestDate - totalDaysNeeded
  const startDate = addDays(latestDate, -totalDaysNeeded);

  console.log(`Date range: ${formatDate(startDate)} to ${formatDate(latestDate)}`);
  console.log(`Total days needed: ${totalDaysNeeded + 1} (${posts.length} posts, max ${MAX_PER_DAY}/day)\n`);

  // Assign new dates: 2 posts per day, starting from startDate
  let currentDate = new Date(startDate);
  let countOnCurrentDay = 0;
  let changedCount = 0;

  posts.forEach((post, i) => {
    if (countOnCurrentDay >= MAX_PER_DAY) {
      currentDate = addDays(currentDate, 1);
      countOnCurrentDay = 0;
    }

    const newDate = formatDate(currentDate);
    countOnCurrentDay++;

    if (newDate !== post.originalDate) {
      const relPath = path.relative(blogContentDir, post.filePath);
      console.log(`  ${relPath}: ${post.originalDate} -> ${newDate}`);
      replaceDate(post.filePath, post.originalDate, newDate);
      changedCount++;
    }
    post.newDate = newDate;
  });

  console.log(`\nDone! Updated ${changedCount} of ${posts.length} files.`);
  console.log(`New date range: ${posts[0].newDate} to ${posts[posts.length - 1].newDate}`);
  console.log(`\nRun 'node scripts/build-blog.js' to rebuild with new dates.`);
}

main();
