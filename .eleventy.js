const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItTaskLists = require("markdown-it-task-lists");
const pluginTOC = require("eleventy-plugin-toc")
const lucideIcons = require("@grimlink/eleventy-plugin-lucide-icons");
const nunjucks = require("nunjucks");
const fs = require("fs");
const path = require("path");
const docVersions = require("./src/_data/docVersions.js");

const md = new markdownIt({ html: true });

const INTERNAL_DOC_VERSIONS = docVersions.versions.filter((version) => !version.externalUrl);

function sortDocsByOrderAndTitle(a, b) {
  const aOrder = typeof a.data.order === "number" ? a.data.order : 0;
  const bOrder = typeof b.data.order === "number" ? b.data.order : 0;
  const orderDiff = aOrder - bOrder;
  if (orderDiff !== 0) return orderDiff;
  return a.data.title.localeCompare(b.data.title);
}

function detectDocsVersionFromUrl(url) {
  if (typeof url !== "string" || !url.startsWith("/docs")) {
    return docVersions.latest;
  }

  const sortedVersions = [...INTERNAL_DOC_VERSIONS].sort(
    (a, b) => b.pathPrefix.length - a.pathPrefix.length
  );

  const normalizedUrl = url.endsWith("/") ? url : `${url}/`;
  const matched = sortedVersions.find((version) => {
    const normalizedPrefix = version.pathPrefix.endsWith("/")
      ? version.pathPrefix
      : `${version.pathPrefix}/`;
    return normalizedUrl.startsWith(normalizedPrefix);
  });

  return matched ? matched.id : docVersions.latest;
}

function extractDocsPath(url) {
  if (typeof url !== "string") return "/";

  const sortedVersions = [...INTERNAL_DOC_VERSIONS].sort(
    (a, b) => b.pathPrefix.length - a.pathPrefix.length
  );

  for (const version of sortedVersions) {
    if (url === version.pathPrefix || url === `${version.pathPrefix}/`) {
      return "/";
    }

    const prefixWithSlash = `${version.pathPrefix}/`;
    if (url.startsWith(prefixWithSlash)) {
      const remaining = url.slice(version.pathPrefix.length);
      return remaining.startsWith("/") ? remaining : `/${remaining}`;
    }
  }

  return "/";
}

function buildDocsUrl(versionId, docsPath = "/") {
  const version = INTERNAL_DOC_VERSIONS.find((item) => item.id === versionId);
  if (!version) return "/docs/";

  const normalizedPath = docsPath.startsWith("/") ? docsPath : `/${docsPath}`;
  if (normalizedPath === "/") {
    return `${version.pathPrefix}/`;
  }

  return `${version.pathPrefix}${normalizedPath}`;
}

function buildDocsMenuForVersion(docs, versionId) {
  const docsForVersion = docs
    .filter((doc) => (doc.data.docVersion || docVersions.latest) === versionId)
    .sort(sortDocsByOrderAndTitle);

  return docsForVersion
    .filter((doc) => extractDocsPath(doc.url).split("/").filter(Boolean).length <= 1)
    .map((doc) => {
      const relativeSegments = extractDocsPath(doc.url).split("/").filter(Boolean);

      const children =
        relativeSegments.length === 1
          ? docsForVersion
              .filter((childDoc) => {
                const childSegments = extractDocsPath(childDoc.url).split("/").filter(Boolean);
                return childSegments.length === 2 && childSegments[0] === relativeSegments[0];
              })
              .sort(sortDocsByOrderAndTitle)
              .map((childDoc) => ({
                title: childDoc.data.title,
                url: childDoc.url,
              }))
          : [];

      return {
        title: doc.data.title,
        url: doc.url,
        children,
      };
    });
}

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
     "src/media": "/media",
     "src/assets": "/",
     "node_modules/alpinejs/dist/cdn.min.js": "js/alpine.js",
     "node_modules/htmx.org/dist/htmx.min.js": "js/htmx.js",
     "src/lib": "/lib",
  });

  eleventyConfig.addShortcode("now", () => `${Date.now()}`);

  eleventyConfig.addPlugin(lucideIcons);

  eleventyConfig.setLibrary("md", markdownIt({ html: true })
    .use(markdownItAnchor, { tabIndex: false })
    .use(markdownItTaskLists)
  );

  eleventyConfig.addFilter("markdown", (content) => {
    return md.render(content);
  });
  
  eleventyConfig.addPlugin(pluginTOC, {
    tags: ['h2', 'h3'],
  });

  eleventyConfig.addFilter("sortByOrderAndTitle", (values) => {
    let vals = [...values];
    return vals.sort(sortDocsByOrderAndTitle)
  });

  eleventyConfig.addFilter("sortByUrl", (values) => {
    let vals = [...values];
    return vals.sort((a, b) => Math.sign(a.url.localeCompare(b.url)));
  });

  eleventyConfig.addNunjucksFilter("getNextPrevMenu", function(menu, currentUrl) {
    let flatMenu = [];
    menu.forEach(item => {
      flatMenu.push(item);
      if (item.children) {
        item.children.forEach(child => {
          flatMenu.push(child);
        });
      }
    });
  
    const currentIndex = flatMenu.findIndex(item => item.url === currentUrl);
    const previousItem = currentIndex > 0 ? flatMenu[currentIndex - 1] : null;
    const nextItem = currentIndex < flatMenu.length - 1 ? flatMenu[currentIndex + 1] : null;
  
    return { previous: previousItem, next: nextItem };
  });

  eleventyConfig.addFilter("docsVersionFromUrl", function (url) {
    return detectDocsVersionFromUrl(url);
  });

  eleventyConfig.addFilter("docsUrlForVersion", function (url, versionId) {
    const selectedVersion = docVersions.versions.find((version) => version.id === versionId);
    if (!selectedVersion) return "/docs/";
    if (selectedVersion.externalUrl) return selectedVersion.externalUrl;

    const docsPath = extractDocsPath(url);
    return buildDocsUrl(versionId, docsPath);
  });

  eleventyConfig.addFilter("docsMenuForVersion", function (docs, versionId) {
    if (!Array.isArray(docs)) return [];
    return buildDocsMenuForVersion(docs, versionId || docVersions.latest);
  });

  eleventyConfig.addFilter("rewriteDocsLinks", function (content, versionId) {
    if (typeof content !== "string" || !versionId || versionId === docVersions.latest) {
      return content;
    }

    const targetPrefix = buildDocsUrl(versionId, "/").replace(/\/$/, "");
    return content.replace(
      /href=(['"])\/docs(?!\/\d+\.\d+\.\d+)(\/[^'"#?]*)?([?#][^'"]*)?\1/g,
      (match, quote, pathPart = "", queryOrHash = "") => {
        return `href=${quote}${targetPrefix}${pathPart}${queryOrHash}${quote}`;
      }
    );
  });
  
