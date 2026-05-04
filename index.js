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
    bgColorVariable: '--SmartThemeBodyColor',
    manualBgColor: '#000000',
    useManualBg: false,
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
 * Updates the PWA manifest theme_color and background_color.
 * @param {string} themeColor - The theme color.
 * @param {string} bgColor - The background color.
 */
async function updatePwaManifest(themeColor, bgColor) {
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

    const updatedManifest = { 
        ...originalManifest, 
        theme_color: themeColor,
        background_color: bgColor
    };
    const blob = new Blob([JSON.stringify(updatedManifest)], { type: 'application/manifest+json' });
    const manifestUrl = URL.createObjectURL(blob);
    
    // Revoke old object URL if it exists
    if (link.dataset.isBlob === 'true') {
        URL.revokeObjectURL(link.href);
    }
    
    // Remove and re-add link to force refresh
    const newLink = link.cloneNode();
    newLink.href = manifestUrl;
    newLink.dataset.isBlob = 'true';
    link.parentNode.replaceChild(newLink, link);
    
    console.log(`[Mobile Theme Color] PWA manifest updated and refreshed. Theme: ${themeColor}, BG: ${bgColor}`);
}




/**
 * Updates the theme-color meta tag and manifest.
 */
function updateThemeColor() {
    const root = document.documentElement;
    
    // Resolve theme color
    let themeColor;
    if (settings.useManual) {
        themeColor = settings.manualColor;
    } else {
        const rawColor = getComputedStyle(root).getPropertyValue(settings.colorVariable).trim();
        themeColor = rgbaToHex(rawColor);
    }

    // Resolve background color
    let bgColor;
    if (settings.useManualBg) {
        bgColor = settings.manualBgColor;
    } else {
        const rawBgColor = getComputedStyle(root).getPropertyValue(settings.bgColorVariable).trim();
        bgColor = rgbaToHex(rawBgColor);
    }

    if (!themeColor) return;

    // Update meta tag
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = themeColor;
    
    console.log(`[Mobile Theme Color] Applied meta color: ${themeColor}`);
    updatePwaManifest(themeColor, bgColor || themeColor);
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

    // --- Background Color ---
    const $useManualBg = $settings.find('#st-mobile-theme-color-use-manual-bg');
    $useManualBg.prop('checked', settings.useManualBg).on('change', function() {
        settings.useManualBg = !!$(this).prop('checked');
        $settings.find('.bg-variable-group').toggleClass('hidden', settings.useManualBg);
        $settings.find('.bg-manual-group').toggleClass('hidden', !settings.useManualBg);
        saveSettings();
        updateThemeColor();
    });

    $settings.find('.bg-variable-group').toggleClass('hidden', settings.useManualBg);
    $settings.find('.bg-manual-group').toggleClass('hidden', !settings.useManualBg);

    const $bgColorVariable = $settings.find('#st-mobile-theme-color-bg-variable');
    $bgColorVariable.val(settings.bgColorVariable).on('change', function() {
        settings.bgColorVariable = $(this).val();
        saveSettings();
        updateThemeColor();
    });

    const $bgPicker = $settings.find('#st-mobile-theme-color-bg-picker');
    const $bgPickerValue = $settings.find('#st-mobile-theme-color-bg-picker-value');
    $bgPicker.attr('color', settings.manualBgColor);
    $bgPickerValue.text(settings.manualBgColor);

    $bgPicker.on('change', function(e) {
        const newColor = e.detail?.hex || e.target.value;
        if (newColor) {
            settings.manualBgColor = newColor;
            $bgPickerValue.text(newColor);
            saveSettings();
            updateThemeColor();
        }
    });

    // --- Manifest Sync ---
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
