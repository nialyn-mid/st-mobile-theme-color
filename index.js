import { getContext, renderExtensionTemplateAsync } from '/scripts/extensions.js';
import { logger, setLogLevel, LOG_LEVELS } from './js/logger.js';

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

// Pre-apply last known color from localStorage to avoid flash of wrong color
(function preApplyColor() {
    try {
        const lastColor = localStorage.getItem('st-mobile-theme-color-last');
        if (lastColor) {
            let meta = document.querySelector('meta[name="theme-color"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'theme-color';
                document.head.appendChild(meta);
            }
            meta.content = lastColor;
        }
    } catch (e) {
        // Ignore localStorage errors
    }
})();

const defaultSettings = {
    colorVariable: '--SmartThemeChatTintColor',
    manualColor: '#000000',
    useManual: false,
    bgColorVariable: '--SmartThemeChatTintColor',
    manualBgColor: '#000000',
    useManualBg: false,
    syncManifest: true,
    logLevel: LOG_LEVELS.WARN,
};

let settings = { ...defaultSettings };

/**
 * Converts an RGBA color string to Hex.
 * @param {string} rgba - The RGBA color string.
 * @returns {string} - The Hex color string.
 */
function rgbaToHex(rgba) {
    if (!rgba) return null;
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
let manifestBaseUrl = null;

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
            const manifestUrl = new URL(link.getAttribute('href'), window.location.href).href;
            manifestBaseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
            const response = await fetch(manifestUrl);
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

    // Normalize relative URLs in the manifest to be absolute
    // This is because the manifest is now a blob: URL and relative paths won't resolve correctly.
    // Normalize relative URLs in the manifest to be absolute
    // This is because the manifest is now a blob: URL and relative paths won't resolve correctly.
    if (updatedManifest.icons) {
        updatedManifest.icons = updatedManifest.icons.map(icon => ({
            ...icon,
            src: new URL(icon.src, manifestBaseUrl).href
        }));
    }

    if (updatedManifest.start_url) {
        updatedManifest.start_url = new URL(updatedManifest.start_url, manifestBaseUrl).href;
    }

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

    logger.debug(`PWA manifest updated and refreshed. Theme: ${themeColor}, BG: ${bgColor}`);
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

    if (!themeColor) {
        logger.debug('Theme color not ready yet (CSS variables may not be loaded)');
        return;
    }


    // Update meta tag
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = themeColor;

    logger.info(`Applied meta color: ${themeColor}`);

    // Cache for pre-boot application
    try {
        localStorage.setItem('st-mobile-theme-color-last', themeColor);
    } catch (e) {
        // Ignore
    }

    updatePwaManifest(themeColor, bgColor || themeColor);
}

/**
 * Saves the extension settings.
 */
function saveSettings() {
    const context = getContext();
    context.extensionSettings[MODULE_NAME] = settings;

    logger.debug('Saving settings for', MODULE_NAME, settings);

    if (typeof context.saveSettingsDebounced === 'function') {
        context.saveSettingsDebounced();
    } else if (typeof context.saveSettings === 'function') {
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
    $useManual.prop('checked', settings.useManual).on('change', function () {
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
    $variable.val(settings.colorVariable).on('change', function () {
        settings.colorVariable = $(this).val();
        saveSettings();
        updateThemeColor();
    });

    // Bind Manual Color Picker
    const $picker = $settings.find('#st-mobile-theme-color-picker');
    const $pickerValue = $settings.find('#st-mobile-theme-color-picker-value');

    $picker.attr('color', settings.manualColor);
    $pickerValue.text(settings.manualColor);

    $picker.on('change', function (e) {
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
    $useManualBg.prop('checked', settings.useManualBg).on('change', function () {
        settings.useManualBg = !!$(this).prop('checked');
        $settings.find('.bg-variable-group').toggleClass('hidden', settings.useManualBg);
        $settings.find('.bg-manual-group').toggleClass('hidden', !settings.useManualBg);
        saveSettings();
        updateThemeColor();
    });

    $settings.find('.bg-variable-group').toggleClass('hidden', settings.useManualBg);
    $settings.find('.bg-manual-group').toggleClass('hidden', !settings.useManualBg);

    const $bgColorVariable = $settings.find('#st-mobile-theme-color-bg-variable');
    $bgColorVariable.val(settings.bgColorVariable).on('change', function () {
        settings.bgColorVariable = $(this).val();
        saveSettings();
        updateThemeColor();
    });

    const $bgPicker = $settings.find('#st-mobile-theme-color-bg-picker');
    const $bgPickerValue = $settings.find('#st-mobile-theme-color-bg-picker-value');
    $bgPicker.attr('color', settings.manualBgColor);
    $bgPickerValue.text(settings.manualBgColor);

    $bgPicker.on('change', function (e) {
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
    $syncManifest.prop('checked', settings.syncManifest).on('change', function () {
        settings.syncManifest = !!$(this).prop('checked');
        saveSettings();
        updateThemeColor();
    });

    // Bind "Log Level" dropdown
    const $logLevel = $settings.find('#st-mobile-theme-color-log-level');
    $logLevel.val(settings.logLevel).on('change', function () {
        settings.logLevel = parseInt($(this).val());
        setLogLevel(settings.logLevel);
        saveSettings();
        logger.info(`Log level set to: ${$(this).find('option:selected').text()}`);
    });

    $('#extensions_settings').append($settings);

}

/**
 * Entry point for the extension.
 */
async function init() {
    const context = getContext();

    logger.debug('Extension module name:', MODULE_NAME);
    logger.debug('Context extensionSettings keys:', Object.keys(context.extensionSettings));

    const loadSettings = () => {
        // Try exact match, then try fallback to just the folder name
        const folderName = MODULE_NAME.split('/').pop();
        const savedSettings = context.extensionSettings[MODULE_NAME] || context.extensionSettings[folderName];
        
        if (savedSettings) {
            logger.info('Loaded settings for', MODULE_NAME, savedSettings);
            settings = Object.assign(settings, savedSettings);
            setLogLevel(settings.logLevel);
        } else {
            logger.info('No saved settings found, using defaults.');
        }
    };


    // Load settings
    loadSettings();
    logger.debug('Current settings:', settings);

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
        logger.debug('SETTINGS_LOADED event received, re-loading settings.');
        loadSettings();
        updateThemeColor();
    });
}

// Run immediately since we are a module and want to apply colors as early as possible.
// SillyTavern extensions are loaded after core scripts, so context should be ready.
init();

