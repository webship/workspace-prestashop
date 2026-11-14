#!/usr/bin/env bash

# PrestaShop for the Webship Workspace: build a shop, run its console, add its default accounts,
# and wire its step pack into the testing setup.
#
# Placed by `plugins.sh --install prestashop` in core/scripts/plugins/prestashop/functions/, where
# bootstrap sources it after the core's own functions. Everything runs in the project's container
# (DDEV by default: `ddev exec -d <docroot> php bin/console …`), never on the host.
#
# The container tool has no project type for PrestaShop, so a shop is a `php` project that carries
# the console of the shop in its docroot; that file is how the functions here recognise one. The
# installer is given the container's own database values (db / db / db) and nothing personal.
#
# Only the open-source release is built: the installer is handed the list of the modules of the
# open-source project, so the marketplace, account, hosted checkout, marketing and assistant modules
# that travel in the downloaded archive stay uninstalled; the shop never sends an e-mail, and nothing
# here signs in to an account of a vendor.
#
# Four names are the ones the core's tools look for:
#   set_prestashop_users        the default accounts            (cmd-tools-add-users.sh <project> prestashop)
#   add_prestashop_users        create them in the shop         (the same tool, and --add-users of the builder)
#   cancel_prestashop_users     delete them                     (cmd-tools-cancel-users.sh <project> prestashop)
#   testing_configure_prestashop  the step pack in the testing stack (cmd-tools-testing.sh <project>)

# The step pack a PrestaShop project is tested with, and the release line it is required at.
readonly PRESTASHOP_STEPS_PACKAGE='@webship-js/prestashop-steps';
readonly PRESTASHOP_STEPS_VERSION='^2.0.0';

# Where the project publishes its releases: the archive of each version and its checksum.
readonly PRESTASHOP_RELEASES='https://api.prestashop-project.org/prestashop';

# The major line this plugin builds, and the release it was proven on.
readonly PRESTASHOP_MAJOR='9';
readonly PRESTASHOP_PROVEN_VERSION='9.2.1';

# The shop's own password policy asks for this many characters.
readonly PRESTASHOP_PASSWORD_LENGTH=8;

# The folder of the back office. The installer gives it a random name; the builder pins it, so the
# address is the same in every project and the test suite knows it.
readonly PRESTASHOP_ADMIN_FOLDER='admin-workspace';

# The console of the shop, from its docroot. --env in a command still wins over the variable.
readonly PRESTASHOP_CONSOLE='SYMFONY_ENV=prod php bin/console';

# The modules of the open-source release (its composer.json), the only ones installed.
readonly PRESTASHOP_MODULES='blockreassurance,blockwishlist,contactform,dashactivity,dashgoals,dashproducts,dashtrends,graphnvd3,gridhtml,gsitemap,pagesnotfound,productcomments,ps_apiresources,ps_banner,ps_bestsellers,ps_brandlist,ps_cashondelivery,ps_categoryproducts,ps_categorytree,ps_checkpayment,ps_contactinfo,ps_crossselling,ps_currencyselector,ps_customeraccountlinks,ps_customersignin,ps_customtext,ps_dataprivacy,ps_emailalerts,ps_emailsubscription,ps_facetedsearch,ps_faviconnotificationbo,ps_featuredproducts,ps_googleanalytics,ps_imageslider,ps_languageselector,ps_linklist,ps_mainmenu,ps_newproducts,ps_onepagecheckout,ps_searchbar,ps_sharebuttons,ps_shoppingcart,ps_socialfollow,ps_specials,ps_supplierlist,ps_themecusto,ps_viewedproduct,ps_wirepayment,psgdpr,statsbestcategories,statsbestcustomers,statsbestmanufacturers,statsbestproducts,statsbestsuppliers,statsbestvouchers,statscarrier,statscatalog,statscheckup,statsdata,statsforecast,statsnewsletter,statspersonalinfos,statsproduct,statsregistrations,statssales,statssearch,statsstock';

