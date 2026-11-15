Feature: An employee adds a product and removes it again
  As an employee of the shop
  I want to create a product, put it online, find it in the shop and delete it
  So that the suite proves the catalog works and leaves the shop as it found it

  Scenario: A product from its creation to the shop and back
    Given I am logged in to the back office as "admin"
    And no "A product written by a scenario" is left in "Catalog > Products"
    When I create a "standard" product
    Then the product should be offline
    When I set the product name to "A product written by a scenario"
    And I set the product price to "21.50"
    And I set the product reference to "scenario_1"
    And I add 5 items to the product stock
    And I add the product to the category "Art"
    And I put the product online
    And I save the product
    Then I should see the success message "Successful update"
    And I should not see any error message
    And the product price should be "21.5"
    And the product stock should be 5
    And the product should be in the category "Art"
    And the product should be online
    When I go back to the catalog
    Then I should see "A product written by a scenario" in the list
    When I go to the homepage
    And I search the shop for "A product written by a scenario"
    Then I should see the product "A product written by a scenario" in the product list
    When I open "Catalog > Products" in the back office menu
    And I open the list row "A product written by a scenario"
    And I delete the product from its page
    Then I should see the confirmation dialog "Permanently delete this product?"
    When I confirm the dialog
    Then I should see the success message "Successful deletion"
    And I should not see "A product written by a scenario" in the list
