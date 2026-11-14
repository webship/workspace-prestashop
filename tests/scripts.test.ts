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

test('the default accounts are an employee with a limited profile and two customers, with example addresses', () => {
  const r = bash('set_prestashop_users ; for u in "${users[@]}" ; do n="user_${u}_name" ; m="user_${u}_mail" ; p="user_${u}_password" ; l="user_${u}_role" ; k="user_${u}_kind" ; echo "${!n}|${!m}|${!p}|${!l}|${!k}" ; done');
  assert.strictEqual(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map((l) => l.split('|'));
  assert.deepStrictEqual(rows.map((x) => x[0]), ['salesman', 'customer', 'shopper']);
  assert.deepStrictEqual(rows.map((x) => x[3]), ['Salesman', 'Customer', 'Customer']);
  assert.deepStrictEqual(rows.map((x) => x[4]), ['employee', 'customer', 'customer']);
  for (const [name, mail, password, role] of rows) {
    assert.strictEqual(mail, `${name}@example.com`);
    assert.ok(password.length >= 8, 'the shop asks for 8 characters or more');
    assert.notStrictEqual(role, 'SuperAdmin', 'the SuperAdmin is the workspace account, never a default account');
  }
});

test('the testing hook adds the step pack, the back office, the two registries and a first feature to a shop, once', () => {
  const p = project('prestashop');
  const log = path.join(p.root, 'ddev.log');
  const run = () => bash(`cd ${p.dir} && testing_configure_prestashop ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1', DDEV_LOG: log });
  const r = run();
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/prestashop-steps'], '^2.0.0');
  assert.strictEqual(pkg.devDependencies['webship-js'], '^2.0.6', 'what was there stays');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const lines = cucumber.split('\n');
  const core = lines.findIndex((l) => l.includes('node_modules/webship-js/tests/step-definitions'));
  assert.strictEqual(lines[core + 1], "      'node_modules/@webship-js/prestashop-steps/tests/step-definitions/**/*.js',", 'the pack is listed right after webship-js');
  assert.match(cucumber, /backOffice: \{ folder: process\.env\.ADMIN_FOLDER \|\| 'admin-workspace' \},/);
  assert.match(cucumber, /salesman: \{ email: process\.env\.SHOP_SALESMAN_EMAIL \|\| 'salesman@example\.com', password: process\.env\.SHOP_SALESMAN_PASSWORD \|\| '[^']+', name: 'Sam Salesman' \},/);
  assert.match(cucumber, /shopper: \{ email: process\.env\.SHOP_SHOPPER_EMAIL \|\| 'shopper@example\.com'/);
  // Still a module node can load, with the registries where the pack reads them.
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; const w = c.worldParameters; console.log(JSON.stringify([c.require, Object.keys(w.employees), Object.keys(w.customers), w.backOffice.folder]))`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  const [requires, employees, customers, folder] = JSON.parse(loaded.stdout);
  assert.strictEqual(requires.length, 3);
  assert.deepStrictEqual(employees, ['salesman'], 'the SuperAdmin is in no registry');
  assert.deepStrictEqual(customers, ['customer', 'shopper']);
  assert.strictEqual(folder, 'admin-workspace');
  assert.ok(fs.existsSync(path.join(p.dir, 'tests', 'features', 'site.feature')));
  const calls = fs.readFileSync(log, 'utf8');
  assert.match(calls, /ddev exec -d \/var\/www\/html\/public PRESTASHOP_ACCOUNTS=employee\\\|salesman@example\.com\\\|\S+\\\|Sam\\\|Salesman\\\|Salesman\\;customer\\\|customer@example\.com\S+ php -- add/, 'an installed shop gets the default accounts, in its docroot');
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

test('the first feature names no platform in a step, no account of the workspace, and creates no account', () => {
  const feature = fs.readFileSync(path.join(PKG, 'testing', 'site.feature'), 'utf8');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  assert.ok(steps.length >= 10);
  for (const s of steps) assert.doesNotMatch(s, /prestashop/i, s);
  assert.match(feature, /the back office/);
  assert.match(feature, /the shop/);
  assert.doesNotMatch(feature, /as "admin"/, 'the SuperAdmin is never written into a test');
  assert.doesNotMatch(feature, /registration|I register|create an account/i, 'a suite never creates an account');
  const passwords = feature.match(/ and "([^"]*)"$/gm) || [];
  assert.deepStrictEqual(passwords, [' and "wrong-password"'], 'the only password is a wrong one, the subject of its scenario');
});