# The default accounts: an employee with a limited profile and two customers with an address, the
# ones a scenario signs in as. Accounts are configuration, created once in the shop; a test suite
# never creates or deletes one. The shop signs a person in by the e-mail address; the name is the
# handle a scenario reads. The role is the profile of an employee, or "Customer".
# The SuperAdmin of the shop is the workspace account and is not on this list.
function set_prestashop_users() {
  users=(salesman customer shopper);
  local kinds=(employee customer customer) roles=('Salesman' 'Customer' 'Customer') ;
  local firstnames=(Sam Clara Simon) lastnames=(Salesman Customer Shopper) i user ;
  for i in "${!users[@]}" ; do
    user="${users[$i]}" ;
    printf -v "user_${user}_name" '%s' "${user}" ;
    printf -v "user_${user}_mail" '%s' "${user}@example.com" ;
    printf -v "user_${user}_password" '%s' 'dD.123123ddd' ;
    printf -v "user_${user}_role" '%s' "${roles[$i]}" ;
    printf -v "user_${user}_kind" '%s' "${kinds[$i]}" ;
    printf -v "user_${user}_firstname" '%s' "${firstnames[$i]}" ;
    printf -v "user_${user}_lastname" '%s' "${lastnames[$i]}" ;
  done
}

# The docroot of a project, from its own container configuration.
function prestashop_docroot() {
  local project_path="$1" docroot ;
  docroot="$(grep -E '^docroot:' "${project_path}/.ddev/config.yaml" 2>/dev/null | head -1 | sed -E 's/^docroot:[[:space:]]*//; s/^"(.*)"$/\1/; s/[[:space:]]*$//')" ;
  printf '%s' "${docroot}" ;
}

# Is this folder a PrestaShop project? The console and the shop's own definitions in the docroot say so.
function prestashop_is_project() {
  local project_path="$1" docroot ;
  [ -f "${project_path}/.ddev/config.yaml" ] || return 1 ;
  docroot="$(prestashop_docroot "${project_path}")" ;
  [ -f "${project_path}/${docroot:+${docroot}/}bin/console" ] && [ -f "${project_path}/${docroot:+${docroot}/}config/defines.inc.php" ] ;
}

# Is the shop installed? The installer writes app/config/parameters.php, and nothing else does.
function prestashop_is_installed() {
  local project_path="$1" docroot ;
  docroot="$(prestashop_docroot "${project_path}")" ;
  [ -f "${project_path}/${docroot:+${docroot}/}app/config/parameters.php" ] ;
}

# The folder of the back office of a project: the one in its docroot whose name starts with
# "admin" and that is not the API's. The pinned name when there is none to read.
function prestashop_admin_folder() {
  local project_path="$1" docroot folder ;
  docroot="$(prestashop_docroot "${project_path}")" ;
  folder="$(find "${project_path}/${docroot}" -maxdepth 1 -type d -name 'admin*' ! -name 'admin-api' 2>/dev/null | LC_ALL=C sort | head -1)" ;
  folder="${folder##*/}" ;
  printf '%s' "${folder:-${PRESTASHOP_ADMIN_FOLDER}}" ;
}

# Go to the project a tool was asked about, or say why not.
function prestashop_enter_project() {
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}";
  if [ ! -d "${project_path}" ] ; then
    echo "No project ${PROJECT_NAME} in ${WORKSPACE_ROOT}/${doc_name}." ;
    return 1 ;
  fi
  if ! prestashop_is_project "${project_path}" ; then
    echo "${doc_name}/${PROJECT_NAME} is not a PrestaShop project (its docroot has no bin/console of a shop)." ;
    return 1 ;
  fi
  cd "${project_path}" || return 1 ;
}

# Where the shop is in the container of the project the shell is in.
function prestashop_container_root() {
  local docroot ; docroot="$(prestashop_docroot "$(pwd)")" ;
  printf '%s' "/var/www/html${docroot:+/${docroot}}" ;
}

# Run the console of the shop in the container of the project the shell is in, in the environment
# the shop is served in (the console's own default is its development one). Every argument is
# quoted for the container's shell, so one with a space arrives as one argument.
function prestashop_console() {
  local line="${PRESTASHOP_CONSOLE}" arg ;
  for arg in "$@" ; do
    line="${line} $(printf '%q' "${arg}")" ;
  done
  ddev exec -d "$(prestashop_container_root)" "${line}" ;
}