eleventyConfig.addPairedShortcode("hint", function (content, style = "info") {
  const styles = {
    info: {
      bg: "bg-blue-100 dark:bg-blue-900/40",
      text: "text-blue-900 dark:text-blue-200",
      icon: "info.svg",
    },
    warning: {
      bg: "bg-orange-100 dark:bg-orange-400/20",
      text: "text-yellow-900 dark:text-yellow-200",
      icon: "warning.svg",
    },
    danger: {
      bg: "bg-red-100 dark:bg-red-900/40",
      text: "text-red-900 dark:text-red-200",
      icon: "danger.svg",
    },
    success: {
      bg: "bg-green-200 dark:bg-green-500/30",
      text: "text-green-900 dark:text-green-200",
      icon: "success.svg",
    },
  };

  const s = styles[style] || styles.info;
  const rendered = md.render(content.trim());
 
const stripped = rendered.match(/^<p>(.*?)<\/p>$/s)
  ? rendered.replace(/^<p>(.*?)<\/p>$/s, '$1')
  : rendered;

  const svgPath = path.join(__dirname, "src/media/svg", s.icon);
  let iconSvg = fs.readFileSync(svgPath, "utf-8");

  iconSvg = iconSvg.replace(
    /<svg([^>]+)>/,
    `<svg$1 class="w-4 h-4 mt-[1px] flex-shrink-0 ${s.text}">`
  );



return `
  <div class="flex items-start gap-4 rounded-md p-4 my-6 ${s.bg} ${s.text}">
    <div class="flex-shrink-0 mt-[2px]">
      ${iconSvg}
    </div>
    <div class="prose prose-sm dark:prose-invert text-inherit">${stripped}</div>
  </div>
`;


});


  // Tabs shortcode: {% tabs %}{% tab "Label" %}content{% endtab %}{% endtabs %}
  eleventyConfig.addPairedShortcode("tabs", function (content) {
    // Extract tab blocks from the rendered content
    const tabRegex = /<!--tab:(.+?)-->([\s\S]*?)<!--\/tab-->/g;
    let tabs = [];
    let match;
    while ((match = tabRegex.exec(content)) !== null) {
      tabs.push({ label: match[1], content: match[2].trim() });
    }
    if (tabs.length === 0) return content;

    const id = "tabs-" + Math.random().toString(36).slice(2, 8);
    const buttons = tabs.map((t, i) =>
      `<button @click="active = ${i}" :class="active === ${i} ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'" class="px-4 py-2 text-sm font-medium border-b-2 transition-colors">${t.label}</button>`
    ).join("\n");
    const panels = tabs.map((t, i) =>
      `<div x-show="active === ${i}" x-cloak>${md.render(t.content)}</div>`
    ).join("\n");

    return `<div x-data="{ active: 0 }" class="my-4">
  <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4">${buttons}</div>
  <div class="prose dark:prose-invert">${panels}</div>
</div>`;
  });

  eleventyConfig.addPairedShortcode("tab", function (content, label) {
    return `<!--tab:${label}-->${content}<!--/tab-->`;
  });

  return {
    dir: {
      input: "src",
      output: "_site"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  }
};
