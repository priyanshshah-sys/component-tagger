import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { ComponentTagOptions } from '../types';
import { verboseLog } from '../utils';

/**
 * Statistics for HTML component tagging
 */
interface HtmlTagStats {
  totalFiles: number;
  processedFiles: number;
  injectedFiles: number;
  scriptPath: string;
}

/**
 * Creates the browser script content with configuration values
 * @param options Plugin options
 * @returns The browser script content
 */
function createBrowserScript(options: ComponentTagOptions): string {
  // Base browser script template
  const browserScript = `
(function() {
  // Configuration
  const CONFIG = {
    attributePrefix: '${options.attributePrefix || 'data-component'}',
    includeContentAttribute: ${options.includeContentAttribute !== false},
    maxContentLength: ${options.maxContentLength || 2000},
    includeLegacyAttributes: ${options.includeLegacyAttributes !== false},
    includeElements: ${JSON.stringify(options.includeElements || [])},
    excludeElements: ${JSON.stringify(options.excludeElements || [])},
  };

  const TAG_SHOULD_EXCLUDE = [
  "base",
  "object",
  "link",
  "meta",
  "noscript",
  "script",
  "style",
  "title",
  "animate",
  "animateMotion",
  "animateTransform",
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "filter",
  "foreignObject",
  "g",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "metadata",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "set",
  "stop",
  "switch",
  "symbol",
  "text",
  "textPath",
  "tspan",
  "use",
  "view",
  "body",
  "param",
]

  // Map to track per-class indices for unique component IDs
  const classIndexMap = new Map();

  /**
   * Sanitizes attribute values to prevent XSS
   */
  function sanitizeAttributeValue(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Creates a component ID based on class name and index
   */
  function createComponentId(el) {

    const path = [];
    let current = el;

    while (current && current.parentElement) {
      const siblings = Array.from(current.parentElement.children)
        .filter(child => child.tagName);
      const index = siblings.indexOf(current);
      path.unshift(index);
      current = current.parentElement;

      if (current.tagName === 'BODY') break;
    }

    const line = path.join('-')

    return sanitizeAttributeValue(line);
  }

  /**
   * Extracts text content from an element
   */
  function extractTextContent(element) {
    let text = '';
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent.trim() + ' ';
      }
    }
    return text.trim();
  }

  /**
   * Extracts attributes from an element
   */
  function extractAttributes(element) {
    const attributes = {};
    const defaultAttrs = [
      'class', 'id', 'src', 'alt', 'href', 'type', 'name', 'value'
    ];

    // Extract default attributes
    for (const attr of defaultAttrs) {
      if (element.hasAttribute(attr)) {
        if (attr === 'class') {
          attributes['className'] = element.getAttribute(attr);
        } else {
          attributes[attr] = element.getAttribute(attr);
        }
      }
    }

    const textContent = extractTextContent(element);
    if (textContent) {
      attributes['textContent'] = textContent;
    }

    return attributes;
  }

  /**
   * Determines if an element should be tagged
   */
  function shouldTagElement(element) {
    // Skip non-element nodes
    if (element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const tagName = element.tagName.toLowerCase();

    if (CONFIG.includeElements.length > 0) {
      return CONFIG.includeElements.includes(tagName);
    }

    if (CONFIG.excludeElements.includes(tagName) || TAG_SHOULD_EXCLUDE.includes(tagName)) {
      return false;
    }

    return true;
  }

  /**
   * Tags an element with component metadata
   */
  function tagElement(element) {
    // Skip if already tagged
    if (element.hasAttribute(\`\${CONFIG.attributePrefix}-id\`)) {
      return;
    }

    // Get element name
    const elementName = element.tagName.toLowerCase();

    // Create component ID
    const componentId = createComponentId(element);

    // Set ID attribute
    element.setAttribute(\`\${CONFIG.attributePrefix}-id\`, componentId);

    // Add legacy attributes if enabled
    if (CONFIG.includeLegacyAttributes) {
      element.setAttribute(\`\${CONFIG.attributePrefix}-path\`, window.location.pathname);
      element.setAttribute(\`\${CONFIG.attributePrefix}-name\`, elementName);
      element.setAttribute(\`\${CONFIG.attributePrefix}-file\`, window.location.pathname.split('/').pop());
    }

    // Add content attribute if enabled
    if (CONFIG.includeContentAttribute) {
      const attributes = extractAttributes(element);
      const content = {
        elementName,
        ...attributes
      };

      let encodedContent = encodeURIComponent(JSON.stringify(content));

      // Truncate if needed
      if (encodedContent.length > CONFIG.maxContentLength) {
        encodedContent = encodedContent.substring(0, CONFIG.maxContentLength) + '...';
      }

      element.setAttribute(\`\${CONFIG.attributePrefix}-content\`, encodedContent);
    }
  }

  /**
   * Process all elements in the document
   */
  function processAllElements() {
    const elements = document.querySelectorAll('*');
    let taggedCount = 0;

    elements.forEach((element, index) => {
      if (shouldTagElement(element)) {
        tagElement(element, index);
        taggedCount++;
      }
    });

  }

  /**
   * Initialize the component tagger
   */
  function initialize() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', processAllElements);
    } else {
      processAllElements();
    }

    // Also process on dynamic content changes
    const observer = new MutationObserver((mutations) => {

        for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (shouldTagElement(node)) {
                tagElement(node);
                }

                // Process child elements
                const childElements = node.querySelectorAll('*');
                for (const child of childElements) {
                if (shouldTagElement(child)) {
                    tagElement(child);
                }
                }
            }
            }
        }
        }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Start the component tagger
  initialize();
})();
`;

  return browserScript;
}

