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

// State constants
const STATE = {
    READY: 'ready',
    MISSING: 'missing',
    RESTART: 'restart',
    DISABLED: 'disabled',
};

// Minimum version of the server plugin required by this frontend version
const REQUIRED_SERVER_VERSION = '1.2.0';

let currentState = STATE.MISSING;
let installedServerVersion = '0.0.0';


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


    // Cache for pre-boot application (legacy fallback)
    try {
        localStorage.setItem('st-mobile-theme-color-last', themeColor);
        if (bgColor) {
            localStorage.setItem('st-mobile-theme-color-bg-last', bgColor);
        }
    } catch (e) {
        // Ignore
    }

    // Sync with server plugin for persistent manifest update
    if (currentState === STATE.READY) {
        syncWithServer(themeColor, bgColor || themeColor);
    }

    logger.info(`Resolved and cached color: ${themeColor}`);
}

/**
 * Synchronizes the colors with the server-side manifest.
 */
async function syncWithServer(themeColor, bgColor) {
    try {
        const params = new URLSearchParams({
            themeColor: themeColor || '',
            bgColor: bgColor || themeColor || ''
        });
        
        const response = await fetch(`/api/plugins/st-mobile-theme-color/sync?${params.toString()}`);
        
        if (response.ok) {
            logger.debug('Server manifest synchronized.');
        } else {
            logger.warn('Failed to synchronize manifest with server.');
        }
    } catch (e) {
        logger.error('Error syncing with server:', e);
    }
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
/**
 * Detects the current environment and returns an appropriate installation command.
 */
function getInstallCommand() {
    const isWin = navigator.platform.includes('Win');
    const slash = isWin ? '\\' : '/';
    
    // Most users run commands from the ST root
    let fullModuleName = MODULE_NAME;
    if (isWin) {
        fullModuleName = fullModuleName.replace(/\//g, '\\');
    }
    
    const relPath = `public${slash}scripts${slash}extensions${slash}${fullModuleName}${slash}install${slash}install-plugin.cjs`;
    return `node ${relPath}`;
}


/**
 * Checks if the server-side plugin is installed and active.
 */
async function checkPluginStatus() {
    try {
        const response = await fetch('/api/plugins/st-mobile-theme-color/status');
        if (response.ok) {
            const data = await response.json();
            installedServerVersion = data.version || '1.0.0';
            
            // Compare versions
            if (installedServerVersion < REQUIRED_SERVER_VERSION) {
                logger.info(`Server plugin out of date. Installed: ${installedServerVersion}, Required: ${REQUIRED_SERVER_VERSION}`);
                return STATE.RESTART;
            } else {
                return STATE.READY;
            }
        }
    } catch (e) {
        // Network error or missing plugin
    }
    
    return STATE.MISSING;
}

/**
 * Updates the Setup Center UI based on current state.
 */
async function updateSetupUI() {
    const status = await checkPluginStatus();
    currentState = status;
    
    const container = document.getElementById('st-mobile-theme-color-settings');
    if (!container) return;
    
    const states = ['ready', 'missing', 'restart', 'disabled'];
    states.forEach(s => {
        const el = document.getElementById(`st-mobile-theme-color-state-${s}`);
        if (el) el.classList.add('hidden');
    });
    
    const currentEl = document.getElementById(`st-mobile-theme-color-state-${status}`);
    if (currentEl) currentEl.classList.remove('hidden');
    
    // Show/hide main settings
    const mainSettings = document.getElementById('st-mobile-theme-color-main-settings');
    if (mainSettings) {
        if (status === STATE.READY) {
            mainSettings.classList.remove('hidden');
        } else {
            mainSettings.classList.remove('hidden'); // Still allow manual settings even if plugin missing
        }
    }
    
    // Update command text
    const cmdText = getInstallCommand();
    const cmdEls = document.querySelectorAll('.st-mobile-theme-color-command');
    cmdEls.forEach(el => {
        el.textContent = cmdText;
    });
}

async function init() {
    // Setup Center events
    jQuery(document).on('click', '.st-mobile-theme-color-copy-btn', function() {
        const cmd = getInstallCommand();
        navigator.clipboard.writeText(cmd);
        toastr.success('Command copied to clipboard!');
    });

    // Check plugin status periodically or on show
    updateSetupUI();

    // Re-check when the drawer is opened
    jQuery(document).on('click', '.inline-drawer-toggle', function() {
        if (jQuery(this).closest('#st-mobile-theme-color-settings').length) {
            updateSetupUI();
        }
    });

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

