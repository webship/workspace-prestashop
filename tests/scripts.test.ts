import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-prestashop.sh');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

/** A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled. */
function project(kind: 'prestashop' | 'other') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prestashop-plugin-'));
  const dir = path.join(root, 'dev', 'shop1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), `name: shop1\ntype: ${kind === 'prestashop' ? 'php' : 'drupal11'}\ndocroot: public\n`);
  if (kind === 'prestashop') {
    // What makes a php project a shop: its console and its definitions in the docroot; installed, its parameters and its back office.
    for (const d of ['bin', 'config', 'app/config', 'admin-api', 'admin-workspace']) fs.mkdirSync(path.join(dir, 'public', d), { recursive: true });
    fs.writeFileSync(path.join(dir, 'public', 'bin', 'console'), '#!/usr/bin/env php\n');
    fs.writeFileSync(path.join(dir, 'public', 'config', 'defines.inc.php'), '<?php\n');
    fs.writeFileSync(path.join(dir, 'public', 'app', 'config', 'parameters.php'), '<?php\n');
  }
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'shop1', devDependencies: { 'webship-js': '^2.0.6' } }, null, 2));
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'prestashop'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'testing', 'site.feature'), path.join(scripts, 'plugins', 'prestashop', 'site.feature'));
  return { root, dir, scripts };
}

/** Run bash with the plugin's functions sourced and `ddev` replaced by a recorder (it also records what a command is fed). */
function bash(script: string, env: Record<string, string> = {}) {
  const r = spawnSync('bash', ['-c', `ddev() { echo "ddev $*" >> "\${DDEV_LOG:-/dev/null}" ; [ -t 0 ] || cat > /dev/null ; return 0 ; }\nsource ${FUNCTIONS}\n${script}`],
    { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  return r;
}

test('the default accounts are an administrator, an employee with a limited profile and two customers, with example addresses', () => {
  const r = bash('set_prestashop_users ; for u in "${users[@]}" ; do n="user_${u}_name" ; m="user_${u}_mail" ; p="user_${u}_password" ; l="user_${u}_role" ; k="user_${u}_kind" ; echo "${!n}|${!m}|${!p}|${!l}|${!k}" ; done');
  assert.strictEqual(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map((l) => l.split('|'));
  assert.deepStrictEqual(rows.map((x) => x[0]), ['administrator', 'salesman', 'customer', 'shopper']);
  assert.deepStrictEqual(rows.map((x) => x[3]), ['SuperAdmin', 'Salesman', 'Customer', 'Customer']);
  assert.deepStrictEqual(rows.map((x) => x[4]), ['employee', 'employee', 'customer', 'customer']);
  for (const [name, mail, password] of rows) {
    assert.strictEqual(mail, `${name}@example.com`, 'a test account of its own, never the workspace account');
    assert.ok(password.length >= 8, 'the shop asks for 8 characters or more');
  }
});

test('the testing hook adds the step pack, the back office, the two registries and a first feature to a shop, once', () => {
  const p = project('prestashop');
  const log = path.join(p.root, 'ddev.log');
  const run = () => bash(`cd ${p.dir} && testing_configure_prestashop ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1', DDEV_LOG: log });
  const r = run();
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/prestashop-steps'], '^2.0.1');
  assert.strictEqual(pkg.devDependencies['webship-js'], '^2.0.6', 'what was there stays');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const lines = cucumber.split('\n');
  const core = lines.findIndex((l) => l.includes('node_modules/webship-js/tests/step-definitions'));
  assert.strictEqual(lines[core + 1], "      'node_modules/@webship-js/prestashop-steps/tests/step-definitions/**/*.js',", 'the pack is listed right after webship-js');
  assert.match(cucumber, /backOffice: \{ folder: process\.env\.ADMIN_FOLDER \|\| 'admin-workspace' \},/);
  assert.match(cucumber, /admin: \{ email: process\.env\.SHOP_ADMIN_EMAIL \|\| 'administrator@example\.com', password: process\.env\.SHOP_ADMIN_PASSWORD \|\| '[^']+', name: 'Shop Admin' \},/);
  assert.match(cucumber, /salesman: \{ email: process\.env\.SHOP_SALESMAN_EMAIL \|\| 'salesman@example\.com', password: process\.env\.SHOP_SALESMAN_PASSWORD \|\| '[^']+', name: 'Sam Salesman' \},/);
  assert.match(cucumber, /shopper: \{ email: process\.env\.SHOP_SHOPPER_EMAIL \|\| 'shopper@example\.com'/);
  // Still a module node can load, with the registries where the pack reads them.
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; const w = c.worldParameters; console.log(JSON.stringify([c.require, Object.keys(w.employees), Object.keys(w.customers), w.backOffice.folder]))`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  const [requires, employees, customers, folder] = JSON.parse(loaded.stdout);
  assert.strictEqual(requires.length, 3);
  assert.deepStrictEqual(employees, ['admin', 'salesman'], 'the handle the pack signs in as, then the limited profile');
  assert.doesNotMatch(cucumber, /webmaster|account_/, 'the workspace account is in no registry');
  assert.deepStrictEqual(customers, ['customer', 'shopper']);
  assert.strictEqual(folder, 'admin-workspace');
  assert.ok(fs.existsSync(path.join(p.dir, 'tests', 'features', 'site.feature')));
  const calls = fs.readFileSync(log, 'utf8');
  assert.match(calls, /ddev exec -d \/var\/www\/html\/public PRESTASHOP_ACCOUNTS=employee\\\|administrator@example\.com\\\|\S+\\\|Shop\\\|Admin\\\|SuperAdmin\\;employee\\\|salesman@example\.com\\\|\S+\\\|Sam\\\|Salesman\\\|Salesman\\;customer\\\|customer@example\.com\S+ php -- add/, 'an installed shop gets the default accounts, in its docroot');
  // Again, after a person changed the feature: nothing is doubled, nothing is reset.
  fs.writeFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'Feature: mine\n');
  assert.strictEqual(run().status, 0);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), cucumber);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), 'Feature: mine\n');
});

