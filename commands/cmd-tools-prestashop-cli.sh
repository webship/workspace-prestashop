#!/usr/bin/env bash

# Installed by the PrestaShop plugin (plugins.sh --install prestashop); __WORKSPACE__ is the workspace it was installed into.
#
# The console of the shop (bin/console) for one PrestaShop project of this workspace, in its
# container: say what the shop is, run a console command, clear the cache, add or remove the default
# accounts. Nothing here runs on the host.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Distribution.
distribution_name="prestashop";

ARGPARSE_DESCRIPTION="Run the console on a PrestaShop project of __WORKSPACE__: status, a command, the cache, the default accounts"
# The args file comes with the plugin: core/scripts/plugins/prestashop/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/prestashop/args/arg-prestashop-cli.sh || exit 1 ;

shift $#;

prestashop_cli_tool ;
