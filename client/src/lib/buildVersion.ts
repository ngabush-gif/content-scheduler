/**
 * Build Version System - Centralized deployment tracking
 * 
 * Update this version after each deployment to track changes across the app.
 * Format: YYYY-MM-DD-{feature}-{iteration}
 * 
 * Examples:
 *   2026-04-23-v2-auto-attach (Quick Image auto-attach redesign)
 *   2026-04-24-v3-toast-guard (Toast guard pattern implementation)
 */

export const BUILD_VERSION = '2026-04-23-v2-auto-attach';

/**
 * Version history for reference
 * Keep this updated as a changelog for deployment tracking
 */
export const VERSION_HISTORY = [
  {
    version: '2026-04-23-v2-auto-attach',
    date: '2026-04-23',
    changes: [
      'Quick Image auto-attaches generated images to content card',
      'Removed manual download flow to eliminate duplicate toasts',
      'Fixed mobile tap event blocking with pointer-events',
      'Synchronized loading state with tRPC mutation isPending',
      'Build version marker for deployment verification'
    ]
  },
  {
    version: '2026-04-23-v1-quick-image',
    date: '2026-04-23',
    changes: [
      'Initial Quick Image feature implementation',
      'Manual click-to-generate behavior',
      'Image preview modal with download and regenerate buttons',
      'Graceful error handling'
    ]
  }
];

/**
 * Get the current version for display
 */
export function getDisplayVersion(): string {
  return BUILD_VERSION;
}

/**
 * Get version history for debugging
 */
export function getVersionHistory() {
  return VERSION_HISTORY;
}

/**
 * Log current version to console on app startup
 */
export function logVersion() {
  console.log(`%c[Build Version] ${BUILD_VERSION}`, 'color: #10b981; font-weight: bold;');
}