test('the testing hook reads the folder of the back office from the project', () => {
  const p = project('prestashop');
  fs.renameSync(path.join(p.dir, 'public', 'admin-workspace'), path.join(p.dir, 'public', 'admin123abc'));
  const r = bash(`cd ${p.dir} && testing_configure_prestashop ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1' });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.match(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), /ADMIN_FOLDER \|\| 'admin123abc'/);
});

test('the testing hook leaves a project of another platform alone', () => {
  const p = project('other');
  const r = bash(`cd ${p.dir} && testing_configure_prestashop ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), SCAFFOLD);
  assert.ok(!fs.existsSync(path.join(p.dir, 'tests')));
});

test('the console tool refuses a project that is not a shop', () => {
  const p = project('other');
  const r = bash('PROJECT_NAME=shop1 ; RUN="list" ; trim_project_name() { :; } ; prestashop_cli_tool', { WORKSPACE_ROOT: p.root, doc_name: 'dev' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /is not a PrestaShop project/);
});

test('the console tool runs a command in the docroot of the shop, and cancels the default accounts by their address', () => {
  const p = project('prestashop');
  const log = path.join(p.root, 'ddev.log');
  const tool = (vars: string) => bash(`PROJECT_NAME=shop1 ; RUN=_none_ ; ${vars} ; trim_project_name() { :; } ; prestashop_cli_tool`, { WORKSPACE_ROOT: p.root, doc_name: 'dev', DDEV_LOG: log });
  assert.strictEqual(tool('RUN="prestashop:module:list"').status, 0);
  assert.match(fs.readFileSync(log, 'utf8'), /ddev exec -d \/var\/www\/html\/public SYMFONY_ENV=prod php bin\/console prestashop:module:list/);
  assert.strictEqual(tool('CLEAR_CACHE=yes').status, 0);
  assert.match(fs.readFileSync(log, 'utf8'), /SYMFONY_ENV=prod php bin\/console cache:clear --no-interaction/);
  const r = tool('CANCEL_USERS=yes');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /User mail: administrator@example\.com/);
  assert.match(r.stdout, /User mail: shopper@example\.com/);
  assert.match(fs.readFileSync(log, 'utf8'), /PRESTASHOP_ACCOUNTS=\S+ php -- cancel/);
});

