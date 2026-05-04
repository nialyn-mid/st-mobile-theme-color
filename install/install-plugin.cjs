const fs = require('fs');
const path = require('path');

/**
 * Mobile Theme Color: Server Component Installer
 * This script enables server-side features and cleans up old patches.
 * Optimized to be zero-dependency (no js-yaml required).
 */

async function install() {
    console.log('--- Mobile Theme Color: Server Component Installer ---');

    const stRoot = findStRoot(process.cwd());
    if (!stRoot) {
        console.error('Error: Could not find SillyTavern root directory.');
        console.log('Please run this script from within your SillyTavern folder.');
        return;
    }

    console.log(`Detected SillyTavern root: ${stRoot}`);

    // 1. Enable server plugins in config.yaml using regex (zero-dependency)
    try {
        const configPath = path.join(stRoot, 'config.yaml');
        if (fs.existsSync(configPath)) {
            let configText = fs.readFileSync(configPath, 'utf8');
            
            // Look for enableServerPlugins: false and change to true
            if (configText.includes('enableServerPlugins: false')) {
                console.log('Enabling server plugins in config.yaml...');
                configText = configText.replace(/enableServerPlugins:\s*false/g, 'enableServerPlugins: true');
                fs.writeFileSync(configPath, configText, 'utf8');
                console.log('Successfully enabled server plugins.');
            } else if (configText.includes('enableServerPlugins: true')) {
                console.log('Server plugins already enabled.');
            } else {
                // If the key doesn't exist, append it (unlikely in modern ST)
                console.log('enableServerPlugins key not found, adding it...');
                configText += '\nenableServerPlugins: true\n';
                fs.writeFileSync(configPath, configText, 'utf8');
            }
        }
    } catch (e) {
        console.error(`Error updating config.yaml: ${e.message}`);
    }

    // 2. Setup server plugin directory
    const pluginTargetDir = path.join(stRoot, 'plugins', 'st-mobile-theme-color');
    try {
        if (!fs.existsSync(pluginTargetDir)) {
            fs.mkdirSync(pluginTargetDir, { recursive: true });
        }

        // Copy index.cjs
        const sourceFile = path.join(__dirname, '..', 'plugin', 'index.cjs');
        if (fs.existsSync(sourceFile)) {
            fs.copyFileSync(sourceFile, path.join(pluginTargetDir, 'index.cjs'));
            console.log(`Copied server plugin to ${pluginTargetDir}`);
            
            // Clean up old index.js if it exists in the plugin dir to avoid conflicts
            const oldJs = path.join(pluginTargetDir, 'index.js');
            if (fs.existsSync(oldJs)) {
                fs.unlinkSync(oldJs);
            }
        }
    } catch (e) {
        console.error(`Error setting up plugin directory: ${e.message}`);
    }

    // 3. CLEANUP: Restore index.html if it was patched
    try {
        const indexHtmlPath = path.join(stRoot, 'public', 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
            let html = fs.readFileSync(indexHtmlPath, 'utf8');
            const oldHtml = html;
            
            // Clean up various injection styles
            html = html.replace(/<!-- st-mobile-theme-color injection -->[\s\S]*?<!-- \/st-mobile-theme-color injection -->/g, '');
            html = html.replace(/<!-- ST-MOBILE-THEME-COLOR-START -->[\s\S]*?<!-- ST-MOBILE-THEME-COLOR-END -->/g, '');
            
            // Restore manifest link if we replaced it with a script
            const scriptRegex = /<script>[\s\S]*?manifest\.json[\s\S]*?<\/script>/g;
            if (html.match(scriptRegex)) {
                html = html.replace(scriptRegex, '<link rel="manifest" crossorigin="use-credentials" href="manifest.json">');
            }

            if (html !== oldHtml) {
                fs.writeFileSync(indexHtmlPath, html, 'utf8');
                console.log('Restored index.html to original state (removed patches).');
            }
        }
    } catch (e) {
        console.error(`Error cleaning up index.html: ${e.message}`);
    }

    console.log('\n--- Installation Complete! ---');
    console.log('The extension will now manage manifest.json directly on the server.');
    console.log('Please RESTART your SillyTavern server to apply the changes.');
}

function findStRoot(startPath) {
    let current = startPath;
    while (current !== path.parse(current).root) {
        if (fs.existsSync(path.join(current, 'config.yaml')) && fs.existsSync(path.join(current, 'server.js'))) {
            return current;
        }
        current = path.dirname(current);
    }
    return null;
}

install();
