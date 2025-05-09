const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const pluginTOC = require("eleventy-plugin-toc")
const lucideIcons = require("@grimlink/eleventy-plugin-lucide-icons");
const nunjucks = require("nunjucks");
const fs = require("fs");
const path = require("path");

const md = new markdownIt({ html: true });

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

  eleventyConfig.setLibrary("md", markdownIt({ html: true }).use(markdownItAnchor, { tabIndex: false }));

  eleventyConfig.addFilter("markdown", (content) => {
    return md.render(content);
  });
  
  eleventyConfig.addPlugin(pluginTOC, {
    tags: ['h2', 'h3'],
  });

  eleventyConfig.addFilter("sortByOrderAndTitle", (values) => {
    let vals = [...values];
    return vals.sort((a, b) => {
      // Sort by order first
      const aOrder = typeof a.data.order === 'number' ? a.data.order : 0;
      const bOrder = typeof b.data.order === 'number' ? b.data.order : 0;
      const orderDiff = aOrder - bOrder;
      if (orderDiff !== 0) return orderDiff;
    
      // If order is the same, sort by title
      return a.data.title.localeCompare(b.data.title);
    })
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
  
  eleventyConfig.addCollection("menu", function(collectionApi) {
    const docs = collectionApi.getFilteredByGlob("src/docs/**/*.md");
    let menu = [];

    docs.sort((a, b) => {
      // Sort by order first
      const aOrder = typeof a.data.order === 'number' ? a.data.order : 0;
      const bOrder = typeof b.data.order === 'number' ? b.data.order : 0;
      const orderDiff = aOrder - bOrder;
      if (orderDiff !== 0) return orderDiff;
    
      // If order is the same, sort by title
      return a.data.title.localeCompare(b.data.title);
    })
    .forEach(doc => {
      const urlSegments = doc.url.split('/').filter(Boolean);
    
      // Add top-level items
      if (urlSegments.length === 1 || urlSegments.length === 2) {
        let menuItem = {
          title: doc.data.title,
          url: doc.url,
          children: []
        };
    
        // Add children
        docs.forEach(subDoc => {
          const subUrlSegments = subDoc.url.split('/').filter(Boolean);
          if (subUrlSegments.length === 3 && subUrlSegments[1] === urlSegments[1]) {
            menuItem.children.push({
              title: subDoc.data.title,
              url: subDoc.url
            });
          }
        });
    
        menu.push(menuItem);
      }
    });

    return menu;
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
  <div class="flex items-start gap-4 rounded-md p-4 ${s.bg} ${s.text}">
    <div class="flex-shrink-0 mt-[2px]">
      ${iconSvg}
    </div>
    <div class="prose prose-sm dark:prose-invert text-inherit">${stripped}</div>
  </div>
`;


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
