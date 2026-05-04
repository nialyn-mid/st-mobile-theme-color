const fs = require('fs');
const path = require('path');

/**
 * Server-side plugin for Mobile Theme Color extension.
 * Provides a status API and an atomic manifest synchronization system.
 */

// Cache the SillyTavern root path
// In ST, plugins are in /plugins/folder/index.cjs
// So we go up 2 levels to reach the root
const stRoot = path.resolve(__dirname, '..', '..');
const manifestPath = path.resolve(stRoot, 'public', 'manifest.json');

/**
 * Safely updates the public/manifest.json file with new colors.
 * @param {string} themeColor - Hex color code
 * @param {string} bgColor - Hex color code
 */
function atomicUpdateManifest(themeColor, bgColor) {
    try {
        if (!fs.existsSync(manifestPath)) {
            console.error('[Mobile Theme Color] manifest.json not found at:', manifestPath);
            return false;
        }

        const raw = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(raw);

        // Update only the specific fields
        if (themeColor) manifest.theme_color = themeColor;
        if (bgColor) manifest.background_color = bgColor;

        // Verify JSON integrity before writing
        const updatedRaw = JSON.stringify(manifest, null, 4);
        JSON.parse(updatedRaw); // Final sanity check

        fs.writeFileSync(manifestPath, updatedRaw, 'utf8');
        console.log(`[Mobile Theme Color] Successfully updated manifest.json: Theme=${themeColor}, BG=${bgColor}`);
        return true;
    } catch (e) {
        console.error('[Mobile Theme Color] Failed to update manifest.json:', e.message);
        return false;
    }
}

/**
 * Initialize plugin.
 * @param {import('express').Router} router Express router
 */
async function init(router) {
    console.log('[Mobile Theme Color] Initializing server plugin...');
    console.log('[Mobile Theme Color] Target manifest path:', manifestPath);

    // Status endpoint
    router.get('/status', (req, res) => {
        res.send({
            status: 'ok',
            version: '1.2.0',
            manifestExists: fs.existsSync(manifestPath),
            path: manifestPath
        });
    });

    // Update endpoint (GET version to avoid CSRF issues)
    router.get('/sync', (req, res) => {
        const { themeColor, bgColor } = req.query;
        
        console.log(`[Mobile Theme Color] Sync request received: Theme=${themeColor}, BG=${bgColor}`);
        
        if (!themeColor && !bgColor) {
            return res.status(400).send({ error: 'No colors provided' });
        }

        const success = atomicUpdateManifest(themeColor, bgColor);
        res.send({ success });
    });

    console.log('[Mobile Theme Color] Server plugin initialized. Manifest sync ready.');
    return Promise.resolve();
}

async function exit() {
    return Promise.resolve();
}

module.exports = {
    init,
    exit,
    info: {
        id: 'st-mobile-theme-color',
        name: 'Mobile Theme Color Helper',
        description: 'Server-side manifest synchronization for zero-flash PWA theming.',
    },
};
