const fs = require('fs');
const path = require('path');

/**
 * Installation script for the Mobile Theme Color server component.
 * This script:
 * 1. Finds the SillyTavern root directory.
 * 2. Enables server plugins in config.yaml.
 * 3. Copies the plugin files to the plugins/ directory.
 * 4. Patches index.html for early-load color injection.
 */

const EXTENSION_NAME = 'st-mobile-theme-color';

async function install() {
    console.log('--- Mobile Theme Color: Server Component Installer ---');

    // 1. Find SillyTavern root
    let stRoot = findStRoot(process.cwd());
    if (!stRoot) {
        console.error('Error: Could not find SillyTavern root directory. Please run this script from within the SillyTavern folder structure.');
        process.exit(1);
    }
    console.log(`Detected SillyTavern root: ${stRoot}`);

    const configPath = path.join(stRoot, 'config.yaml');
    const pluginsDir = path.join(stRoot, 'plugins');
    const targetPluginDir = path.join(pluginsDir, EXTENSION_NAME);
    const indexHtmlPath = path.join(stRoot, 'public', 'index.html');

    // 2. Enable server plugins in config.yaml
    try {
        let config = fs.readFileSync(configPath, 'utf8');
        if (config.includes('enableServerPlugins: false')) {
            console.log('Enabling server plugins in config.yaml...');
            config = config.replace('enableServerPlugins: false', 'enableServerPlugins: true');
            fs.writeFileSync(configPath, config, 'utf8');
            console.log('Successfully enabled server plugins.');
        } else if (config.includes('enableServerPlugins: true')) {
            console.log('Server plugins are already enabled.');
        } else {
            console.log('Warning: Could not find enableServerPlugins setting in config.yaml. Please ensure it is set to true manually.');
        }
    } catch (e) {
        console.error(`Error updating config.yaml: ${e.message}`);
    }

    // 3. Create plugins directory if it doesn't exist
    if (!fs.existsSync(pluginsDir)) {
        console.log('Creating plugins directory...');
        fs.mkdirSync(pluginsDir);
    }

    // 4. Copy plugin files
    try {
        if (!fs.existsSync(targetPluginDir)) {
            fs.mkdirSync(targetPluginDir);
        }
        
        const sourcePluginDir = path.join(__dirname, '..', 'plugin');
        const sourceIndex = fs.existsSync(path.join(sourcePluginDir, 'index.cjs')) ? 'index.cjs' : 'index.js';
        
        // Remove old index.js if it exists to avoid conflicts
        const oldIndexPath = path.join(targetPluginDir, 'index.js');
        if (fs.existsSync(oldIndexPath)) {
            fs.unlinkSync(oldIndexPath);
        }
        
        fs.copyFileSync(path.join(sourcePluginDir, sourceIndex), path.join(targetPluginDir, 'index.cjs'));
        console.log(`Copied server plugin to ${targetPluginDir} as index.cjs`);
    } catch (e) {
        console.error(`Error copying plugin files: ${e.message}`);
    }

    // 5. Patch index.html for early-load injection
    try {
        let html = fs.readFileSync(indexHtmlPath, 'utf8');
        
        // Remove old injection if exists
        html = html.replace(/<!-- st-mobile-theme-color injection -->[\s\S]*?<!-- \/st-mobile-theme-color injection -->/g, '');
        
        const patch = '<!-- st-mobile-theme-color injection -->\n' +
            '    <script>\n' +
            '        (function() {\n' +
            '            try {\n' +
            '                const lastColor = localStorage.getItem(\'st-mobile-theme-color-last\');\n' +
            '                if (lastColor) {\n' +
            '                    let meta = document.querySelector(\'meta[name="theme-color"]\');\n' +
            '                    if (!meta) {\n' +
            '                        meta = document.createElement(\'meta\');\n' +
            '                        meta.name = \'theme-color\';\n' +
            '                        document.head.appendChild(meta);\n' +
            '                    }\n' +
            '                    meta.content = lastColor;\n' +
            '                }\n' +
            '                // Update manifest link to point to our dynamic endpoint with cached colors\n' +
            '                const link = document.querySelector(\'link[rel="manifest"]\');\n' +
            '                if (link) {\n' +
            '                    const bgColor = localStorage.getItem(\'st-mobile-theme-color-bg-last\') || lastColor;\n' +
            '                    if (lastColor) {\n' +
            '                        link.href = \'/api/plugins/st-mobile-theme-color/manifest.json?color=\' + encodeURIComponent(lastColor) + \'&bg=\' + encodeURIComponent(bgColor || lastColor);\n' +
            '                    }\n' +
            '                }\n' +
            '            } catch (e) {}\n' +
            '        })();\n' +
            '    </script>\n' +
            '    <!-- /st-mobile-theme-color injection -->';
        
        if (!html.includes('st-mobile-theme-color injection')) {
            html = html.replace('<head>', '<head>\n    ' + patch);
            fs.writeFileSync(indexHtmlPath, html, 'utf8');
            console.log('Successfully patched index.html.');
        } else {
            console.log('index.html is already patched.');
        }
    } catch (e) {
        console.error(`Error patching index.html: ${e.message}`);
    }

    console.log('\n--- Installation Complete! ---');
    console.log('Please RESTART your SillyTavern server to apply the changes.');
    console.log('After restarting, refresh your browser and check the extension settings.');
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
