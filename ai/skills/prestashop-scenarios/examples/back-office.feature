Feature: An employee finds its way in the back office
  As the owner of the shop
  I want the menu, the lists and the modules of the back office to work for the employee who may use them
  So that a change of the back office or of a profile is caught by the suite

  # The employees are the default ones; a scenario logs in by a handle of the employees registry.
  # The products are the demo catalog of the release.

  Scenario: The menu leads to a page with its title and breadcrumb
    Given I am logged in to the back office as "admin"
    When I open "Catalog > Products" in the back office menu
    Then the back office page title should be "Products"
    And the back office breadcrumb should be "Catalog > Products"
    And the current back office menu item should be "Products"

  Scenario: The list of products is filtered and sorted
    Given I am logged in to the back office as "admin"
    And I open "Catalog > Products" in the back office menu
    And I reset the list filters
    Then the list should have 19 rows
    And the "Reference" of the list row "Customizable mug" should be "demo_14"
    When I filter the list by "Name" with "mug"
    Then the list should have 5 rows
    And the first row of the list should contain "Customizable mug"
    When I reset the list filters
    And I sort the list by "Name" in ascending order
    Then the first row of the list should contain "Brown bear - Vector graphics"

  Scenario: A module of the release is enabled
    Given I am logged in to the back office as "admin"
    And I open "Modules > Module Manager" in the back office menu
    Then the module "Banner" should be enabled

  Scenario: An employee with a limited profile is refused the modules
    Given I am logged in to the back office as "salesman"
    Then I should see "Orders > Orders" in the back office menu
    But I should not see "Modules" in the back office menu
    When I open the back office path "improve/modules/manage"
    Then I should see the access denied page
