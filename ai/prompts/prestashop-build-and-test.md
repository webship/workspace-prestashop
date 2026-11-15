Build a PrestaShop shop in a sites folder and prove it with its first webship-js feature.

`claude` is the default launcher; the text between the triple quotes is plain and can be given to another AI CLI as it is.

```
claude --permission-mode bypassPermissions """
Build a PrestaShop shop named <name> in this sites folder and test it with webship-js
# ~/workspace/<dev|test|sandboxes|demos> · https://<name>.ddev.site · the back office at /admin-workspace · container-based (DDEV by default)
# the builder deletes a project of the same name first: stop if <name> is a shop somebody still needs
# nothing on the host: no php, composer, npm or mysql outside the shop's container
# only the modules of the open-source release: no marketplace, account or hosted checkout module is installed, and no e-mail is sent

1. bash cmd-prestashop-project.sh <name> --install --add-users
   (add --version <x> for a release other than the latest, --demo-catalog no for an empty shop)
   if it stops before it starts, the workspace account's password is under 8 characters: tell me
2. bash cmd-tools-prestashop-cli.sh <name>
   tell me the version, the two addresses, the employees and the customers it lists
3. bash cmd-tools-testing.sh <name>
   webship-js, the step pack, the two registries of accounts and tests/features/site.feature
4. bash cmd-tools-testing.sh <name> --dry-run --path tests/features/site.feature
5. bash cmd-tools-testing.sh <name> --run --path tests/features/site.feature

If a command fails, show the line that failed and stop. Do not retry with other flags.
When the feature is green: the address, the version, how many scenarios and steps passed.
Then ask me whether to keep the shop or remove it with: bash cmd-tools-remove.sh <name>
"""
```
