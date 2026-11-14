#!/usr/bin/env bash

# workspace-name: PrestaShop (9.x)

# Installed by the PrestaShop plugin (plugins.sh --install prestashop); __WORKSPACE__ is the workspace it was installed into.
#
# Build a PrestaShop shop in a container: the latest stable 9.x release of the open-source project,
# or the one --version names, at https://<name>.ddev.site. With --install the shop is installed with
# the workspace account as its SuperAdmin and, unless --demo-catalog no, with the demo catalog; with
# --add-users it also gets the default accounts: an employee with a limited profile and two customers.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Set site version.
site_version="latest";

# Distribution.
distribution_name="prestashop";
distribution_title="PrestaShop";
distribution_webroot="public";

ARGPARSE_DESCRIPTION="Build a ${distribution_title} project in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/prestashop/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/prestashop/args/arg-prestashop.sh || exit 1 ;

shift $#;

prestashop_build ;
