#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The PrestaShop project in this workspace.')
parser.add_argument('-r', '--run',
                    default="_none_",
                    help='A console command to run in the project, without the leading php bin/console. Example: --run "prestashop:module:list"')
parser.add_argument('-k', '--clear-cache',
                    action='store_true',
                    default=False,
                    help='Clear the cache of the shop.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='Add the default accounts: an employee with the Salesman profile and two customers. An account that is already there is left as it is.')
parser.add_argument('-c', '--cancel-users',
                    action='store_true',
                    default=False,
                    help='Delete the default accounts.')
ARGEOF
