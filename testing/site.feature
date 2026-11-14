Feature: The shop answers and its accounts work
  As the owner of the shop
  I want the front page, the back office and each default account to work
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup as a starting point: it is yours to change.
  # The accounts are the default ones (cmd-tools-add-users.sh); a scenario signs in by a handle of
  # the employees or the customers registry in cucumber.js, so no password of an account is written here.

  @critical
  Scenario: The front page of the shop is served
    Given I am on the shop "home" page
    Then the response status code should be 200
    And I should be on an "index" shop page
    And I should not be signed in to the shop

  @critical
  Scenario: The back office asks for an employee
    When I log in to the back office with "nobody@example.com" and "wrong-password"
    Then I should not be logged in to the back office
    And I should see the error message "The employee does not exist, or the password provided is incorrect."

  Scenario Outline: Each employee logs in to the back office
    Given I am logged in to the back office as "<handle>"
    Then I should be logged in to the back office
    And the back office should greet "<first name>"

    Examples:
      | handle   | first name |
      | salesman | Sam        |

  Scenario: An employee with a limited profile has the menu of its profile
    Given I am logged in to the back office as "salesman"
    Then I should see "Orders > Orders" in the back office menu
    But I should not see "Modules" in the back office menu
    And I should not see "Advanced Parameters > Team" in the back office menu

  Scenario: An employee is refused a page its profile may not open
    Given I am logged in to the back office as "salesman"
    When I open the back office path "improve/modules/manage"
    Then I should see the access denied page

  Scenario: An employee logs out of the back office
    Given I am logged in to the back office as "salesman"
    When I log out of the back office
    Then I should not be logged in to the back office

  Scenario Outline: A customer signs in to the shop
    Given I am signed in to the shop as "<handle>"
    Then I should be signed in to the shop as "<name>"
    When I am on the shop "my account" page
    Then I should be on a "my-account" shop page

    Examples:
      | handle   | name           |
      | customer | Clara Customer |
      | shopper  | Simon Shopper  |

  Scenario: A customer has an address to deliver to
    Given I am signed in to the shop as "customer"
    When I am on the shop "addresses" page
    Then I should see the address "Home"

  Scenario: A customer signs out of the shop
    Given I am signed in to the shop as "shopper"
    When I sign out of the shop
    Then I should not be signed in to the shop

  Scenario: The account pages need a customer
    Given I am on the shop "home" page
    When I go to the shop "order history" page
    Then I should be on a "authentication" shop page
    And I should not be signed in to the shop
