/**
 * js/logger.js
 * Consolidated logger for ST-Mobile-Theme-Color.
 */

export const LOG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4
};

const MODULE_NAME = 'Mobile Theme Color';
let currentLogLevel = LOG_LEVELS.WARN;

/**
 * Sets the log level for the logger.
 * @param {number|string} level 
 */
export function setLogLevel(level) {
    if (typeof level === 'string') {
        currentLogLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.NONE;
    } else {
        currentLogLevel = parseInt(level) || LOG_LEVELS.NONE;
    }
}

export const logger = {
    log: (...args) => {
        if (currentLogLevel >= LOG_LEVELS.INFO) {
            console.log(`[${MODULE_NAME}]`, ...args);
        }
    },
    info: (...args) => {
        if (currentLogLevel >= LOG_LEVELS.INFO) {
            console.info(`[${MODULE_NAME}]`, ...args);
        }
    },
    warn: (...args) => {
        if (currentLogLevel >= LOG_LEVELS.WARN) {
            console.warn(`[${MODULE_NAME}]`, ...args);
        }
    },
    error: (...args) => {
        if (currentLogLevel >= LOG_LEVELS.ERROR) {
            console.error(`[${MODULE_NAME}]`, ...args);
        }
    },
    debug: (...args) => {
        if (currentLogLevel >= LOG_LEVELS.DEBUG) {
            console.debug(`[${MODULE_NAME}]`, ...args);
        }
    }
};