# One release of the list the project publishes: "<version> <archive> <md5>". The list is read in
# the container; `latest` is the newest stable release of the major line this plugin builds.
function prestashop_release() {
  local wanted="$1" ;
  ddev exec "curl -fsSL ${PRESTASHOP_RELEASES}" 2>/dev/null | python3 -c '
import json, sys
wanted, major = sys.argv[1], sys.argv[2]
try:
    releases = json.load(sys.stdin)
except ValueError:
    sys.exit(1)
def number(version):
    return tuple(int(part) for part in version.split(".") if part.isdigit())
mine = [r for r in releases if r.get("distribution") == "classic" and str(r.get("version", "")).startswith(major + ".")]
if wanted == "latest":
    mine = sorted((r for r in mine if r.get("stability") == "stable"), key=lambda r: number(r["version"]), reverse=True)
else:
    mine = [r for r in mine if r["version"] == wanted]
if not mine:
    sys.exit(1)
print(mine[0]["version"], mine[0]["zip_download_url"], mine[0]["zip_md5"])
' "${wanted}" "${PRESTASHOP_MAJOR}" ;
}

# Build a PrestaShop shop from nothing: the container, the code, and with --install the shop itself.
function prestashop_build() {
  trim_project_name ;
  local host="${PROJECT_NAME}.ddev.site" ;
  local base_url="https://${host}" ;
  local version="${VERSION:-${site_version:-latest}}" ;
  local php_version="${PHP_VERSION:-${site_php_version:-8.3}}" ;
  local docroot="${distribution_webroot}" ;
  local root="/var/www/html${docroot:+/${docroot}}" ;
  local fixtures=1 ; [ "${DEMO_CATALOG}" == 'no' ] && fixtures=0 ;

  if [ ! "${version}" == 'latest' ] && [[ ! "${version}" == ${PRESTASHOP_MAJOR}.* ]] ; then
    echo "This builder makes a PrestaShop ${PRESTASHOP_MAJOR} shop: --version is latest or a ${PRESTASHOP_MAJOR}.x number such as ${PRESTASHOP_PROVEN_VERSION}." ;
    exit 1 ;
  fi
  if [ "${INSTALL}" == 'yes' ] && [ "${#account_pass}" -lt "${PRESTASHOP_PASSWORD_LENGTH}" ] ; then
    echo "The shop asks for a password of ${PRESTASHOP_PASSWORD_LENGTH} characters or more, and the workspace account's is shorter." ;
    echo "Change account: pass in core/config/settings.yml, or build without --install." ;
    exit 1 ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;

  drop_database ;
  rm -rf "${PROJECT_NAME}" ;
  mkdir -p "${PROJECT_NAME}/${docroot}" ;
  cd ${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME} || exit 1 ;

  # The shop routes its addresses through .htaccess, so the web server is Apache.
  ddev config --project-type=php --docroot="${docroot}" --project-name=${PROJECT_NAME} \
    --php-version=${php_version} --webserver-type=apache-fpm --database=mariadb:10.11 \
    --nodejs-version=$(ddev_nodejs_version) || exit 1 ;
  ddev_up start -y || exit 1 ;

  local release archive checksum ;
  release="$(prestashop_release "${version}")" ;
  if [ -z "${release}" ] ; then
    echo "PrestaShop ${version} is not in the release list of the project (${PRESTASHOP_RELEASES}), or the list could not be read." ;
    exit 1 ;
  fi
  read -r version archive checksum <<< "${release}" ;

  # The download holds the shop as an inner archive next to a web unpacker: only the shop is kept.
  echo "Downloading PrestaShop ${version}." ;
  ddev exec "cd /tmp && curl -fsSL -o release.zip '${archive}' && echo '${checksum}  release.zip' | md5sum -c - \
    && unzip -q -o release.zip prestashop.zip && unzip -q -o prestashop.zip -d '${root}' && rm -f release.zip prestashop.zip" \
    || { echo "The PrestaShop ${version} archive could not be downloaded, did not match its checksum, or could not be unpacked." ; exit 1 ; } ;

  if [ "${INSTALL}" == 'yes' ] ; then
    # The container's own database values, the same in every project: nothing personal is written.
    # Only the modules of the open-source release are installed.
    echo "Installing the shop$([ "${fixtures}" == '1' ] && echo ' with the demo catalog')." ;
    ddev exec -d "${root}" "php install/index_cli.php --domain=${host} \
      --db_server=db --db_name=db --db_user=db --db_password=db --prefix=ps_ \
      --name=$(printf '%q' "${doc_name} ${PROJECT_NAME}") --country=us --language=en --timezone=UTC \
      --firstname=Shop --lastname=Admin \
      --email=$(printf '%q' "${account_mail}") --password=$(printf '%q' "${account_pass}") \
      --ssl=1 --rewrite=1 --fixtures=${fixtures} --modules=${PRESTASHOP_MODULES}" \
      || { echo "The PrestaShop installer failed." ; exit 1 ; } ;

    # The shop refuses to open its back office while install/ is there, and the installer gave the
    # back office a folder of a random name: remove the first, pin the second.
    ddev exec -d "${root}" "rm -rf install ; for folder in admin*/ ; do folder=\"\${folder%/}\" ; \
      [ \"\${folder}\" == 'admin-api' ] || [ \"\${folder}\" == '${PRESTASHOP_ADMIN_FOLDER}' ] || { mv \"\${folder}\" '${PRESTASHOP_ADMIN_FOLDER}' ; break ; } ; done" ;

    # No e-mail leaves a local shop (3 = never send).
    ddev mysql -e "UPDATE ps_configuration SET value='3' WHERE name='PS_MAIL_METHOD'" ;

    if [ "${ADD_USERS}" == 'yes' ] ; then
      set_prestashop_users ;
      add_prestashop_users ;
      cd ${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME} || exit 1 ;
    fi

    ddev exec -d "${root}" "rm -rf var/cache/*" ;
    # The first request of each side builds its cache: make it here, not in front of a person.
    ddev exec "curl -ksL -o /dev/null '${base_url}/' ; curl -ksL -o /dev/null '${base_url}/${PRESTASHOP_ADMIN_FOLDER}/'" ;

    echo "${doc_name} ${PROJECT_NAME} has been installed: PrestaShop ${version}.";
    echo "Go to ${base_url}/${PRESTASHOP_ADMIN_FOLDER} and log in as ${account_mail}";
  else
    [ "${ADD_USERS}" == 'yes' ] && echo "--add-users needs --install: there is no shop to add accounts to yet." ;
    echo "${doc_name} ${PROJECT_NAME} is ready to install.";
    echo "Go to ${base_url}/install";
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    ddev launch ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# Add, delete or list accounts of the shop, in its container, through the shop's own classes: the
# console makes a SuperAdmin and no other account. $1 is add, cancel or list; the accounts are the list the caller
# loaded (set_prestashop_users). An employee gets its profile by the profile's name; a customer gets
# one address in the default country of the shop. Run twice, it leaves an account that exists as it is.
function prestashop_accounts() {
  local action="$1" rows='' user kind mail password firstname lastname role ;
  for user in "${users[@]}" ; do
    kind="user_${user}_kind"; mail="user_${user}_mail"; password="user_${user}_password";
    firstname="user_${user}_firstname"; lastname="user_${user}_lastname"; role="user_${user}_role";
    rows="${rows}${!kind:-customer}|${!mail}|${!password}|${!firstname:-${user^}}|${!lastname:-Account}|${!role};" ;
  done
  ddev exec -d "$(prestashop_container_root)" "PRESTASHOP_ACCOUNTS=$(printf '%q' "${rows}") php -- ${action}" <<'ACCOUNTSEOF'
<?php
// Runs in the docroot of the shop. The accounts arrive in PRESTASHOP_ACCOUNTS, one per ";":
// kind|e-mail|password|first name|last name|profile.
require getcwd() . '/config/config.inc.php';

use PrestaShop\PrestaShop\Adapter\ServiceLocator;
use PrestaShop\PrestaShop\Core\Crypto\Hashing;

Shop::setContext(Shop::CONTEXT_ALL);
$action = $argv[1] ?? 'list';
$langId = (int) Configuration::get('PS_LANG_DEFAULT');

if ($action === 'list') {
    $employees = Db::getInstance()->executeS(
        'SELECT e.email, e.firstname, e.lastname, e.active, pl.name AS profile FROM ' . _DB_PREFIX_ . 'employee e'
        . ' LEFT JOIN ' . _DB_PREFIX_ . 'profile_lang pl ON pl.id_profile = e.id_profile AND pl.id_lang = ' . $langId . ' ORDER BY e.id_employee'
    );
    echo "Employees (the back office):\n";
    foreach ($employees as $row) {
        printf("  %-32s %-24s %s%s\n", $row['email'], $row['firstname'] . ' ' . $row['lastname'], $row['profile'], $row['active'] ? '' : ' (disabled)');
    }
    $customers = Db::getInstance()->executeS(
        'SELECT email, firstname, lastname, active FROM ' . _DB_PREFIX_ . 'customer WHERE deleted = 0 AND is_guest = 0 ORDER BY id_customer'
    );
    echo "Customers (the shop):\n";
    foreach ($customers as $row) {
        printf("  %-32s %s%s\n", $row['email'], $row['firstname'] . ' ' . $row['lastname'], $row['active'] ? '' : ' (disabled)');
    }
    exit(0);
}

$crypto = ServiceLocator::get(Hashing::class);
$failed = 0;
foreach (array_filter(explode(';', (string) getenv('PRESTASHOP_ACCOUNTS'))) as $row) {
    [$kind, $email, $password, $firstname, $lastname, $profile] = array_pad(explode('|', $row), 6, '');
    // By its number: an object asked for by an address that is not there comes back empty, not false.
    $id = $kind === 'employee'
        ? (int) Db::getInstance()->getValue('SELECT id_employee FROM ' . _DB_PREFIX_ . "employee WHERE email = '" . pSQL($email) . "'")
        : (int) Customer::customerExists($email, true);
    $found = !$id ? null : ($kind === 'employee' ? new Employee($id) : new Customer($id));

    if ($action === 'cancel') {
        if (!$found) {
            echo "   $email is not there.\n";
        } elseif ($found->delete()) {
            echo "   $email is deleted.\n";
        } else {
            echo "   $email could not be deleted.\n";
            ++$failed;
        }
        continue;
    }

    if ($found) {
        echo "   $email is already there.\n";
        continue;
    }
    if ($kind === 'employee') {
        $profileId = (int) Db::getInstance()->getValue(
            'SELECT id_profile FROM ' . _DB_PREFIX_ . "profile_lang WHERE name = '" . pSQL($profile) . "' AND id_lang = " . $langId
        );
        if (!$profileId) {
            echo "   $email: the shop has no profile \"$profile\".\n";
            ++$failed;
            continue;
        }
        $employee = new Employee();
        $employee->firstname = $firstname;
        $employee->lastname = $lastname;
        $employee->email = $email;
        $employee->passwd = $crypto->hash($password);
        $employee->id_profile = $profileId;
        $employee->id_lang = $langId;
        $employee->active = true;
        $employee->bo_theme = 'default';
        $employee->default_tab = (int) Tab::getIdFromClassName('AdminOrders');
        if (!$employee->add()) {
            echo "   $email could not be created: " . json_encode($employee->validateFields(false, true)) . "\n";
            ++$failed;
            continue;
        }
        echo "   $email is an employee with the $profile profile.\n";
        continue;
    }
    $customer = new Customer();
    $customer->firstname = $firstname;
    $customer->lastname = $lastname;
    $customer->email = $email;
    $customer->passwd = $crypto->hash($password);
    $customer->id_default_group = (int) Configuration::get('PS_CUSTOMER_GROUP');
    $customer->active = true;
    $customer->newsletter = false;
    $customer->optin = false;
    if (!$customer->add()) {
        echo "   $email could not be created: " . json_encode($customer->validateFields(false, true)) . "\n";
        ++$failed;
        continue;
    }
    // One address in the default country of the shop, so a checkout has where to deliver.
    $countryId = (int) Configuration::get('PS_COUNTRY_DEFAULT');
    $address = new Address();
    $address->id_customer = (int) $customer->id;
    $address->id_country = $countryId;
    $address->id_state = (int) State::getIdByIso('FL', $countryId);
    $address->alias = 'Home';
    $address->firstname = $firstname;
    $address->lastname = $lastname;
    $address->address1 = '16 Main Street';
    $address->city = 'Miami';
    $address->postcode = '33133';
    $address->phone = '5550100';
    if (!$address->add()) {
        echo "   $email is a customer, but its address could not be created.\n";
        ++$failed;
        continue;
    }
    echo "   $email is a customer with an address.\n";
}
exit($failed ? 1 : 0);
ACCOUNTSEOF
}

# Create the default accounts in the shop. An account that is already there is left as it is.
# The list is loaded by the caller (set_prestashop_users): the core's add_users, the builder, the CLI tool.
function add_prestashop_users() {
  prestashop_enter_project || return 1 ;
  local user user_name user_mail user_password user_role status ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail";
    user_password="user_${user}_password"; user_role="user_${user}_role";

    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo "      User mail: ${!user_mail}";
    echo "  User password: ${!user_password}";
    echo "      User role: ${!user_role}";
    echo " ================================================================= ";
  done
  prestashop_accounts add ; status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# Delete the default accounts.
function cancel_prestashop_users() {
  prestashop_enter_project || return 1 ;
  local user user_mail status ;
  for user in "${users[@]}" ; do
    user_mail="user_${user}_mail";
    echo " ---------------------------------------------------------------- ";
    echo "      User mail: ${!user_mail}";
    echo " ================================================================= ";
  done
  prestashop_accounts cancel ; status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# What cmd-tools-prestashop-cli.sh does: the first of --run, --clear-cache, --add-users,
# --cancel-users that was asked for; with none of them, what the shop is.
function prestashop_cli_tool() {
  trim_project_name ;
  prestashop_enter_project || exit 1 ;

  if ! ddev describe -j 2>/dev/null | grep -q '"status":"running"' ; then
    ddev start -y || exit 1 ;
  fi

  if [ ! "${RUN}" == '_none_' ] ; then
    # One string on purpose: --run "prestashop:module:list" is a command and its arguments.
    ddev exec -d "$(prestashop_container_root)" "${PRESTASHOP_CONSOLE} ${RUN}" ;
    exit $? ;
  fi

  if [ "${CLEAR_CACHE}" == 'yes' ] ; then
    prestashop_console cache:clear --no-interaction ;
  elif [ "${ADD_USERS}" == 'yes' ] ; then
    set_prestashop_users ;
    add_prestashop_users ;
  elif [ "${CANCEL_USERS}" == 'yes' ] ; then
    set_prestashop_users ;
    cancel_prestashop_users ;
  else
    echo "${doc_name}/${PROJECT_NAME}: $(prestashop_console --version 2>/dev/null | head -1) at https://${PROJECT_NAME}.ddev.site" ;
    if prestashop_is_installed "$(pwd)" ; then
      echo "The back office: https://${PROJECT_NAME}.ddev.site/$(prestashop_admin_folder "$(pwd)")" ;
      echo "" ; users=() ; prestashop_accounts list ;
    else
      echo "The shop is not installed yet: open its address, or build it again with --install." ;
    fi
  fi
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The step pack in the testing stack of a PrestaShop project. The core's testing_configure calls
# this in the project folder once webship-js is scaffolded and before the dependencies are
# installed; for a project that is not a shop it changes nothing.
#
# It adds the pack to package.json, lists its step definitions in cucumber.js after webship-js's
# own, gives cucumber.js the folder of the back office and the registries of the default accounts
# (a handle a scenario reads, mapped to an account; never the workspace account), and writes a
# first feature when the project has none of its own. Every part is skipped when it is already
# there, so a second run adds what the first missed and never resets a suite.
function testing_configure_prestashop() {
  local project_path="$1";
  prestashop_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  PrestaShop: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi

  echo "Adding the PrestaShop step pack (${PRESTASHOP_STEPS_PACKAGE} ${PRESTASHOP_STEPS_VERSION}).";
  set_prestashop_users ;
  local registry="" user user_mail user_password user_kind user_firstname user_lastname ;
  for user in "${users[@]}" ; do
    user_mail="user_${user}_mail"; user_password="user_${user}_password"; user_kind="user_${user}_kind";
    user_firstname="user_${user}_firstname"; user_lastname="user_${user}_lastname";
    registry="${registry}${!user_kind}|${user}|${!user_mail}|${!user_password}|${!user_firstname} ${!user_lastname}"$'\n' ;
  done

  python3 - "${project_path}" "${PRESTASHOP_STEPS_PACKAGE}" "${PRESTASHOP_STEPS_VERSION}" 'SHOP' "${registry}" "$(prestashop_admin_folder "${project_path}")" <<'PYEOF' || return 1
import json, re, sys

project, pack, version, prefix, registry, folder = sys.argv[1:7]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on.
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=2) + '\n')
    print('  package.json: %s %s' % (pack, version))

# cucumber.js: the pack's step definitions after webship-js's own, the back office and the registries.
cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/**/*.js'," % pack
    core = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if core:
        src = src[:core.end()] + '\n' + core.group(1) + line + src[core.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

if not re.search(r"^[ \t]*(employees|customers):[ \t]*\{", src, re.M):
    world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
    if not world:
        sys.exit("  cucumber.js has no worldParameters block to add the accounts to.")
    pad = world.group(1) + '  '
    rows = [r.split('|') for r in registry.splitlines() if r.strip()]
    block = []
    if not re.search(r"^[ \t]*backOffice:[ \t]*\{", src, re.M):
        block += [
            pad + "// The folder of the back office: the builder pins it. ADMIN_FOLDER names another one.",
            pad + "backOffice: { folder: process.env.ADMIN_FOLDER || '%s' }," % folder,
        ]
    block += [
        pad + "// The accounts a scenario signs in with, by handle: employees for the back office, customers for the shop",
        pad + "// (the default accounts: cmd-tools-add-users.sh). Override one with %s_<HANDLE>_EMAIL and %s_<HANDLE>_PASSWORD." % (prefix, prefix),
    ]
    for key, kind in (('employees', 'employee'), ('customers', 'customer')):
        block.append(pad + "%s: {" % key)
        for row_kind, handle, mail, password, name in rows:
            if row_kind != kind:
                continue
            env = '%s_%s' % (prefix, handle.upper())
            block.append(pad + "  %s: { email: process.env.%s_EMAIL || '%s', password: process.env.%s_PASSWORD || '%s', name: '%s' }," % (handle, env, mail, env, password, name))
        block.append(pad + "},")
    src = src[:world.end()] + '\n' + '\n'.join(block) + src[world.end():]
    print('  cucumber.js: the back office (%s) and the accounts (%s)' % (folder, ', '.join(r[1] for r in rows)))

if src != before:
    open(cucumber_file, 'w').write(src)
PYEOF

  # A first feature, when the project has none for the shop yet: the front page, the back office,
  # each default account on its side.
  local feature="${WORKSPACE_SCRIPTS}/plugins/prestashop/site.feature" ;
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/site.feature" ] ; then
    mkdir -p "${project_path}/tests/features" && cp "${feature}" "${project_path}/tests/features/site.feature" \
      && echo "  tests/features/site.feature: a first feature for the shop" ;
  fi

  # The scenarios sign in as the default accounts: make sure an installed shop has them.
  if prestashop_is_installed "${project_path}" ; then
    ( add_prestashop_users > /dev/null ) && echo "  the default accounts are in the shop (${users[*]})" ;
  fi
}
