#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The name of the project: its folder, its DDEV project and its host name.')
parser.add_argument('-v', '--version',
                    default="${site_version}",
                    help='The PrestaShop 9 release to download: latest, or a version number. Example: --version 9.2.1 [default %(default)s]')
parser.add_argument('-i', '--install',
                    action='store_true',
                    default=False,
                    help='Install the shop, with the workspace account as its SuperAdmin.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='With --install, add the default accounts: an administrator, an employee with the Salesman profile and two customers with an address, the ones the test scenarios sign in as.')
parser.add_argument('-d', '--demo-catalog',
                    default="yes",
                    choices=['yes', 'no'],
                    help='With --install, add the demo catalog: products, categories, customers and orders. Example: --demo-catalog no [default %(default)s]')
parser.add_argument('-l', '--launch',
                    action='store_true',
                    default=False,
                    help='Open the shop in a browser when it is ready.')
parser.add_argument('--php-version',
                    default="8.3",
                    choices=['8.4', '8.3', '8.2', '8.1'],
                    help='PHP version for the project container. Example: --php-version 8.4 [default %(default)s]')
ARGEOF