test('--install is refused before anything is built when the workspace password is too short for the shop', () => {
  const p = project('other');
  const log = path.join(p.root, 'ddev.log');
  const r = bash('PROJECT_NAME=shop2 ; INSTALL=yes ; account_pass=short ; trim_project_name() { :; } ; prestashop_build', { WORKSPACE_ROOT: p.root, doc_name: 'dev', DDEV_LOG: log });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /8 characters/);
  assert.ok(!fs.existsSync(log), 'the container tool was not called');
  assert.ok(!fs.existsSync(path.join(p.root, 'dev', 'shop2')));
});

test('a version of another major line is refused before anything is built', () => {
  const p = project('other');
  const log = path.join(p.root, 'ddev.log');
  const r = bash('PROJECT_NAME=shop2 ; VERSION=8.2.3 ; trim_project_name() { :; } ; prestashop_build', { WORKSPACE_ROOT: p.root, doc_name: 'dev', DDEV_LOG: log });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /PrestaShop 9 shop/);
  assert.ok(!fs.existsSync(log), 'the container tool was not called');
});

test('a release is chosen from the list the project publishes: the newest stable one of the line, or the one named', () => {
  const list = JSON.stringify([
    { version: '10.0.0', distribution: 'classic', stability: 'stable', zip_download_url: 'https://example.org/10.zip', zip_md5: 'a' },
    { version: '9.3.0-rc.1', distribution: 'classic', stability: 'rc', zip_download_url: 'https://example.org/930rc.zip', zip_md5: 'b' },
    { version: '9.2.1', distribution: 'classic', stability: 'stable', zip_download_url: 'https://example.org/921.zip', zip_md5: 'c' },
    { version: '9.10.0', distribution: 'classic', stability: 'stable', zip_download_url: 'https://example.org/9100.zip', zip_md5: 'd' },
    { version: '9.1.0', distribution: 'classic', stability: 'stable', zip_download_url: 'https://example.org/910.zip', zip_md5: 'e' },
  ]);
  const pick = (wanted: string) => spawnSync('bash', ['-c', `ddev() { printf '%s' "$LIST" ; }\nsource ${FUNCTIONS}\nprestashop_release ${wanted}`], { encoding: 'utf8', env: { ...process.env, LIST: list } });
  assert.strictEqual(pick('latest').stdout.trim(), '9.10.0 https://example.org/9100.zip d', 'by number, not by text, and never another major line or a release candidate');
  assert.strictEqual(pick('9.1.0').stdout.trim(), '9.1.0 https://example.org/910.zip e');
  assert.strictEqual(pick('9.9.9').stdout.trim(), '', 'a version that is not on the list');
  assert.notStrictEqual(pick('9.9.9').status, 0);
});

test('the first feature names no platform in a step, signs in as each employee, and creates no account', () => {
  const feature = fs.readFileSync(path.join(PKG, 'testing', 'site.feature'), 'utf8');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  assert.ok(steps.length >= 10);
  for (const s of steps) assert.doesNotMatch(s, /prestashop/i, s);
  assert.match(feature, /the back office/);
  assert.match(feature, /the shop/);
  for (const handle of ['admin', 'salesman']) assert.match(feature, new RegExp(`^\\s*\\| ${handle} +\\|`, 'm'), `${handle} logs in to the back office`);
  assert.match(feature, /as "admin"\n\s+Then I should see "Modules" in the back office menu/, 'what the administrator opens');
  assert.match(feature, /as "salesman"\n\s+Then I should see "Orders > Orders" in the back office menu\n\s+But I should not see "Modules"/, 'and the salesman does not');
  assert.doesNotMatch(feature, /webmaster/, 'the workspace account is never written into a test');
  assert.doesNotMatch(feature, /registration|I register|create an account/i, 'a suite never creates an account');
  const passwords = feature.match(/ and "([^"]*)"$/gm) || [];
  assert.deepStrictEqual(passwords, [' and "wrong-password"'], 'the only password is a wrong one, the subject of its scenario');
});

