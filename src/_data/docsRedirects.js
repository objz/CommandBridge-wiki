const fs = require("fs");
const path = require("path");
const docVersions = require("./docVersions.js");

module.exports = function () {
  const docsDir = path.join(__dirname, "..", "docs");
  const versions = docVersions.versions.map((v) => v.id);

  // Collect all doc paths per version (relative to version dir)
  const pathsByVersion = {};
  for (const version of versions) {
    const versionDir = path.join(docsDir, version);
    if (!fs.existsSync(versionDir)) continue;
    pathsByVersion[version] = collectPaths(versionDir, "");
  }

  // For each unique path, find the best version (latest first)
  const allPaths = new Set();
  for (const paths of Object.values(pathsByVersion)) {
    for (const p of paths) allPaths.add(p);
  }

  const redirects = [];
  for (const docPath of allPaths) {
    // Skip index — already handled by src/docs/index.njk
    if (docPath === "/") continue;

    for (const version of versions) {
      if (pathsByVersion[version] && pathsByVersion[version].includes(docPath)) {
        redirects.push({
          docPath, // e.g. "/requirements/"
          targetUrl: `/docs/${version}${docPath}`,
        });
        break;
      }
    }
  }

  return redirects;
};

function collectPaths(dir, prefix) {
  const paths = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      paths.push(...collectPaths(path.join(dir, entry.name), `${prefix}/${entry.name}`));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const slug = entry.name === "index.md" ? "" : entry.name.replace(/\.md$/, "");
      const docPath = slug ? `${prefix}/${slug}/` : `${prefix}/`;
      paths.push(docPath);
    }
  }
  return paths;
}
