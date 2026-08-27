'use client';

import { CommandPalette } from './NotificationsBell';

/**
 * Hosts the global CommandPalette exactly once per dashboard layout.
 *
 * Previously the palette was mounted in BOTH DashboardSidebar (desktop) and
 * MobileTopBar (mobile) which caused two overlays + two input autofocus
 * races when ⌘K was pressed. The sidebar uses CSS `hidden lg:block` so it
 * stays mounted even on mobile — meaning both instances were always live
 * in the React tree regardless of viewport.
 *
 * Now we render this host once at the layout root (after both the desktop
 * sidebar and the mobile top bar). The palette still listens to the same
 * `open-command-palette` custom event from any `SearchTrigger` button, and
 * the same `⌘K` / `Ctrl+K` shortcut. Zero behavior change — single mount.
 */
export default function CommandPaletteHost() {
  return <CommandPalette />;
}