// ---- The runtimes: DDEV as before, and Docker Compose, Podman, Kubernetes, Lando and Docksal through the core's layer ----

const ADDRESSES: Record<string, string> = {
  docker: 'http://127.0.0.1:41234', podman: 'http://127.0.0.1:41234', lando: 'http://127.0.0.1:41234',
  kubernetes: 'http://172.18.0.2:30080', docksal: 'http://shop1.docksal.site',
};
// Where each runtime keeps the project in its container: what `ddev exec pwd` answers from the project folder.
const ROOTS: Record<string, string> = { docker: '/var/www/html', podman: '/var/www/html', kubernetes: '/var/www/html', lando: '/app', docksal: '/var/www' };

/**
 * Run the builder in a throwaway workspace with `ddev` replaced by a recorder, the release list by a stand-in, and the
 * core's layer by stand-ins: `layer` is the runtime it answers with (runtime_of, rt_url, rt_claim), or '' for a core
 * that has no layer yet. The recorder answers `ddev exec pwd` with the runtime's root in the container.
 */
function build(layer: string, env: Record<string, string> = {}) {
  const p = project('prestashop');
  fs.rmSync(p.dir, { recursive: true });
  const log = path.join(p.root, 'ddev.log');
  const address = ADDRESSES[layer] || '';
  const prelude = [
    `ddev() { echo "ddev $*" >> "${log}" ; [ "$*" == "exec pwd" ] && echo "${ROOTS[layer] || '/var/www/html'}" ; [ -t 0 ] || cat > /dev/null ; return 0 ; }`,
    'trim_project_name() { :; } ; drop_database() { :; } ; ddev_nodejs_version() { echo 24 ; } ; ddev_up() { ddev "$@" ; }',
    layer ? `runtime_of() { echo "\${RUNTIME_ANSWER}" ; } ; rt_url() { [ "\${RUNTIME_ANSWER}" == ddev ] && echo "https://\${PROJECT_NAME}.ddev.site" || echo "${address}" ; } ; rt_claim() { echo "rt_claim $* in $(basename "$PWD")" >> "${log}" ; } ; rt_meta() { [ "$1" == docroot ] && echo public ; }` : '',
    `source ${FUNCTIONS}`,
    'prestashop_release() { echo "9.0.1 https://example.com/release.zip 0123456789abcdef" ; }',
    'prestashop_build',
  ].join('\n');
  const r = spawnSync('bash', ['-c', prelude], { encoding: 'utf8', env: { ...process.env, WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1',
    INSTALL: 'yes', ADD_USERS: 'no', LAUNCH: 'no', DEMO_CATALOG: 'yes', VERSION: 'latest', PHP_VERSION: '8.3', distribution_webroot: 'public',
    RUNTIME: '_none_', RUNTIME_ANSWER: layer || 'ddev', account_name: 'webmaster', account_pass: 'Change_Me.123123', account_mail: 'webmaster@example.com', ...env },
    stdio: ['ignore', 'pipe', 'pipe'] });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter((c) => /^(ddev|rt_claim) /.test(c)) : [];
  return { r, calls, dir: path.join(p.root, 'dev', 'shop1') };
}

test('on DDEV the build is what it was: the same commands with the layer and without it, HTTPS at the ddev.site domain', () => {
  const without = build('');
  const withLayer = build('ddev');
  for (const b of [without, withLayer]) {
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    assert.match(b.r.stdout, /Go to https:\/\/shop1\.ddev\.site\/admin-workspace and log in as webmaster@example\.com/);
  }
  assert.deepStrictEqual(withLayer.calls, without.calls);
  const install = without.calls.find((c) => c.includes('install/index_cli.php'));
  assert.ok(install && install.startsWith('ddev exec -d /var/www/html/public php install/index_cli.php --domain=shop1.ddev.site '), install);
  assert.match(install, / --ssl=1 /);
  assert.ok(!without.calls.includes('ddev exec pwd'), 'DDEV is not asked where the project is');
  assert.ok(!without.calls.some((c) => c.startsWith('rt_claim ')), 'on DDEV nothing is claimed');
});

