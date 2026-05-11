import { injectHtmlComponentTagger } from './htmlTagger';
import { ComponentTagOptions } from '../types';
import { verboseLog } from '../utils';

const args = process.argv.slice(2);
const options: ComponentTagOptions = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--output-dir' && args.length > i + 1) {
    options.outputDir = args[i + 1];
    i++;
  } else if (args[i] === '--injector-script-name' && args.length > i + 1) {
    options.injectorScriptName = args[i + 1];
    i++;
  } else if (args[i] === '--attribute-prefix' && args.length > i + 1) {
    options.attributePrefix = args[i + 1];
    i++;
  } else if (args[i] === '--inspector-script-name' && args.length > i + 1) {
    options.inspectorScriptName = args[i + 1];
    i++;
  }
}

// Run the HTML tagger
try {
  const result = injectHtmlComponentTagger(options);
  verboseLog(`[component-tagger] Summary:`, options);
  verboseLog(`  - Total HTML files found: ${result.totalFiles}`, options);
  verboseLog(`  - Files processed: ${result.processedFiles}`, options);
  verboseLog(
    `  - Files with script injected: ${result.injectedFiles}`,
    options,
  );
  verboseLog(`  - Script location: ${result.scriptPath}`, options);
} catch (error) {
  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(`[component-tagger] Error: ${error.message}`);
  }

  process.exit(1);
}
