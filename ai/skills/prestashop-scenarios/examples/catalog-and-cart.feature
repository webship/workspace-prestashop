Feature: A visitor browses the catalog and fills a cart
  As the owner of the shop
  I want a visitor to find a product, choose its options and manage the cart
  So that a theme or a module that breaks the way to an order is caught by the suite

  # The products are the demo catalog of the release. No order is placed: an order cannot be
  # removed by a scenario, and the cart is emptied again.

  Scenario: A category from the menu is listed, sorted and filtered
    Given I am on the shop "home" page
    When I open "Accessories" in the shop menu
    Then I should be on a "category" shop page
    And the shop breadcrumb should be "Home > Accessories"
    And the product list should show 11 products
    And I should see the product "Customizable mug" in the product list
    When I sort the product list by "Name, A to Z"
    Then the first product of the product list should be "Brown bear cushion"
    When I filter the product list by "Categories" with "Stationery"
    Then the active filters should include "Categories: Stationery"
    And the product list should show 3 products

  Scenario: A product is added to the cart, changed and removed
    Given I am on the homepage
    And my cart is empty
    And I am on the homepage
    When I open the product "Hummingbird printed t-shirt"
    Then I should be on a "product" shop page
    And the product option "Size" should be "S"
    When I choose "M" for the product option "Size"
    And I set the quantity to buy to 2
    And I add the product to the cart
    Then the cart dialog should show "Hummingbird printed t-shirt"
    When I proceed to checkout from the cart dialog
    Then the cart should contain "Hummingbird printed t-shirt"
    And the cart should hold 2 items
    When I change the cart quantity of "Hummingbird printed t-shirt" to 1
    Then the cart should hold 1 item
    When I remove "Hummingbird printed t-shirt" from the cart
    Then the cart should be empty

  Scenario: A customer has an account, an address and an order history
    Given I am signed in to the shop as "customer"
    Then I should be signed in to the shop as "Clara Customer"
    When I am on the shop "addresses" page
    Then I should see the address "Home"
    When I am on the shop "order history" page
    Then I should be on a "history" shop page
    When I sign out of the shop
    Then I should not be signed in to the shop
