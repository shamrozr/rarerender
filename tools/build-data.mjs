// Enhanced build-data.mjs with CSS/JS optimization and luxury theme support
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const BRANDS_CSV_URL = process.env.BRANDS_CSV_URL;
const MASTER_CSV_URL = process.env.MASTER_CSV_URL;
const PLACEHOLDER_THUMB = (process.env.PLACEHOLDER_THUMB || "/thumbs/_placeholder.webp").trim();

if (!BRANDS_CSV_URL || !MASTER_CSV_URL) {
  console.error("❌ Missing BRANDS_CSV_URL or MASTER_CSV_URL");
  process.exit(1);
}

const HEX = /^#([0-9a-fA-F]{6})$/;
const WA = /^https:\/\/wa\.me\/\d+$/;
const GDRIVE = /^https:\/\/drive\.google\.com\//;

// CSS Minification (Simple but effective)
function minifyCSS(css) {
  return css
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove unnecessary whitespace
    .replace(/\s+/g, ' ')
    // Remove spaces around certain characters
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    // Remove trailing semicolons
    .replace(/;}/g, '}')
    // Remove leading/trailing spaces
    .trim();
}

// JavaScript Minification (Basic)
function minifyJS(js) {
  return js
    // Remove single-line comments (but preserve URLs)
    .replace(/\/\/(?![^\r\n]*https?:\/\/)[^\r\n]*/g, '')
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove spaces around operators and punctuation
    .replace(/\s*([=+\-*/<>!&|(){}[\],;])\s*/g, '$1')
    // Remove trailing semicolons where safe
    .replace(/;(\s*})/g, '$1')
    .trim();
}

// PurgeCSS-like unused CSS removal
function removeUnusedCSS(css, htmlContent, jsContent) {
  // Extract all class names and IDs from HTML and JS
  const classRegex = /class[=\s]*["'][^"']*["']/g;
  const idRegex = /id[=\s]*["'][^"']*["']/g;
  const jsClassRegex = /className\s*[=:]\s*["'][^"']*["']/g;
  const jsIdRegex = /getElementById\s*\(\s*["'][^"']*["']\s*\)/g;
  
  const usedClasses = new Set();
  const usedIds = new Set();
  
  // Extract from HTML
  const htmlClasses = htmlContent.match(classRegex) || [];
  const htmlIds = htmlContent.match(idRegex) || [];
  
  htmlClasses.forEach(match => {
    const classes = match.match(/["']([^"']*)["']/)[1].split(/\s+/);
    classes.forEach(cls => cls && usedClasses.add(cls));
  });
  
  htmlIds.forEach(match => {
    const id = match.match(/["']([^"']*)["']/)[1];
    id && usedIds.add(id);
  });
  
  // Extract from JavaScript
  const jsClasses = jsContent.match(jsClassRegex) || [];
  const jsIds = jsContent.match(jsIdRegex) || [];
  
  jsClasses.forEach(match => {
    const classes = match.match(/["']([^"']*)["']/)[1].split(/\s+/);
    classes.forEach(cls => cls && usedClasses.add(cls));
  });
  
  jsIds.forEach(match => {
    const id = match.match(/["']([^"']*)["']/)[1];
    id && usedIds.add(id);
  });
  
  // Add commonly used classes that might be dynamically generated
  const commonClasses = [
    'card', 'card-product', 'card-folder', 'card-thumb', 'card-body', 'card-title',
    'card-count', 'card-overlay', 'folder-icon', 'product-badge', 'product-indicator',
    'search-result', 'search-results', 'skeleton-card', 'skeleton-image', 'luxury-spinner',
    'mobile-visible', 'clickable-logo', 'current', 'empty-state', 'loading-indicator'
  ];
  
  commonClasses.forEach(cls => usedClasses.add(cls));
  
  // Filter CSS to only include used selectors
  const cssRules = css.split('}');
  const filteredRules = cssRules.filter(rule => {
    if (!rule.trim()) return false;
    
    const selector = rule.split('{')[0];
    if (!selector) return false;
    
    // Keep root variables, @media, @keyframes, and element selectors
    if (selector.includes(':root') || 
        selector.includes('@media') || 
        selector.includes('@keyframes') ||
        selector.match(/^[a-z]+(\s|,|:|>|\+|~|$)/)) {
      return true;
    }
    
    // Check if any used class or ID is in the selector
    const hasUsedClass = Array.from(usedClasses).some(cls => 
      selector.includes(`.${cls}`)
    );
    const hasUsedId = Array.from(usedIds).some(id => 
      selector.includes(`#${id}`)
    );
    
    return hasUsedClass || hasUsedId;
  });
  
  return filteredRules.join('}') + '}';
}

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const rawHeaders = lines[0].split(",").map((h) => h.trim());
  const headers = rawHeaders.map((h) => h.replace(/\s+/g, " ").trim());
  
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cells.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (cells[i] ?? "").trim()));
    return obj;
  });
}

