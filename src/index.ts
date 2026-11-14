/**
 * PrestaShop for Webship Workspace: a platform plugin.
 *
 * What the package carries is placed by the installer from the manifest: the builder and the
 * console tool in the sites folders, their functions and argparse under core/scripts/plugins/prestashop/,
 * the agents in the AI Agents folder. The dashboard needs nothing drawn for it: the builder is in the
 * Build list because it is a cmd-*-project.sh, the row menus are the core's, the agents are listed
 * like any other. What register() adds is what the assistant is told.
 *
 * Everything the dashboard is asked for goes through `api`; this package requires nothing from the
 * dashboard's own files, so it can be installed from npm and removed without a trace.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';

/** The plugin's name, which its functions and its user list are named after. */
export const PLATFORM = 'prestashop';

/** The commands the installer places in every sites folder. */
export const COMMANDS = ['cmd-prestashop-project.sh', 'cmd-tools-prestashop-cli.sh'];

/** The agents the installer places in the AI Agents folder. */
export const AGENTS = ['prestashop-site-builder', 'prestashop-tester'];

/** What the assistant is told about PrestaShop in this workspace. */
export function assistantContext(): string {
  return [
    'PrestaShop (a plugin, @webship.co/workspace-prestashop): a PrestaShop 9 shop of the open-source release is built with',
    '`bash cmd-prestashop-project.sh <name> --install --add-users` from a sites folder (dev, test, sandboxes, demos),',
    'in a container like every other project, at https://<name>.ddev.site (the back office at /admin-workspace), with the demo catalog unless `--demo-catalog no`.',
    '`bash cmd-tools-prestashop-cli.sh <name>` says what the shop is; `--run "<command>"` runs the console of the shop (bin/console) in it,',
    '`--clear-cache` clears its cache, `--add-users` adds the default accounts (an employee with the Salesman profile and two customers).',
    '`bash cmd-tools-add-users.sh <name> prestashop` adds the same accounts.',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the PrestaShop step pack; `--run` runs the suite.',
    `For PrestaShop work, hand over to the agents ${AGENTS.map((a) => `\`${a}\``).join(' and ')}.`,
    'Never run php, composer, npm or mysql on the host for a project, and never sign a shop in to a marketplace or a vendor account.',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
