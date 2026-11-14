import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { register, assistantContext, PLATFORM, COMMANDS, AGENTS } from '../src/index';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(PKG, f), 'utf8');
const manifest = JSON.parse(read('package.json')).workspacePlugin;

test('the manifest names the platform, and every file it names ships', () => {
  assert.strictEqual(manifest.name, PLATFORM);
  const named = [...manifest.commands.files, ...manifest.scripts.functions, ...manifest.scripts.args, ...manifest.scripts.machine,
    ...manifest.ai.agents, ...manifest.features];
  for (const f of named) assert.ok(fs.existsSync(path.join(PKG, f)), `${f} is in the package`);
  assert.deepStrictEqual(manifest.commands.files.map((f: string) => path.basename(f)), COMMANDS);
  assert.deepStrictEqual(manifest.ai.agents.map((f: string) => path.basename(f, '.md')), AGENTS);
  assert.deepStrictEqual(manifest.commands.types, ['sites'], 'the commands go to sites folders only');
  const files: string[] = JSON.parse(read('package.json')).files;
  for (const f of named) assert.ok(files.includes(f.split('/')[0]), `${f} is published with the package`);
});

test('every command finds the workspace by itself, names its folder, and sources its args from where the installer puts them', () => {
  for (const f of manifest.commands.files) {
    const src = read(f);
    assert.match(src, /^#!\/usr\/bin\/env bash/, `${f} is a bash script`);
    assert.match(src, /WORKSPACE_SCRIPTS="\$\{WORKSPACE_SCRIPTS:-\$\(cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/\.\.\/core\/scripts" && pwd\)\}"/, `${f} locates the tooling from its own path`);
    assert.match(src, /workspace\.__WORKSPACE__\.settings\.yml/, `${f} loads the settings of the folder it is installed into`);
    assert.match(src, /source \$\{WORKSPACE_SCRIPTS\}\/plugins\/prestashop\/args\/arg-[a-z-]+\.sh \|\| exit 1 ;/, `${f} reads its arguments from the plugin's args`);
    const last = src.trim().split('\n').pop() as string;
    assert.match(read('scripts/functions/fun-prestashop.sh'), new RegExp(`^function ${last.replace(/ ;$/, '')}\\(\\)`, 'm'), `${f} ends by calling a function the plugin defines`);
  }
  assert.match(read('commands/cmd-prestashop-project.sh'), /^# workspace-name: PrestaShop/m, 'the builder carries the name the Build list shows');
  assert.doesNotMatch(read('commands/cmd-tools-prestashop-cli.sh'), /^# workspace-name:/m, 'a tool is not a builder');
});

test('every shell script parses', () => {
  for (const f of [...manifest.commands.files, ...manifest.scripts.functions, ...manifest.scripts.args]) {
    const r = spawnSync('bash', ['-n', path.join(PKG, f)], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test('the functions carry the names the core\'s tools look for, and give the installer only the container\'s database values', () => {
  const src = read('scripts/functions/fun-prestashop.sh');
  for (const fn of ['set_prestashop_users', 'add_prestashop_users', 'cancel_prestashop_users', 'testing_configure_prestashop', 'prestashop_build', 'prestashop_cli_tool']) {
    assert.match(src, new RegExp(`^function ${fn}\\(\\) \\{`, 'm'), `${fn} is defined`);
  }
  assert.match(src, /--project-type=php /, 'the container tool has no project type for PrestaShop');
  assert.match(src, /--db_server=db --db_name=db --db_user=db --db_password=db /, 'the installer gets the container\'s own database values');
  assert.doesNotMatch(src, /--db_(server|name|user|password)=(?!db )/, 'and no other');
  assert.match(src, /--nodejs-version=\$\(ddev_nodejs_version\)/, 'the build runs the Node.js of the workspace rule');
  assert.doesNotMatch(src, /ddev stop -y/, 'ddev stop takes no -y');
});

test('the build keeps the shop to itself: the open-source modules only, SSL on, no e-mail, a checked download', () => {
  const src = read('scripts/functions/fun-prestashop.sh');
  const modules = (src.match(/^readonly PRESTASHOP_MODULES='([^']+)';$/m) || [])[1].split(',');
  assert.ok(modules.length > 50, 'the list of the open-source release');
  assert.deepStrictEqual(modules, [...new Set(modules)], 'no module twice');
  for (const m of ['ps_wirepayment', 'ps_checkpayment', 'ps_cashondelivery', 'ps_shoppingcart', 'ps_facetedsearch']) assert.ok(modules.includes(m), `${m} is installed`);
  // What travels in the downloaded archive and reaches outside the shop: a marketplace, a vendor account, a hosted checkout, marketing, an assistant.
  for (const m of ['ps_mbo', 'ps_accounts', 'ps_checkout', 'ps_eventbus', 'ps_facebook', 'psxmarketingwithgoogle', 'klaviyopsautomation', 'psshipping',
    'ps_distributionapiclient', 'ps_classic_edition', 'ps_ask_ai', 'ps_mcp_server', 'ps_mcp_tools']) {
    assert.ok(!modules.includes(m), `${m} stays uninstalled`);
  }
  assert.match(src, /--modules=\$\{PRESTASHOP_MODULES\}/, 'the installer is handed that list');
  assert.match(src, /--ssl=1 /, 'SSL is on');
  assert.match(src, /--domain=\$\{host\} /, 'the domain is the address of the project');
  assert.match(src, /--fixtures=\$\{fixtures\} /, 'the demo catalog is an option');
  assert.match(src, /SET value='3' WHERE name='PS_MAIL_METHOD'/, 'the shop never sends an e-mail');
  assert.match(src, /md5sum -c -/, 'the archive is checked against the checksum of the release list');
  assert.match(src, /api\.prestashop-project\.org\/prestashop'/, 'the release list is the open-source project\'s');
  assert.doesNotMatch(src, /addons\.prestashop|ps_accounts|ps_mbo/, 'nothing of a marketplace or a vendor account');
});

test('each agent is a definition the AI Agents folder can list: named after its file, described, on the fable model', () => {
  for (const f of manifest.ai.agents) {
    const src = read(f);
    const head = src.split('\n---\n')[0];
    assert.match(head, /^---\n/, `${f} opens with frontmatter`);
    assert.match(head, new RegExp(`^name: ${path.basename(f, '.md')}$`, 'm'));
    assert.match(head, /^description: .{80,}$/m, `${f} says when to use it`);
    assert.match(head, /^model: fable$/m);
    assert.match(head, /^tools:\n(  - \S+\n?)+/m);
    assert.match(src, /cmd-tools-testing\.sh|cmd-prestashop-project\.sh/, `${f} names the plugin's commands`);
  }
  const tester = read('agents/prestashop-tester.md');
  assert.match(tester, /Never create an account in a suite/);
  assert.match(tester, /No platform name in a step phrase/);
  assert.match(tester, /Playwright MCP browser first/);
  assert.match(tester, /Never the workspace account/);
  assert.match(tester, /`admin` \| employees \| `administrator@example\.com`/, 'the tester knows the administrator test account by its handle');
  const builder = read('agents/prestashop-site-builder.md');
  assert.match(builder, /Containers only/);
  assert.match(builder, /Open-source only/);
});

test('register() adds the assistant context and nothing else', () => {
  const calls: string[] = [];
  const api: any = { name: 'prestashop', addAssistantContext: (fn: () => string) => calls.push(fn()) };
  register(api);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0], assistantContext());
  for (const c of COMMANDS) assert.ok(calls[0].includes(c), `the assistant is told about ${c}`);
  for (const a of AGENTS) assert.ok(calls[0].includes(a), `the assistant is told about ${a}`);
});

test('the docs say container-based, name only Webship, and carry no personal value', () => {
  const docs = ['README.md', ...manifest.ai.agents, 'scripts/functions/fun-prestashop.sh'];
  for (const f of docs) {
    const src = read(f);
    assert.doesNotMatch(src, /DDEV-only/i, `${f}: the workspace is container-based, DDEV by default`);
    assert.doesNotMatch(src, /\/home\/(?!YOUR_USER)[a-z]/, `${f} carries no personal path`);
    const mails = src.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[a-z]{2,}/g) || [];
    for (const m of mails) assert.match(m, /@example\.(com|org)$/, `${f}: ${m} is not an example address`);
  }
  for (const c of COMMANDS) assert.ok(read('README.md').includes(c), `the README lists ${c}`);
  assert.match(read('README.md'), /container-based \(DDEV by default\)/);
  assert.match(read('README.md'), /`administrator@example\.com` \(Shop Admin\) \| an employee with the SuperAdmin profile \| `admin`/, 'the README lists the administrator test account');
  // A PrestaShop project is a php project to the container tool, so the row's Users menu cannot know its list.
  for (const f of ['README.md', 'agents/prestashop-site-builder.md']) {
    assert.match(read(f), /Users\*{0,2} menu[^.]*(does not add|adds no)/, `${f} says the row's Users menu does not add the accounts`);
    assert.match(read(f), /cmd-tools-add-users\.sh (myshop|<name>) prestashop/, `${f} names the command that does`);
  }
});
