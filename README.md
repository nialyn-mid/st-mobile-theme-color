# Mobile Theme Color for SillyTavern

A SillyTavern extension that synchronizes theme colors with the mobile browser UI (address bar) and PWA (splash screen and standalone background).

## Features

- **PWA Synchronization**: Dynamically updates `manifest.json` to ensure your PWA splash screen and icons match your current theme.
- **Browser UI Theming**: Sets the `theme-color` meta tag for mobile browsers (Chrome, Samsung Internet, etc.) to theme the address bar.
- **Smart Theme Sync**: Automatically picks up colors from your active SillyTavern theme variables.
- **Manual Overrides**: Set custom hex codes for both the theme color and PWA background independently.

## Installation

### 1. Install the Extension
1. Open SillyTavern.
2. Go to **Extensions** (puzzle icon) -> **Install Extension**.
3. Paste this repository URL: `https://github.com/nialyn-mid/st-mobile-theme-color`
4. Click **Install**.
5. Refresh your browser.

### 2. Enable Server Features (Required)
This extension uses a server-side plugin to safely update the PWA manifest.

1. Open the **Mobile Theme Color** settings in the SillyTavern extensions menu.
2. You will see a **Setup Required** or **Update Required** block.
3. Copy the provided command and run it from your **SillyTavern installation directory** (where `server.js` is located).
4. **Restart your SillyTavern server**.

## Manual Server Setup
If you prefer to enable things manually:
1. Ensure `enableServerPlugins: true` is set in your `config.yaml`.
2. Copy `plugin/index.cjs` to your SillyTavern `plugins/st-mobile-theme-color/index.cjs` folder.
3. Restart the server.

## PWA Support
To see the PWA changes on your mobile device:
1. Open SillyTavern in your mobile browser.
2. Use "Add to Home Screen" to install it as a PWA.
3. If you've already installed it, changing colors in the extension settings will update the manifest immediately. Depending on Things:tm:, after changing colors you may have to restart the PWA and/or the server.
