import { getContext, renderExtensionTemplateAsync } from '/scripts/extensions.js';

// Dynamically determine the module name/path for template loading
const getModuleName = () => {
    try {
        const url = import.meta.url;
        const match = url.match(/scripts\/extensions\/(.+)\/index\.js/);
        if (match) return match[1];
    } catch (e) {
        // Fallback
    }
    return 'st-mobile-theme-color';
};

const MODULE_NAME = getModuleName();


const defaultSettings = {
    colorVariable: '--SmartThemeChatTintColor',
    manualColor: '#000000',
    useManual: false,
    syncManifest: true,
};



let settings = { ...defaultSettings };

/**
 * Converts an RGBA color string to Hex.
 * @param {string} rgba - The RGBA color string.
 * @returns {string} - The Hex color string.
 */
function rgbaToHex(rgba) {
    if (!rgba) return '#000000';
    // Match both rgb and rgba
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return rgba;
    
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    
    // We ignore alpha for theme-color as it's not well supported for browser UI
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

let originalManifest = null;

/**
 * Updates the PWA manifest theme_color.
 * @param {string} color - The color to set in the manifest.
 */
async function updatePwaManifest(color) {
    if (!settings.syncManifest) return;

    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return;

    if (!originalManifest) {
        try {
            const response = await fetch(link.href);
            originalManifest = await response.json();
        } catch (e) {
            console.error('[Mobile Theme Color] Failed to fetch original manifest:', e);
            return;
        }
    }

    const updatedManifest = { ...originalManifest, theme_color: color };
    const blob = new Blob([JSON.stringify(updatedManifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(blob);
    
    // Revoke old object URL if it exists
    if (link.dataset.isBlob === 'true') {
        URL.revokeObjectURL(link.href);
    }
    
    link.href = manifestUrl;
    link.dataset.isBlob = 'true';
    console.log(`[Mobile Theme Color] PWA manifest updated with color: ${color}`);
}


/**
 * Updates the theme-color meta tag.
 */
function updateThemeColor() {
    let color;
    if (settings.useManual) {
        color = settings.manualColor;
    } else {
        const root = document.documentElement;
        const rawColor = getComputedStyle(root).getPropertyValue(settings.colorVariable).trim();
        color = rgbaToHex(rawColor);
    }

    if (!color) return;

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = color;
    console.log(`[Mobile Theme Color] Applied color: ${color}`);
    updatePwaManifest(color);
}


/**
 * Saves the extension settings.
 */
function saveSettings() {
    const context = getContext();
    context.extensionSettings[MODULE_NAME] = settings;
    
    if (typeof context.saveSettings === 'function') {
        context.saveSettings();
    } else if (typeof window.saveSettingsApp === 'function') {
        window.saveSettingsApp();
    }
}

/**
 * Initializes the settings UI.
 */
function initSettingsUI(html) {
    const $settings = $(html);
    
    // Bind "Use Manual" checkbox
    const $useManual = $settings.find('#st-mobile-theme-color-use-manual');
    $useManual.prop('checked', settings.useManual).on('change', function() {
        settings.useManual = !!$(this).prop('checked');
        $settings.find('.variable-group').toggleClass('hidden', settings.useManual);
        $settings.find('.manual-group').toggleClass('hidden', !settings.useManual);
        saveSettings();
        updateThemeColor();
    });

    // Initial visibility
    $settings.find('.variable-group').toggleClass('hidden', settings.useManual);
    $settings.find('.manual-group').toggleClass('hidden', !settings.useManual);

    // Bind Variable dropdown
    const $variable = $settings.find('#st-mobile-theme-color-variable');
    $variable.val(settings.colorVariable).on('change', function() {
        settings.colorVariable = $(this).val();
        saveSettings();
        updateThemeColor();
    });

    // Bind Manual Color Picker
    const $picker = $settings.find('#st-mobile-theme-color-picker');
    const $pickerValue = $settings.find('#st-mobile-theme-color-picker-value');
    
    $picker.attr('color', settings.manualColor);
    $pickerValue.text(settings.manualColor);

    $picker.on('change', function(e) {
        // toolcool-color-picker emits a 'change' event with detail
        const newColor = e.detail?.hex || e.target.value;
        if (newColor) {
            settings.manualColor = newColor;
            $pickerValue.text(newColor);
            saveSettings();
            updateThemeColor();
        }
    });

    // Bind "Sync Manifest" checkbox
    const $syncManifest = $settings.find('#st-mobile-theme-color-sync-manifest');
    $syncManifest.prop('checked', settings.syncManifest).on('change', function() {
        settings.syncManifest = !!$(this).prop('checked');
        saveSettings();
        updateThemeColor();
    });

    $('#extensions_settings').append($settings);

}

/**
 * Entry point for the extension.
 */
async function init() {
    const context = getContext();
    
    // Load settings
    if (context.extensionSettings[MODULE_NAME]) {
        settings = Object.assign(settings, context.extensionSettings[MODULE_NAME]);
    }

    // Load template
    try {
        const html = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
        initSettingsUI(html);
    } catch (e) {
        console.error('[Mobile Theme Color] Failed to load settings template:', e);
    }

    // Apply initial color
    updateThemeColor();

    // Listen for theme changes using MutationObserver on body class or data-theme
    // Many themes change classes on the body or variables on root.
    const observer = new MutationObserver(() => {
        updateThemeColor();
    });
    
    // Observe changes to documentElement (for CSS variable updates)
    observer.observe(document.documentElement, { 
        attributes: true, 
        attributeFilter: ['style', 'class'] 
    });

    // Also watch for SillyTavern specific events if possible
    context.eventSource.on(context.eventTypes.SETTINGS_LOADED, () => {
        updateThemeColor();
    });
}

jQuery(init);
