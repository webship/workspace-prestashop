---
name: prestashop-scenarios
description: Write and run webship-js scenarios for a PrestaShop shop of the Webship Workspace with the PrestaShop step pack (`@webship-js/prestashop-steps`) — the phrases of the pack by area (the back office session, menu and lists, products, modules, the catalog of the shop, the product page and the cart, the customer account), the handles of the employees and customers registries, and the workspace command that runs them in the shop's container. Use when asked to "write a scenario for this shop", "test the salesman profile", "which step is there for the cart", "add a feature for creating a product", or when a `.feature` file of a PrestaShop project is being written or fixed.
argument-hint: '<shop> [what to cover]'
---

# prestashop-scenarios

Scenarios for a PrestaShop shop of a Webship Workspace (`~/workspace`, container-based, DDEV by
default), written from the steps of
[`@webship-js/prestashop-steps`](https://github.com/webship/prestashop-steps) and of
[webship-js](https://github.com/webship/webship-js) itself, and run in the shop's container by the
workspace's own command. It comes with the PrestaShop plugin (`@webship.co/workspace-prestashop`),
like the builder (`cmd-prestashop-project.sh`), the console tool (`cmd-tools-prestashop-cli.sh`)
and the agents `prestashop-site-builder` and `prestashop-tester`.

## Where everything is

| What | Where |
| --- | --- |
| The shop | `~/workspace/<folder>/<shop>`, at `https://<shop>.ddev.site`, the back office at `/admin-workspace` (`<folder>` is a sites folder: `dev`, `test`, `sandboxes`, `demos`) |
| The suite's configuration | `<shop>/cucumber.js`: the step definitions it loads, the folder of the back office, and the two registries of accounts (`employees`, `customers`) |
| The features | `<shop>/tests/features/*.feature` (`site.feature` is the first one the setup wrote) |
| The pack's steps | `<shop>/node_modules/@webship-js/prestashop-steps/tests/step-definitions/*.steps.js` |
| webship-js's steps | `<shop>/node_modules/webship-js/tests/step-definitions/*.js` |
| The reports | `<shop>/tests/reports/` |

## The order of work

1. **Make sure the testing stack is there.** From the sites folder:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <shop>
   ```
   It adds webship-js, the step pack, the registries of accounts and
   `tests/features/site.feature`, and makes sure the default accounts are in the shop. It is safe
   to run again: it adds what is missing and keeps what was changed.
2. **Read the installed steps before writing a phrase.** They are the source of truth: the pack
   moves, and a phrase from memory is a guess.
   ```bash
   cd ~/workspace/<folder>/<shop>
   grep -hE "^(Given|When|Then)\(" node_modules/@webship-js/prestashop-steps/tests/step-definitions/*.steps.js
   ```
   Every step carries a comment block with five examples above it; open the file when a phrase
   is not obvious.
3. **Look at the screen first** (the Playwright MCP browser, a tab of your own) when the scenario
   is about a screen you have not seen: the names in a menu, the columns of a list and the
   messages are the shop's own words.
4. **Write the feature** in `<shop>/tests/features/`, from phrases that exist (the lists below).
5. **Match every step without a browser**, then run the feature, then the suite:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <shop> --dry-run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <shop> --run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <shop> --run --tags "@critical"
   bash cmd-tools-testing.sh <shop> --run
   ```
   A dry run says `Undefined` for a phrase no definition matches: fix the phrase, do not write a
   step for it.

## Accounts: a handle, never a password

A scenario logs in by a handle. The default accounts are in the shop already
(`bash cmd-tools-prestashop-cli.sh <shop> --add-users` adds them again if they were removed):

| Handle | Account | What it is | Signs in to |
| --- | --- | --- | --- |
| `admin` | `administrator@example.com` (Shop Admin) | an employee with the SuperAdmin profile | the back office |
| `salesman` | `salesman@example.com` (Sam Salesman) | an employee with the Salesman profile | the back office |
| `customer` | `customer@example.com` (Clara Customer) | a customer with one address | the shop |
| `shopper` | `shopper@example.com` (Simon Shopper) | a second customer with one address | the shop |

```gherkin
Given I am logged in to the back office as "salesman"
Then the back office should greet "Sam"
Given I am signed in to the shop as "customer"
Then I should be signed in to the shop as "Clara Customer"
```

## The phrases, by area

Each line is a phrase the pack defines, and each one passed on a shop built with
`bash cmd-prestashop-project.sh <shop> --install --add-users` (with the demo catalog of the
release: the products and the categories in quotes are its own). Most `should` steps also take
the negative.

### The back office: session, menu, pages

```gherkin
Given I am logged in to the back office as "admin"
When I log in to the back office with "nobody@example.com" and "wrong-password"
When I log out of the back office
Then I should be logged in to the back office
Then I should not be logged in to the back office
Then the back office should greet "Shop"
Then I should see "Advanced Parameters > Team" in the back office menu
Then I should not see "Modules" in the back office menu
When I open "Catalog > Products" in the back office menu
Then the back office page title should be "Products"
Then the back office breadcrumb should be "Catalog > Products"
Then the current back office menu item should be "Products"
When I open the back office path "improve/modules/manage"
Then I should see the access denied page
Then I should see the error message "The employee does not exist, or the password provided is incorrect."
```

### The lists of the back office

```gherkin
When I reset the list filters
Then the list should have 19 rows
Then I should see "Customizable mug" in the list
Then the "Reference" of the list row "Customizable mug" should be "demo_14"
Then the "Status" switch of the list row "Customizable mug" should be on
When I filter the list by "Name" with "mug"
Then the first row of the list should contain "Customizable mug"
When I sort the list by "Name" in ascending order
When I open the list row "Customizable mug"
```

### Products and modules

```gherkin
Given no "A product from the suite" is left in "Catalog > Products"
When I create a "standard" product
When I set the product name to "A product from the suite"
When I set the product price to "21.50"
When I set the product reference to "suite_1"
When I add 5 items to the product stock
When I add the product to the category "Art"
When I put the product online
When I save the product
Then I should see the success message "Successful update"
Then I should not see any error message
Then the product name should be "Customizable mug"
Then the product price should be "21.5"
Then the product stock should be 5
Then the product should be in the category "Art"
Then the product should be online
When I go back to the catalog
When I delete the product from its page
Then I should see the confirmation dialog "Permanently delete this product?"
When I confirm the dialog
Then the module "Banner" should be enabled
When I search the modules for "Banner"
Then I should see the module "Banner"
```

### The catalog of the shop

```gherkin
Given I am on the shop "home" page
Then I should be on an "index" shop page
When I open "Accessories" in the shop menu
Then the shop breadcrumb should be "Home > Accessories"
Then the product list should announce "There are 11 products."
Then the product list should show 11 products
Then I should see the product "Customizable mug" in the product list
Then the product list should be sorted by "Relevance"
When I sort the product list by "Name, A to Z"
Then the first product of the product list should be "Brown bear cushion"
When I filter the product list by "Categories" with "Stationery"
Then the active filters should include "Categories: Stationery"
When I remove the active filter "Categories: Stationery"
When I search the shop for "mug"
```

### The product page and the cart

```gherkin
Given my cart is empty
When I open the product "Hummingbird printed t-shirt"
Then the price of the product should be "$19.12"
Then the product option "Size" should be "S"
When I choose "M" for the product option "Size"
When I set the quantity to buy to 2
When I add the product to the cart
Then the cart dialog should show "Hummingbird printed t-shirt"
When I proceed to checkout from the cart dialog
Then the cart should contain "Hummingbird printed t-shirt"
Then the cart should hold 2 items
Then the cart quantity of "Hummingbird printed t-shirt" should be 2
When I change the cart quantity of "Hummingbird printed t-shirt" to 1
When I remove "Hummingbird printed t-shirt" from the cart
Then the cart should be empty
```

### The customer account

```gherkin
Given I am signed in to the shop as "customer"
Then I should be signed in to the shop as "Clara Customer"
When I am on the shop "addresses" page
Then I should see the address "Home"
When I am on the shop "order history" page
Then I should be on a "history" shop page
When I sign out of the shop
Then I should not be signed in to the shop
```

`I am on the homepage`, `I go to the homepage`, `I go to "<path>"`, `I should see "<text>"` and
`the response status code should be 200` are webship-js's own steps; its status codes, classes,
landmarks and accessibility audits are used as they are and never redefined for this platform.

## Traps found on a real shop

- **A row is compared as the shop writes it.** After a filter by `Name` with `mug`,
  `the first row of the list should contain "Mug"` failed: the row reads `Customizable mug`.
  Write the text of the row, with its capitals.
- **The search of the modules takes one word.** `When I search the modules for "Main menu"`
  failed after the wait of the step (each word of the search becomes a tag); `"Banner"` passed.
- **A module step needs the Module manager open first**:
  `When I open "Modules > Module Manager" in the back office menu`.
- **`Given my cart is empty` opens the cart page.** Go where the scenario starts after it
  (`And I am on the homepage`), as the examples do.
- **The numbers are the demo catalog's**: 19 products in the list of the back office, 11 in
  `Accessories`, 3 under `Stationery`, `$19.12` for the t-shirt. A shop built with
  `--demo-catalog no`, or one whose catalog changed, has its own.
- **An order cannot be taken back by a scenario.** The checkout steps of the pack place a real
  order in the shop, and the stock and the order numbers move with it. The examples here stop at
  the cart; a checkout scenario belongs in a shop that is rebuilt for the run. The checkout
  steps were not run in this workspace's round.
- **A product a failed scenario left behind is in the way of the next run.** Open the scenario
  with `Given no "<name>" is left in "Catalog > Products"`.

## Rules

- **No account is created in a suite.** No employee and no customer is added by a scenario or a
  hook; a registration scenario leaves a customer behind, so it belongs in a shop that is rebuilt
  for the run. A profile the registries do not have is asked for, not made.
- **Never the workspace account.** The SuperAdmin of the shop is not in a registry; `admin` is
  the `administrator@example.com` default account.
- **No password in a feature file**, except where a wrong password is the subject.
- **No platform name in a step phrase**: `I am logged in to the back office as "admin"`, never a
  phrase that names the product. The same holds for a custom step.
- **No selector and no address when a step says it**: `"Catalog > Products" in the back office
  menu`, not the path of the page.
- **What a scenario creates, it removes** in the same scenario, under a name nobody else uses.
- **Only the open-source release.** No marketplace, account or hosted checkout module is
  installed for a scenario, and no e-mail leaves the container.
- **A custom step is the last resort**: look in the pack and in webship-js first, write it in
  `<shop>/tests/step-definitions/` with a comment block and examples, and say it may belong in
  the pack.
- **Everything runs in the container**, through `cmd-tools-testing.sh`. Never `npx cucumber-js`
  or `npx playwright` on the host.
- **A failing scenario is a result.** No `@wip`, no longer timeout, no looser assertion to turn a
  run green: say what the shop did.

## Examples that run

`examples/` holds three features that pass on a shop built with
`bash cmd-prestashop-project.sh <shop> --install --add-users`. Copy one into the suite and run it:

```bash
cp ~/workspace/ai-skills/prestashop-scenarios/examples/back-office.feature ~/workspace/<folder>/<shop>/tests/features/
cd ~/workspace/<folder>
bash cmd-tools-testing.sh <shop> --run --path tests/features/back-office.feature
```

| Feature | What it shows |
| --- | --- |
| `examples/back-office.feature` | The menu, the title and the breadcrumb of a page, a list filtered and sorted, a module, and a profile that is refused a page |
| `examples/product-lifecycle.feature` | An employee creating a product, putting it online, finding it in the shop and deleting it: content a scenario creates and removes |
| `examples/catalog-and-cart.feature` | A visitor in a category, a product with its options in the cart and out again, and a customer in the account pages |
