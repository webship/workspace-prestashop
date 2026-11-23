# @webship.co/workspace-prestashop

PrestaShop for the [Webship Workspace](https://github.com/webship/workspace) dashboard: a builder
that makes a real PrestaShop shop in a container, a console tool for the shops it built, the default
accounts, the [PrestaShop step pack](https://github.com/webship/prestashop-steps) wired into the
workspace's testing setup, and its AI items — two agents, a skill, a
command and a prompt — each listed in the workspace folder of its kind.

The workspace is container-based (DDEV by default): a PrestaShop project is a row like any other, so
the row menus the core draws (start, stop, launch, backup, clone, remove, tests) work on it unchanged.

It is made from the reference platform plugin,
[`@webship.co/workspace-wordpress`](https://github.com/webship/workspace-wordpress).

Only the open-source release is built, on the 9.x line. Nothing outside the shop is connected: no
account of a vendor, no marketplace, no paid module, no payment method that calls a service, and no
e-mail that leaves the shop.

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require github:webship/workspace-prestashop   # npm install into the dashboard
bash core/scripts/plugins.sh --activate prestashop                            # plugins.prestashop in settings.yml
bash core/scripts/plugins.sh --install prestashop                             # commands, functions, args, AI items
bash core/scripts/plugins.sh --configure prestashop                           # nothing to configure: it has no settings file
```

The same four steps are buttons on the dashboard's **Settings → Plugins** page. `--install` is
idempotent. `--uninstall` removes what it placed; an AI item you edited stays.

Everything the plugin carries lands in the folder it belongs to, when that folder is an active
workspace folder:

| What | Lands in |
| --- | --- |
| `cmd-prestashop-project.sh`, `cmd-tools-prestashop-cli.sh` | every active sites folder: `dev/`, `test/`, `sandboxes/`, `demos/` |
| The agents `prestashop-site-builder`, `prestashop-tester` | `ai-agents/` |
| The skill `prestashop-scenarios` | `ai-skills/` |
| The command `/prestashop-test` | `ai-commands/` |
| The prompt `prestashop-build-and-test` | `ai-prompts/` |

There they are listed like any other item of the folder, and installed into Claude Code from there.

It needs a Webship Workspace 1.0.7 or later.

## What it needs

A workspace starts empty, so the manifest says what else this plugin needs (`needs`):

- one sites folder, for the builder and the tool: `dev`, `test`, `sandboxes`, `demos` (`dev` is the one added when none is there). The folder also carries `cmd-tools-testing.sh` and the Users tools this plugin's hooks answer to.
- `ai-agents`, `ai-skills`, `ai-commands` and `ai-prompts`: the AI folders its agents, its skill, its command and its prompt are placed in.

`--require` says so, `--activate` and `--install` stop until the workspace has them, and `--with-needs` adds what is missing first:

```bash
bash core/scripts/plugins.sh --activate prestashop --with-needs   # dev and the four AI folders are required, activated and installed first
bash core/scripts/plugins.sh --install prestashop
```

Everything the builder runs for a site runs in the site's own container, through the container tool the workspace already needs; the plugin asks for no command of its own on the machine.

A workspace that knows none of this (Webship Workspace 1.0.8 and older) ignores the keys: add a sites folder and the AI folders yourself, then `--install prestashop` again. A kind whose folder is not there is skipped, and the install says so.

## What the package holds

| Path | What it is |
| --- | --- |
| `commands/cmd-prestashop-project.sh` | The builder, in the Build list as **PrestaShop (9.x)**, installed into every sites folder |
| `commands/cmd-tools-prestashop-cli.sh` | The console of the shop (`bin/console`) for one project: what the shop is, a command, the cache, the default accounts |
| `scripts/functions/fun-prestashop.sh` | The bash functions behind both, sourced by bootstrap once installed; the names the core's tools look for (`set_prestashop_users`, `add_prestashop_users`, `cancel_prestashop_users`, `testing_configure_prestashop`) |
| `scripts/args/arg-prestashop.sh`, `arg-prestashop-cli.sh` | Their argparse; the Build form draws the builder's flags from the first |
| `testing/site.feature` | The first feature a PrestaShop project gets when testing is set up |
| `ai/agents/prestashop-site-builder.md` | The agent that builds and maintains PrestaShop shops with these commands |
| `ai/agents/prestashop-tester.md` | The agent that writes and runs scenarios with the PrestaShop step pack |
| `ai/skills/prestashop-scenarios/` | The skill: the step pack's phrases by area, the traps found on a real shop, three example features |
| `ai/commands/prestashop-test.md` | The slash command `/prestashop-test <shop>`: set up, match every step, run, report |
| `ai/prompts/prestashop-build-and-test.md` | A prompt: the whole launch command for a new session |
| `src/index.ts` | `register(api)`: what the assistant is told about PrestaShop here |
| `features/prestashop.feature` | Scenarios for the dashboard's own browser suite |
| `features/prestashop-runtimes.feature` | The row, the test users and two pages of a shop built on Docker Compose and on Kubernetes |
| `docs/plugin-items-pattern.md` | How a plugin carries its own commands and AI items, and how to prove it |

The `workspacePlugin` block in `package.json` is the manifest the installer reads.

## The commands

Run them from a sites folder. `--help` is safe on both.

### Build a shop

```bash
cd ~/workspace/dev
bash cmd-prestashop-project.sh myshop --install --add-users
```

| Flag | What it does |
| --- | --- |
| `--version <x>` | The PrestaShop 9 release to download: `latest` (the default: the latest stable 9.x release), or a number such as `9.2.1` |
| `--install` | Install the shop, with the workspace account as its SuperAdmin |
| `--add-users` | With `--install`: add the default accounts, an administrator, an employee with a limited profile and two customers |
| `--demo-catalog <yes\|no>` | With `--install`: the demo catalog of the release (products, categories, customers, orders). `yes` by default; `no` gives an empty shop |
| `--php-version <x>` | The PHP of the project container (`8.3`) |
| `--runtime <name>` | The container runtime to build on: `ddev` (the default), `docker`, `kubernetes`, `podman`, `lando` or `docksal`. See [Runtimes](#runtimes) |
| `--launch` | Open the shop when it is ready |

On DDEV the shop answers at `https://myshop.ddev.site`, the back office at `/admin-workspace`. The container
tool has no project type for PrestaShop, so the build runs `ddev config --project-type=php` with the
docroot `public`, Apache (the shop routes its addresses through `.htaccess`), MariaDB 10.11 and the
Node.js of the workspace (24). It reads the release list the project publishes, downloads the
archive of the release in the container, checks it against its checksum, unpacks the shop, and
installs it with the shop's own command-line installer: SSL on, the domain set to the project's
address. The installer is given the container's database values (`db` / `db` / `db`), the same in
every project, and nothing personal. A project of the same name is deleted first.

What the build does to keep the shop to itself:

- **Only the modules of the open-source release are installed.** The installer is handed their
  list. The marketplace, account, hosted checkout, marketing and assistant modules that travel in
  the downloaded archive stay uninstalled.
- **No e-mail is sent.** The mail method is set to "never send".
- **The back office has a known folder.** The installer gives it a random name; the builder renames
  it to `admin-workspace`, and removes the `install` folder the shop refuses to run with.

An employee and a customer sign in with their e-mail address: the SuperAdmin with the address of
the workspace account. The shop asks for a password of 8 characters or more: `--install` stops
before it starts when the workspace account's is shorter.


### Runtimes

```bash
bash cmd-prestashop-project.sh myshop --install --add-users                        # DDEV, the default
bash cmd-prestashop-project.sh myshop --install --add-users --runtime docker       # Docker Compose
bash cmd-prestashop-project.sh myshop --install --add-users --runtime kubernetes   # a Kubernetes cluster
bash cmd-prestashop-project.sh myshop --install --add-users --runtime lando        # Lando
bash cmd-prestashop-project.sh myshop --install --add-users --runtime docksal      # Docksal
```

Without `--runtime` a build takes `container.runtime` of the workspace's `settings.yml`, then DDEV.
It needs a Webship Workspace with the container runtimes
([webship/workspace#694](https://github.com/webship/workspace/issues/694)); on an older one the
builder refuses `--runtime` and builds on DDEV only. Lando and Docksal need a Workspace whose runtime
layer has them ([webship/workspace#729](https://github.com/webship/workspace/issues/729),
[#730](https://github.com/webship/workspace/issues/730)).

| | DDEV | Docker Compose | Kubernetes | Podman | Lando | Docksal |
| --- | --- | --- | --- | --- | --- | --- |
| Build with `--install --add-users`, the demo catalog | Yes | Yes | Yes | Not yet run | Yes | Yes |
| The shop and its back office; a sign-in as the workspace account, the two employees (the Salesman profile refused what it may not open) and a customer | Yes | Yes | Yes | Not yet run | Yes | Yes |
| `cmd-tools-prestashop-cli.sh`: what the shop is, with its accounts, `--run`, `--clear-cache` | Yes | Yes | Yes | Not yet run | Yes | Yes |
| Test users, cancelled and added | Yes | Yes | Yes | Not yet run | Yes | Yes |
| The mailbox: the shop sends nothing (its password recovery adds no mail), PHP's own `mail()` is caught by Mailpit | Yes | Yes | Yes | Not yet run | Yes | Yes |
| The testing setup and the first feature | Yes | Yes | Yes | Not yet run | Yes | Yes |
| The step pack's examples (74 scenarios) | Yes | Yes | Yes | Not yet run | Yes | Yes |
| Export and import the database | Yes | Yes | Yes | Not yet run | Yes | Yes |
| The row in the dashboard, and remove | Yes | Yes | Yes | Not yet run | Yes | Yes |

"Yes" means it was run on a real shop of that runtime. Podman runs the same code as Docker Compose
and was not run yet. On DDEV the row's Tests menu does not offer the test users of a shop, as before:
the project type `php` names no platform, and the builder writes no claim of the plugin there (on the
other runtimes it does). `bash cmd-tools-add-users.sh myshop prestashop` adds them on every runtime.

| Runtime | The shop's address | What the project carries |
| --- | --- | --- |
| DDEV | `https://myshop.ddev.site` | `.ddev/config.yaml` |
| Docker Compose | `http://127.0.0.1:<port>`, printed by the build | `compose.yaml`, `.webship/runtime/Dockerfile` |
| Kubernetes | `http://<node address>:<port>`, printed by the build | The same, and `k8s/` (the namespace `ws-myshop`) |
| Lando | `http://127.0.0.1:<port>`, printed by the build | `.lando.yml` (Lando's proxy stays off) |
| Docksal | `http://myshop.docksal.site`, on Docksal's own proxy | `.docksal/docksal.env`, `.docksal/docksal.yml` |

What differs on Docker Compose, Kubernetes, Lando and Docksal:

- **The address the installer is given** is the runtime's (`127.0.0.1:<port>`, the node's address and a port, or `<name>.docksal.site`), with no HTTPS (`--ssl=0`) where the runtime serves plain HTTP. The shop keeps its address in its database: a shop stays on the runtime it was built on.
- **Where the shop is in its container** (`/var/www/html/public`, `/app/public` on Lando, `/var/www/public` on Docksal) is asked of the container, for the code's unpacking, the console and the accounts.
- **The claim:** the project's type is `php`, which says nothing of the platform, so the build claims the project for the plugin (`rt_claim prestashop`): `cmd-tools-prestashop-cli.sh`, the test users, the testing setup and the dashboard then know it is a shop.
- **Mail:** the shop sends none on any runtime, as on DDEV (the builder sets its mail method to never send); the runtime's mail catcher is there for the rest of the project, and PHP's own `mail()` reaches it.
- **HTTPS and a host name** are DDEV's: a runtime's address is plain HTTP.

The same commands work on every runtime: `cmd-tools-prestashop-cli.sh`, `cmd-tools-add-users.sh`,
`cmd-tools-testing.sh`. The pattern is the Workspace's
[`core/docs/plugins-on-runtimes.md`](https://github.com/webship/workspace/blob/1.0.x/core/docs/plugins-on-runtimes.md).

### Work on a shop

```bash
bash cmd-tools-prestashop-cli.sh myshop                                  # version, addresses, employees and customers
bash cmd-tools-prestashop-cli.sh myshop --run "list"                     # every command of the console
bash cmd-tools-prestashop-cli.sh myshop --run "prestashop:module:list"
bash cmd-tools-prestashop-cli.sh myshop --clear-cache                    # clear the cache
bash cmd-tools-prestashop-cli.sh myshop --add-users                      # the default accounts
bash cmd-tools-prestashop-cli.sh myshop --cancel-users                   # delete them
```

The console runs in the environment the shop is served in (`prod`); `--env=dev` in a command names
another. The tool has no `--update`: the console of the shop has no command that updates the shop
itself. A newer release is a new build.

### The default accounts

| Account | What it is | Handle in the tests | Signs in to |
| --- | --- | --- | --- |
| the workspace account (Workspace Owner) | the SuperAdmin, made by the installer | none: it is never written into a test | the back office |
| `administrator@example.com` (Shop Admin) | an employee with the SuperAdmin profile | `admin` | the back office |
| `salesman@example.com` (Sam Salesman) | an employee with the Salesman profile | `salesman` | the back office |
| `customer@example.com` (Clara Customer) | a customer with one address | `customer` | the shop |
| `shopper@example.com` (Simon Shopper) | a second customer with one address | `shopper` | the shop |

The four default accounts have the password of the workspace's other default lists. They are for
local shops and for tests. The administrator is a test account of its own, so the features of the step
pack that sign in as `admin` run on a built shop and the workspace account stays out of every test. The console of the shop makes a SuperAdmin and no other account, so they
are made in the container through the shop's own classes, without the browser.
`bash cmd-tools-add-users.sh myshop prestashop` and `bash cmd-tools-cancel-users.sh myshop prestashop`
add and remove the same list.

The **Users** menu of a project row does not add them: the dashboard reads the user list of a row
from the DDEV project type, and a PrestaShop project is a `php` project, because the container tool
has no type for PrestaShop. Use the console tool or the two commands above.

### Test a shop

```bash
bash cmd-tools-testing.sh myshop                 # webship-js, the step pack, the accounts, a first feature
bash cmd-tools-testing.sh myshop --run           # run the suite in the container
bash cmd-tools-testing.sh myshop --run --path tests/features/site.feature
```

`cmd-tools-testing.sh` is the workspace's own. For a PrestaShop project it also adds
`@webship-js/prestashop-steps` to `package.json`, lists its step definitions in `cucumber.js` after
webship-js's own, writes the folder of the back office (`backOffice.folder`, overridable with
`ADMIN_FOLDER`) and the two registries of accounts (`employees` and `customers`: the handles above,
overridable with `SHOP_<HANDLE>_EMAIL` and `SHOP_<HANDLE>_PASSWORD`), places
`tests/features/site.feature` when the project has none, and makes sure the default accounts are in
the shop. Run it again and it adds what is missing and keeps what you changed.

## The AI items

`ai/` in the package holds one folder per kind, the manifest's `ai` block names each item, and
`--install` places it in the workspace folder of that kind.

| Kind | Item | Use it to |
| --- | --- | --- |
| Agent | `prestashop-site-builder` | Build, maintain or remove a PrestaShop shop with the commands above, in containers only, with the open-source release and nothing connected outside the shop |
| Agent | `prestashop-tester` | Set the testing stack up, look at the shop in the Playwright MCP browser first, write scenarios from the pack's steps and run them; it never creates an account in a suite and never writes a platform name into a step phrase |
| Skill | `prestashop-scenarios` | Write a scenario from phrases that exist: the pack's steps by area (the back office and its lists, products, modules, the catalog of the shop, the cart, the customer account), the handles of the two registries, the traps found on a real shop, and three features that pass on a fresh shop with the demo catalog |
| Command | `/prestashop-test <shop> [feature or @tag]` | Run the suite of a shop from inside a session: set up when missing, match every step, run, report what failed and why |
| Prompt | `prestashop-build-and-test` | Start a session that builds a shop, says what it is, sets the testing stack up and runs the first feature |

After `--install` each is in its folder on the dashboard. **Install** there puts an agent, a skill
or a command into Claude Code (`~/.claude/agents`, `~/.claude/skills`, `~/.claude/commands`), or
from the command line:

```bash
cd ~/workspace/ai-agents   && bash cmd-tools-ai-items.sh prestashop-tester --install
cd ~/workspace/ai-skills   && bash cmd-tools-ai-items.sh prestashop-scenarios --install
cd ~/workspace/ai-commands && bash cmd-tools-ai-items.sh prestashop-test --install
```

A prompt is not installed: it is the whole `claude …` launch command of a new session, and the
dashboard's **New screen** form lists it as a template. By hand, fill the placeholders in and run
the command of the file from the folder it names.

Every step phrase the items show is checked against the definitions of the step pack and of
webship-js (`tests/fixtures/step-definitions.txt`), and every command and flag against the
plugin's own.

## Develop it

```bash
npm install     # builds dist/ (TypeScript)
npm run lint
npm test        # the manifest, the commands, the AI items, the functions against a scaffolded project
```