test('on DDEV the builder leaves the plugin\'s claim, .ddev/config.prestashop.yaml, which the dashboard reads for the test users', () => {
  for (const layer of ['', 'ddev']) {
    const b = build(layer);
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    const claim = path.join(b.dir, '.ddev', 'config.prestashop.yaml');
    assert.ok(fs.existsSync(claim), `${layer || 'no layer'}: the claim is written`);
    const text = fs.readFileSync(claim, 'utf8');
    // An overlay of the container tool, with one key nothing of the shop reads: the same shape as the phpBB and
    // bbPress plugins' claims. The dashboard takes the name between "config." and ".yaml", and finds the list of the
    // same name (set_prestashop_users) in the plugin's functions.
    const keys = text.split('\n').filter((l) => /^[a-z_]+:/.test(l));
    assert.deepStrictEqual(keys, ['web_environment:'], layer);
    assert.match(text, /^web_environment:\n {2}- WEBSHIP_WORKSPACE_PLATFORM=prestashop\n$/m, layer);
    assert.match(path.basename(claim), /^config\.([a-z0-9][a-z0-9-]*)\.ya?ml$/);
    assert.match(fs.readFileSync(FUNCTIONS, 'utf8'), /^function set_prestashop_users\(\) \{$/m, 'the list the claim names');
  }
});

test('on Docker Compose, Podman, Kubernetes, Lando and Docksal the plugin claims the shop and installs it at the runtime\'s host, in the runtime\'s root, without HTTPS', () => {
  for (const runtime of Object.keys(ADDRESSES)) {
    const address = ADDRESSES[runtime];
    const host = address.replace(/^https?:\/\//, '');
    const root = `${ROOTS[runtime]}/public`;
    const b = build(runtime, { RUNTIME: runtime });
    assert.strictEqual(b.r.status, 0, runtime + ': ' + b.r.stderr + b.r.stdout);
    assert.deepStrictEqual(b.calls.slice(0, 2).map((c) => c.split(' --')[0]), ['ddev config', 'rt_claim prestashop in shop1'], runtime);
    assert.ok(b.calls.some((c) => c.includes(`unzip -q -o prestashop.zip -d '${root}'`)), `${runtime}: the code goes to the runtime's root`);
    const install = b.calls.find((c) => c.includes('install/index_cli.php'));
    assert.ok(install && install.startsWith(`ddev exec -d ${root} php install/index_cli.php --domain=${host} `), `${runtime}: ${install}`);
    assert.match(install, / --ssl=0 /, runtime);
    assert.match(install, /--db_server=db --db_name=db --db_user=db --db_password=db/, runtime);
    assert.ok(!fs.existsSync(path.join(b.dir, '.ddev')), `${runtime}: nothing of DDEV's is written`);
    assert.match(b.r.stdout, new RegExp(`Go to ${address.replace(/[.]/g, '\\.')}/admin-workspace and log in as webmaster@example\\.com`), runtime);
    assert.doesNotMatch(b.r.stdout, /ddev\.site/, runtime);
  }
});

test('--runtime on a workspace without the runtime layer is refused, never built on DDEV in silence', () => {
  const b = build('', { RUNTIME: 'docker' });
  assert.strictEqual(b.r.status, 1);
  assert.match(b.r.stdout, /--runtime docker needs a Webship Workspace with the container runtimes/);
  assert.deepStrictEqual(b.calls, []);
  assert.ok(!fs.existsSync(b.dir), 'no folder was made');
  assert.strictEqual(build('', { RUNTIME: 'ddev' }).r.status, 0);
});

test('the builder takes --runtime, with the runtimes of the core\'s own builders', () => {
  const args = fs.readFileSync(path.join(PKG, 'scripts', 'args', 'arg-prestashop.sh'), 'utf8');
  assert.match(args, /parser\.add_argument\('--runtime',\s+dest='RUNTIME',\s+default="_none_",\s+choices=\['ddev', 'docker', 'podman', 'kubernetes', 'lando', 'docksal'\],/);
});

/** A shop of another runtime: compose.yaml with the plugin's claim and the docroot, the shop's files, no .ddev folder. */
function runtimeShop() {
  const p = project('prestashop');
  fs.rmSync(path.join(p.dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(p.dir, 'compose.yaml'), 'name: shop1\nx-webship:\n  platform: prestashop\n  runtime: lando\n  type: php\n  docroot: "public"\n  port: 41234\n');
  return p;
}
const LAYER = 'runtime_of() { echo lando ; } ; rt_is_platform() { grep -q "^  platform: $2$" "$1/compose.yaml" 2>/dev/null ; } ; rt_meta() { sed -n "s/^  $1: *//p" "$2/compose.yaml" | head -1 | tr -d \'"\' ; } ; rt_url() { echo http://127.0.0.1:41234 ; } ; ';

test('a shop is known on every runtime: the claim through the core\'s layer, its docroot from the x-webship block', () => {
  const rt = runtimeShop();
  assert.strictEqual(bash(`${LAYER} prestashop_is_project ${rt.dir}`).status, 0);
  assert.notStrictEqual(bash(`prestashop_is_project ${rt.dir}`).status, 0, 'an older core reads no compose.yaml');
  assert.strictEqual(bash(`${LAYER} prestashop_docroot ${rt.dir}`).stdout, 'public');
  assert.strictEqual(bash(`prestashop_is_project ${project('prestashop').dir}`).status, 0, 'DDEV as before');
  assert.notStrictEqual(bash(`${LAYER} prestashop_is_project ${project('other').dir}`).status, 0);
});

test('the console tool runs in the runtime\'s root on a shop of a runtime, and says its address', () => {
  const rt = runtimeShop();
  const log = path.join(rt.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: rt.root, doc_name: 'dev', PROJECT_NAME: 'shop1', DDEV_LOG: log };
  const pwd = 'ddev() { echo "ddev $*" >> "${DDEV_LOG:-/dev/null}" ; [ "$*" == "exec pwd" ] && echo /app ; [ -t 0 ] || cat > /dev/null ; return 0 ; } ; ';
  const what = bash(`${pwd} ${LAYER} trim_project_name() { :; } ; RUN=_none_ ; CLEAR_CACHE=no ; ADD_USERS=no ; CANCEL_USERS=no ; prestashop_cli_tool`, env);
  assert.strictEqual(what.status, 0, what.stdout + what.stderr);
  assert.match(what.stdout, /^dev\/shop1: .* at http:\/\/127\.0\.0\.1:41234$/m);
  assert.match(what.stdout, /^The back office: http:\/\/127\.0\.0\.1:41234\/admin-workspace$/m);
  assert.doesNotMatch(what.stdout, /ddev\.site/);
  fs.writeFileSync(log, '');
  bash(`${pwd} ${LAYER} trim_project_name() { :; } ; RUN="prestashop:module:list" ; prestashop_cli_tool`, env);
  assert.match(fs.readFileSync(log, 'utf8'), /^ddev exec -d \/app\/public SYMFONY_ENV=prod php bin\/console prestashop:module:list$/m);
});

test('the feature of the runtimes drives a shop the plugin claims, and names no platform in a step', () => {
  const feature = fs.readFileSync(path.join(PKG, 'features', 'prestashop-runtimes.feature'), 'utf8');
  const scenarios = feature.split(/\n(?=  @needs-runtime-)/).slice(1);
  assert.strictEqual(scenarios.length, 6);
  for (const s of scenarios) assert.match(s, /^  @needs-runtime-(docker|kubernetes) @needs-platform-prestashop\n  Scenario: /);
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  for (const s of steps) assert.doesNotMatch(s, /prestashop/i, s);
  assert.doesNotMatch(feature, /ddev\.site|127\.0\.0\.1/);
  const manifest = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).workspacePlugin;
  assert.ok(manifest.features.includes('features/prestashop-runtimes.feature'));
  assert.match(manifest.featuresSite, /^cmd-prestashop-project\.sh ci-prestashop( [A-Za-z0-9._=-]+)* --runtime docker$/);
});