/**
 * Injects the component tagger script into HTML files
 * @param options Configuration options
 * @returns Statistics about the injection process
 */
export function injectHtmlComponentTagger(
  options: ComponentTagOptions = {},
): HtmlTagStats {
  const pluginOptions: ComponentTagOptions = {
    extensions: ['.html', '.htm'],
    verbose: false,
    attributePrefix: 'data-component',
    includeContentAttribute: true,
    maxContentLength: 1000,
    includeLegacyAttributes: true,
    excludeDirectories: [],
    processNodeModules: false,
    outputDir: 'public',
    injectorScriptName: 'dhws-data-injector.js',
    inspectorScriptName: 'dhws-web-inspector.js',
    errorTrackerScriptName: 'dhws-error-tracker.js',
    ...options,
  };

  const cwd = process.cwd();
  const stats: HtmlTagStats = {
    totalFiles: 0,
    processedFiles: 0,
    injectedFiles: 0,
    scriptPath: '',
  };

  verboseLog('HTML component tagger started', pluginOptions);

  const browserScriptContent = createBrowserScript(pluginOptions);

  const outputDir = path.resolve(cwd, options.outputDir || 'public');
  if (!fs.existsSync(outputDir)) {
    verboseLog(`Creating directory: ${outputDir}`, pluginOptions);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const scriptName = options.injectorScriptName || 'dhws-data-injector.js';
  const outputFile = path.join(outputDir, scriptName);
  verboseLog(`Writing script to: ${outputFile}`, pluginOptions);
  fs.writeFileSync(outputFile, browserScriptContent);
  stats.scriptPath = outputFile;

  const extensions = pluginOptions.extensions as string[];
  const extensionPattern = `**/*{${extensions.join(',')}}`;

  const htmlFiles = fg.sync(extensionPattern, {
    cwd,
    ignore: [
      'node_modules/**',
      ...(pluginOptions.excludeDirectories as string[]).map(
        (dir) => `${dir}/**`,
      ),
    ],
  });

  stats.totalFiles = htmlFiles.length;
  verboseLog(`Found ${htmlFiles.length} HTML files to process`, pluginOptions);

  htmlFiles.forEach((htmlFile) => {
    const filePath = path.join(cwd, htmlFile);
    let content = fs.readFileSync(filePath, 'utf8');
    stats.processedFiles++;

    const injectorScriptPath = (() => {
      const relativePath = path
        .relative(path.dirname(filePath), outputFile)
        .replace(/\\/g, '/');
      return !relativePath.startsWith('/') && !relativePath.startsWith('../')
        ? `/${relativePath}`
        : relativePath;
    })();

    const hasInjector = content.includes('dhws-dataInjector');

    const injectorScriptTag = `<script id="dhws-dataInjector" src="${injectorScriptPath}"></script>`;

    if (hasInjector) {
      verboseLog(`Script already injected in: ${htmlFile}`, pluginOptions);
    } else {
      stats.injectedFiles++;
      const scriptsToAdd = `${injectorScriptTag}\n`;
      if (content.includes('</body>')) {
        content = content.replace('</body>', `${scriptsToAdd}</body>`);
      } else {
        content += `\n${scriptsToAdd}`;
      }
      fs.writeFileSync(filePath, content);
    }
  });

  verboseLog(
    `HTML component tagger completed:
  - Total files scanned: ${stats.totalFiles}
  - Files processed: ${stats.processedFiles}
  - Files with script injected: ${stats.injectedFiles}
  - Script location: ${stats.scriptPath}`,
    pluginOptions,
  );

  return stats;
}
