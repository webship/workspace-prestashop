/**
 * PrestaShop for Webship Workspace: a platform plugin.
 *
 * What the package carries is placed by the installer from the manifest: the builder and the
 * console tool in the sites folders, their functions and argparse under core/scripts/plugins/prestashop/,
 * its AI items (ai/) in the AI folders. The dashboard needs nothing drawn for it: the builder is in the
 * Build list because it is a cmd-*-project.sh, the row menus are the core's, the AI items are listed
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

/** The skill the installer places in the AI Skills folder (a folder each, with its SKILL.md). */
export const SKILLS = ['prestashop-scenarios'];

/** The slash command the installer places in the AI Commands folder. */
export const AI_COMMANDS = ['prestashop-test'];

/** The prompt the installer places in the AI Prompts folder: a whole launch command for a new session. */
export const PROMPTS = ['prestashop-build-and-test'];

/** What the assistant is told about PrestaShop in this workspace. */
export function assistantContext(): string {
  return [
    'PrestaShop (a plugin, @webship.co/workspace-prestashop): a PrestaShop 9 shop of the open-source release is built with',
    '`bash cmd-prestashop-project.sh <name> --install --add-users` from a sites folder (dev, test, sandboxes, demos),',
    'in a container like every other project: on DDEV by default, at https://<name>.ddev.site, or with `--runtime docker|podman|kubernetes|lando|docksal` on that runtime, at the address the build prints (the back office at /admin-workspace), with the demo catalog unless `--demo-catalog no`.',
    '`bash cmd-tools-prestashop-cli.sh <name>` says what the shop is; `--run "<command>"` runs the console of the shop (bin/console) in it,',
    '`--clear-cache` clears its cache, `--add-users` adds the default accounts (an administrator, an employee with the Salesman profile and two customers).',
    '`bash cmd-tools-add-users.sh <name> prestashop` adds the same accounts.',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the PrestaShop step pack; `--run` runs the suite.',
    `For PrestaShop work, hand over to the agents ${AGENTS.map((a) => `\`${a}\``).join(' and ')}.`,
    `The plugin also places the skill ${SKILLS.map((a) => `\`${a}\``).join(', ')} (the step pack's phrases, by area) in ai-skills/,`,
    `the command ${AI_COMMANDS.map((a) => `\`/${a} <shop>\``).join(', ')} in ai-commands/ and the prompt ${PROMPTS.map((a) => `\`${a}\``).join(' and ')} in ai-prompts/.`,
    'Never run php, composer, npm or mysql on the host for a project, and never sign a shop in to a marketplace or a vendor account.',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
