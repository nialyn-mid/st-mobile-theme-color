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

let debugMode = false;

/**
 * Safely updates the public/manifest.json file with new colors.
 * @param {string} themeColor - Hex color code
 * @param {string} bgColor - Hex color code
 */
function atomicUpdateManifest(themeColor, bgColor) {
    try {
        if (!fs.existsSync(manifestPath)) {
            if (debugMode) console.error('[Mobile Theme Color] manifest.json not found at:', manifestPath);
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
        if (debugMode) console.log(`[Mobile Theme Color] Successfully updated manifest.json: Theme=${themeColor}, BG=${bgColor}`);
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
    console.log('[Mobile Theme Color] Server plugin loaded.');

    // Status endpoint
    router.get('/status', (req, res) => {
        res.send({
            status: 'ok',
            version: '1.2.1',
            manifestExists: fs.existsSync(manifestPath),
            debugMode
        });
    });

    // Update endpoint (GET version to avoid CSRF issues)
    router.get('/sync', (req, res) => {
        const { themeColor, bgColor, debug } = req.query;
        
        // Update debug mode if provided
        if (debug !== undefined) {
            debugMode = debug === 'true' || debug === true;
        }

        if (debugMode) {
            console.log(`[Mobile Theme Color] Sync request received: Theme=${themeColor}, BG=${bgColor}, Debug=${debugMode}`);
        }
        
        if (!themeColor && !bgColor) {
            return res.status(200).send({ success: true, debugMode }); // Just updated debug mode
        }

        const success = atomicUpdateManifest(themeColor, bgColor);
        res.send({ success, debugMode });
    });

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
