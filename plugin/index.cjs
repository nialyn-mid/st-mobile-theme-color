const fs = require('fs');
const path = require('path');

/**
 * Server-side plugin for Mobile Theme Color extension.
 * Provides a status API and helper functions.
 */

/**
 * Initialize plugin.
 * @param {import('express').Router} router Express router
 * @returns {Promise<void>}
 */
async function init(router) {
    // Status endpoint for the frontend to verify the plugin is active
    router.get('/status', (req, res) => {
        res.send({
            status: 'ok',
            version: '1.0.1',
            message: 'Mobile Theme Color server component is active'
        });
    });

    // Cache for the original manifest
    let cachedManifest = null;

    // Manifest endpoint
    router.get('/manifest.json', (req, res) => {
        try {
            // Find the original manifest (relative to ST root)
            // __dirname is SillyTavern/plugins/st-mobile-theme-color
            const stRoot = path.join(__dirname, '..', '..');
            const manifestPath = path.join(stRoot, 'public', 'manifest.json');
            
            if (!cachedManifest && fs.existsSync(manifestPath)) {
                cachedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            }

            if (!cachedManifest) {
                return res.status(404).send('Original manifest not found');
            }

            // Merge colors from query parameters
            const themeColor = req.query.color;
            const bgColor = req.query.bg;

            const finalManifest = { ...cachedManifest };
            if (themeColor) finalManifest.theme_color = themeColor;
            if (bgColor) finalManifest.background_color = bgColor;

            res.json(finalManifest);
        } catch (e) {
            res.status(500).send(e.message);
        }
    });

    console.log('[Mobile Theme Color] Server plugin initialized with dynamic manifest support.');
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
        description: 'Server-side support for early theme color injection and settings synchronization.',
    },
};