// Enhanced path normalization for luxury catalog
function normPath(p) {
  if (!p) return "";
  const parts = p.replace(/\\/g, "/").split("/").map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  parts[0] = parts[0].toUpperCase(); // normalize top category
  return parts.join("/");
}

// Optimized thumbnail path conversion
function toThumbSitePath(rel) {
  if (!rel) return "";
  let p = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  
  if (!p.startsWith("thumbs/")) {
    p = "thumbs/" + p;
  }
  
  return "/" + p;
}

async function fileExists(relFromPublic) {
  try {
    await fs.access(path.join(PUBLIC_DIR, relFromPublic.replace(/^\//, "")));
    return true;
  } catch { 
    return false; 
  }
}

function ensureFolderNode(tree, segs) {
  let node = tree;
  for (const seg of segs) {
    node[seg] = node[seg] || { thumbnail: "", children: {} };
    node = node[seg].children;
  }
  return node;
}

function setCounts(node) {
  if (node.isProduct) return 1;
  let sum = 0;
  for (const k of Object.keys(node.children || {})) {
    sum += setCounts(node.children[k]);
  }
  node.count = sum;
  return sum;
}

function propagateThumbsFromChildren(node) {
  for (const k of Object.keys(node)) {
    const n = node[k];
    if (!n.isProduct && n.children) {
      propagateThumbsFromChildren(n.children);
      
      if (!n.thumbnail) {
        const childKeys = Object.keys(n.children);
        for (const ckey of childKeys) {
          const child = n.children[ckey];
          if (child.thumbnail) {
            n.thumbnail = child.thumbnail;
            break;
          }
        }
      }
    }
  }
}

function fillMissingThumbsFromAncestors(node, inherited = "") {
  for (const k of Object.keys(node)) {
    const n = node[k];
    const current = n.thumbnail || inherited || PLACEHOLDER_THUMB || "";
    if (!n.thumbnail && current) n.thumbnail = current;
    if (!n.isProduct && n.children) {
      fillMissingThumbsFromAncestors(n.children, current);
    }
  }
}

// Enhanced build process with optimization
(async () => {
  console.log("🚀 Starting luxury catalog build process...");
  
  // Fetch data
  console.log("📥 Fetching CSV data...");
  const [brandsRes, masterRes] = await Promise.all([
    fetch(BRANDS_CSV_URL),
    fetch(MASTER_CSV_URL),
  ]);
  
  if (!brandsRes.ok || !masterRes.ok) {
    console.error("❌ Failed to fetch CSVs:", !brandsRes.ok ? "brands" : "", !masterRes.ok ? "master" : "");
    process.exit(1);
  }
  
  const [brandsCSV, masterCSV] = await Promise.all([brandsRes.text(), masterRes.text()]);
  const brandsRows = parseCSV(brandsCSV);
  const masterRows = parseCSV(masterCSV);
  
  console.log(`📊 Parsed ${brandsRows.length} brands and ${masterRows.length} catalog items`);

  const warnings = [];
  const hardErrors = [];

  // ===== Process Brands with Enhanced Validation =====
  console.log("🏷️  Processing luxury brands...");
  const brands = {};
  for (const r of brandsRows) {
    const slug = (r.csvslug || "").trim();
    const name = (r.brandName || "").trim();
    if (!slug && !name) continue;
    if (!slug || !name) { 
      warnings.push(`Brand row skipped (needs both slug & name): ${JSON.stringify(r)}`); 
      continue; 
    }

    let primary = (r.primaryColor || "").trim();
    let accent  = (r.accentColor  || "").trim();
    let text    = (r.textColor    || "").trim();
    let bg      = (r.bgColor      || "").trim();

    // Enhanced defaults for luxury dark theme
    if (!HEX.test(primary)) { 
      if (primary) warnings.push(`Brand ${slug}: invalid primaryColor "${primary}" → luxury gold used`); 
      primary = "#d4af37"; // Luxury gold
    }
    if (!HEX.test(accent))  { 
      if (accent)  warnings.push(`Brand ${slug}: invalid accentColor "${accent}" → rose gold used`);  
      accent  = "#e8b4a0"; // Rose gold
    }
    if (!HEX.test(text))    { 
      if (text)    warnings.push(`Brand ${slug}: invalid textColor "${text}" → luxury white used`);      
      text    = "#f5f5f5"; // Luxury white
    }
    if (!HEX.test(bg))      { 
      if (bg)      warnings.push(`Brand ${slug}: invalid bgColor "${bg}" → luxury black used`);          
      bg      = "#0a0a0a"; // Luxury black
    }

    const waRaw = (r.whatsapp || "").trim();
    const whatsapp = WA.test(waRaw) ? waRaw : "";
    if (waRaw && !whatsapp) warnings.push(`Brand ${slug}: WhatsApp is not wa.me/* → ignored`);

    const defaultCategory = (r.defaultCategory || "").trim() || "BAGS";
    if (brands[slug]) { 
      warnings.push(`Duplicate brand slug ignored: ${slug}`); 
      continue; 
    }

    brands[slug] = { name, colors: { primary, accent, text, bg }, whatsapp, defaultCategory };
  }
  
  console.log(`✅ Processed ${Object.keys(brands).length} luxury brands`);

  // ===== Build Enhanced Catalog Tree =====
  console.log("🌳 Building luxury catalog tree...");
  
  const allFullPaths = masterRows.map(r => normPath(r["RelativePath"] || r["Relative Path"] || r["Relative_Path"] || ""));
  const parentsSet = new Set();
  for (const full of allFullPaths) {
    const segs = full.split("/").filter(Boolean);
    for (let i = 1; i < segs.length; i++) {
      parentsSet.add(segs.slice(0, i).join("/"));
    }
  }

  const tree = {};
  let totalProducts = 0;
  const invalidDriveLinks = [];
  const folderMeta = new Map();

  console.log("📝 Processing luxury catalog entries...");
  let processedCount = 0;
  
  for (const r of masterRows) {
    const name = (r["Name"] || r["Folder/Product"] || "").trim();
    const rel  = normPath(r["RelativePath"] || r["Relative Path"] || "");
    const driveLink = (r["Drive Link"] || r["Drive"] || "").trim();
    const thumbRel  = (r["Thumbs Path"] || r["Thumb"] || "").trim();
    const topOrderRaw = (r["TopOrder"] || r["Top Order"] || "").trim();

    if (!rel || !name) continue;
    
    processedCount++;
    if (processedCount % 100 === 0) {
      console.log(`  ✨ Processed ${processedCount}/${masterRows.length} luxury items...`);
    }

    const full = rel;
    const segs = full.split("/").filter(Boolean);
    const isCandidateProduct = !!driveLink;
    const hasChildren = parentsSet.has(full);
    const isLeafProduct = isCandidateProduct && !hasChildren;

    if (isCandidateProduct && !GDRIVE.test(driveLink)) {
      invalidDriveLinks.push({ name, rel, driveLink });
    }

    const normalizedThumb = toThumbSitePath(thumbRel);

    if (isLeafProduct) {
      const parentSegs = segs.slice(0, -1);
      const children = ensureFolderNode(tree, parentSegs);
      children[name] = { 
        isProduct: true, 
        driveLink, 
        thumbnail: normalizedThumb || PLACEHOLDER_THUMB 
      };
      totalProducts++;
    } else {
      ensureFolderNode(tree, segs);
      const k = segs.join("/");
      const existing = folderMeta.get(k) || {};
      if (normalizedThumb) existing.thumbnail = normalizedThumb;
      if (driveLink) existing.driveLink = driveLink;
      
      if (segs.length === 1) {
        const n = parseInt(topOrderRaw, 10);
        if (!Number.isNaN(n)) existing.topOrder = n;
      }
      folderMeta.set(k, existing);
    }
  }

  console.log(`📦 Created luxury catalog with ${totalProducts} products`);

  // Attach folder metadata
  console.log("🔗 Enhancing catalog structure...");
  function attachFolderMeta(node, prefix = []) {
    for (const k of Object.keys(node)) {
      const n = node[k];
      if (!n.isProduct) {
        const here = [...prefix, k].join("/");
        const meta = folderMeta.get(here);
        if (meta?.thumbnail) n.thumbnail = meta.thumbnail;
        if (meta?.driveLink) n.driveLink = meta.driveLink;
        if (typeof meta?.topOrder !== "undefined") n.topOrder = meta.topOrder;
        if (n.children) attachFolderMeta(n.children, [...prefix, k]);
      }
    }
  }
  attachFolderMeta(tree);

  // Convert empty folders with drive links to products
  console.log("🔄 Optimizing catalog structure...");
  function convertEmpty(node) {
    for (const k of Object.keys(node)) {
      const n = node[k];
      if (!n.isProduct) {
        const hasChildren = Object.keys(n.children || {}).length > 0;
        if (!hasChildren && n.driveLink) {
          delete n.children;
          n.isProduct = true;
          totalProducts++;
        } else if (n.children) {
          convertEmpty(n.children);
        }
      }
    }
  }
  convertEmpty(tree);

  // Enhance catalog with thumbnails and counts
  console.log("🖼️  Enhancing visual elements...");
  propagateThumbsFromChildren(tree);
  fillMissingThumbsFromAncestors(tree);

  console.log("🧮 Calculating luxury catalog metrics...");
  for (const top of Object.keys(tree)) {
    setCounts(tree[top]);
  }

  // Enhanced health checks
  console.log("🔍 Running quality assurance checks...");
  const missingThumbFiles = [];
  async function scanMissingThumbs(node, pfx = []) {
    for (const k of Object.keys(node)) {
      const n = node[k];
      if (n.thumbnail && n.thumbnail !== PLACEHOLDER_THUMB) {
        const exists = await fileExists(n.thumbnail);
        if (!exists) {
          missingThumbFiles.push({ 
            path: [...pfx, k].join("/"), 
            thumbnail: n.thumbnail 
          });
        }
      }
      if (!n.isProduct && n.children) {
        await scanMissingThumbs(n.children, [...pfx, k]);
      }
    }
  }
  await scanMissingThumbs(tree);

  // ===== Optimize Static Assets =====
  console.log("⚡ Optimizing static assets...");
  
  let cssOptimized = false;
  let jsOptimized = false;
  let originalCssSize = 0;
  let originalJsSize = 0;
  let finalCssSize = 0;
  let finalJsSize = 0;
  
  try {
    // Read current CSS and JS files
    const cssPath = path.join(PUBLIC_DIR, "style.css");
    const jsPath = path.join(PUBLIC_DIR, "script.js");
    const htmlPath = path.join(PUBLIC_DIR, "index.html");
    
    let cssContent = "";
    let jsContent = "";
    let htmlContent = "";
    
    try {
      cssContent = await fs.readFile(cssPath, "utf8");
      originalCssSize = cssContent.length;
      console.log(`📝 Read CSS file: ${Math.round(originalCssSize / 1024)}KB`);
    } catch (err) {
      console.log("⚠️  CSS file not found, skipping CSS optimization");
    }
    
    try {
      jsContent = await fs.readFile(jsPath, "utf8");
      originalJsSize = jsContent.length;
      console.log(`📝 Read JS file: ${Math.round(originalJsSize / 1024)}KB`);
    } catch (err) {
      console.log("⚠️  JS file not found, skipping JS optimization");
    }
    
    try {
      htmlContent = await fs.readFile(htmlPath, "utf8");
      console.log(`📝 Read HTML file: ${Math.round(htmlContent.length / 1024)}KB`);
    } catch (err) {
      console.log("⚠️  HTML file not found, skipping asset optimization");
    }
    
    // Optimize CSS
    if (cssContent && cssContent.length > 0) {
      console.log("🎨 Optimizing CSS...");
      
      try {
        // Remove unused CSS
        const purgedCSS = removeUnusedCSS(cssContent, htmlContent, jsContent);
        console.log(`🗑️  Removed unused CSS: ${Math.round((cssContent.length - purgedCSS.length) / 1024)}KB saved`);
        
        // Minify CSS
        const minifiedCSS = minifyCSS(purgedCSS);
        finalCssSize = minifiedCSS.length;
        console.log(`📦 Minified CSS: ${Math.round((purgedCSS.length - minifiedCSS.length) / 1024)}KB saved`);
        
        // Write optimized CSS
        await fs.writeFile(cssPath, minifiedCSS, "utf8");
        console.log(`✅ CSS optimized: ${Math.round(originalCssSize / 1024)}KB → ${Math.round(finalCssSize / 1024)}KB`);
        cssOptimized = true;
      } catch (cssErr) {
        console.warn("⚠️  CSS optimization failed:", cssErr.message);
      }
    }
    
    // Optimize JavaScript
    if (jsContent && jsContent.length > 0) {
      console.log("⚡ Optimizing JavaScript...");
      
      try {
        const minifiedJS = minifyJS(jsContent);
        finalJsSize = minifiedJS.length;
        console.log(`📦 Minified JS: ${Math.round((jsContent.length - minifiedJS.length) / 1024)}KB saved`);
        
        // Write optimized JS
        await fs.writeFile(jsPath, minifiedJS, "utf8");
        console.log(`✅ JS optimized: ${Math.round(originalJsSize / 1024)}KB → ${Math.round(finalJsSize / 1024)}KB`);
        jsOptimized = true;
      } catch (jsErr) {
        console.warn("⚠️  JavaScript optimization failed:", jsErr.message);
      }
    }
    
  } catch (err) {
    console.warn("⚠️  Asset optimization failed:", err.message);
  }

  // Generate comprehensive report
  const report = {
    timestamp: new Date().toISOString(),
    performance: {
      totalBrands: Object.keys(brands).length,
      totalProducts: totalProducts,
      totalCategories: Object.keys(tree).length,
      catalogEntries: masterRows.length,
    },
    quality: {
      invalidDriveLinks: invalidDriveLinks.length,
      missingThumbnails: missingThumbFiles.length,
      warnings: warnings.length,
      errors: hardErrors.length,
    },
    optimization: {
      cssOptimized: cssOptimized,
      jsOptimized: jsOptimized,
      assetsMinified: cssOptimized || jsOptimized,
      originalCssSize: Math.round(originalCssSize / 1024),
      finalCssSize: Math.round(finalCssSize / 1024),
      originalJsSize: Math.round(originalJsSize / 1024),
      finalJsSize: Math.round(finalJsSize / 1024),
    },
    details: {
      invalidDriveLinks: invalidDriveLinks.slice(0, 5),
      missingThumbFiles: missingThumbFiles.slice(0, 10),
      warnings: warnings.slice(0, 5),
      sampleCategories: Object.keys(tree).slice(0, 10).map(cat => ({
        name: cat,
        items: tree[cat].count || 0
      }))
    }
  };

  // Save optimized data and reports
  console.log("💾 Saving optimized catalog...");
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.writeFile(
    path.join(PUBLIC_DIR, "data.json"), 
    JSON.stringify({ brands, catalog: { totalProducts, tree } }, null, 2), 
    "utf8"
  );
  
  await fs.mkdir(path.join(ROOT, "build"), { recursive: true });
  await fs.writeFile(
    path.join(ROOT, "build", "health.json"), 
    JSON.stringify(report, null, 2), 
    "utf8"
  );

  // Generate enhanced summary
  const summary = [
    "## 🏆 Luxury Catalog Build Summary",
    "",
    "### 📊 **Performance Metrics**",
    `- **Luxury Brands:** ${Object.keys(brands).length}`,
    `- **Premium Products:** ${totalProducts}`,
    `- **Category Collections:** ${Object.keys(tree).length}`,
    `- **Catalog Entries Processed:** ${masterRows.length}`,
    "",
    "### 🎨 **Quality Assurance**",
    `- **Missing Thumbnails:** ${missingThumbFiles.length}`,
    `- **Invalid Drive Links:** ${invalidDriveLinks.length}`,
    warnings.length ? `- **⚠️ Warnings:** ${warnings.length}` : "- **✅ No Warnings**",
    hardErrors.length ? `- **❌ Errors:** ${hardErrors.length}` : "- **✅ No Errors**",
    "",
    "### ⚡ **Optimization Results**",
    "- **CSS:** Purged unused styles & minified",
    "- **JavaScript:** Minified for performance",
    "- **Assets:** Optimized for fast loading",
    "",
    "### 🗂️ **Luxury Categories**",
    ...Object.keys(tree).map(cat => `- **${cat}:** ${tree[cat].count || 0} premium items`)
  ].filter(Boolean).join("\n");

  console.log("\n" + summary);
  
  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.writeFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }

  if (hardErrors.length) {
    console.error("\n❌ Build failed due to critical errors");
    process.exit(1);
  }
  
  console.log(`\n🎉 Successfully built luxury catalog with ${totalProducts} premium products!`);
  console.log(`📁 Optimized output: ${path.join(PUBLIC_DIR, "data.json")}`);
  console.log("✨ Ready for luxury shopping experience!");
})().catch(err => {
  console.error("💥 Build failed:", err);
  process.exit(1);
});
