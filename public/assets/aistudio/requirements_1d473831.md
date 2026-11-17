# Project Title: Centralized Sales Report and Transaction Gateway System

## Goal
* Create an accessible Web Application that creates transactions, record transactions, and validates online transactions (via QrPh API), cash transactions via admin request and approval — stores all transaction from different outlets into a central database with each records having the general attributes of `(transactionID, outletName, outletService, customerName, employeeHandler, transactionAmount, transactionStatus, transactionDateTime, paymentArrangement, paymentChannel, discount, totalAmount)`. Is both responsive on desktop and mobile browsers.

## IMPORTANT
* **Verify and Review** - Iteratively test the web application and ensure that each functional and non-functional requirements are working properly.
* **Clean Code** - Critique and refine the codebase to be simple, easy to explain, object oriented, with minimal nested statements to ensure proper and clean data flow.

## Requirements
* R1. Must have a centralized database that records all transactions from different service entry points.
* R2. Must have one login interface, but redirects users into different service interfaces via staff login credentials.
* R3. Each outlet shall have their own *outlet-specific* attributes.
* R4. Each outlet shall have their own table in the database for their own *outlet-specific* attribute.

## Outlet Data Interface
* **Pickleball Courts**: Operates **two pickleball courts**—an al fresco court on the ground floor and an indoor court on the second floor—available **24/7**. Services include hourly court rentals (₱150 per head/hour or ₱300/hour for two players) along with paddle and ball equipment rentals.
* **Hostel**: Provides accommodation services featuring **small rooms and suite rooms**. Reservations are integrated with online booking platforms such as **Agoda** and **Traveloka** via a hostelling management system.
* **Gym**: A fitness facility offering flexible payment plans including **monthly fees, walk-in rates, student discounts, 1-month unlimited access, 12-to-15-day session bundles, and a free first trial**. Features specialized training programs in **professional boxing, martial arts, and Muay Thai** led by a professional trainer.
* **Swimming Pool**: A pool amenity that is **complimentary for hostel guests**. On weekdays (Monday to Thursday), it opens to outside walk-in guests at **₱300 for adults** and **₱150 for children**.
* **KTV Video Rooms**: Private karaoke entertainment rooms offered under **consumable food and drink packages**. Options include two small rooms (₱5,000 for up to 10 people) and a large room (₱15,000 for 20 to 25+ people).
* **Restaurant / Food & Beverage (F&B)**: An on-site dining outlet equipped with a Point-of-Sale (POS) system that serves food and beverages to walk-in clients, function guests, and KTV room users.
* **Billiards**: A recreational indoor games area equipped with **two billiard tables**.
* **Table Tennis**: An upstairs games facility featuring **three ping-pong tables**.
* **Parking Lot**: An on-site parking facility that is **free for checked-in guests** and accessible to outsiders for a minimal fee (₱30 to ₱40).
* **Events & Location Rentals**: Offers space rentals for private functions (e.g., pre-Christmas parties, corporate events) and concerts, as well as **location packages for television shows, indie films, and commercial shoots**.

## Additional Interfaces
* **Admin**: Has the admin authority within the system and has the ability to approve **delete (void)** requests on transactions.
* **Accountant**: Has an interface to all transaction history as well as modification to 'transactionStatus', but has no authority to delete a transaction, accountant must also **request delete (void) request to remove a specific transaction.**
* **POS Ordering System Interface**: To be used alongside within Food and Beverage. Syncing each order; considering it as transaction. And syncing it within the central database.

## Functional Requirements
* **Log-in Credentials**
    * FR1. Staff, Admins, Accountants, Owners, must be able to log-in onto a single log-in interface.
    * FR2. Based on the credentials, the user must be redirected automatically to their own outlet interface.
    * FR3. Users must be able to view their own profile.
    * FR4. Users must be able to log-out of their accounts.
    * FR5. Users must be able to create an account, into which will be under approval for the Admin interface.

* **Pickleball-Court Interface**
    * FR6. The clerk must be able to create a transaction.
    * FR7. After create transaction, the clerk must be able to input a set of requested input fields such as `Customer Name, Pax & Hours, Paddle & Ball rent, Mode of payment (QrPH, Cash), Total amount (sales), Datetime (must be automatically generated)`.
    * FR8. The clerk must be able to save the transaction. 
    * FR9. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR10. The clerk must be able to view the transaction history.
    * FR11. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR12. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields. 

* **Hostel**
    * FR13. The clerk must be able to create a transaction.
    * FR14. After create transaction, the clerk must be able to input a set of requested input fields such as `(customer name, name of service, service price, payment arrangement[Full Payment, Down Payment, Contract Payment], Payment Channel[QRPh, Cash], upfront payment or pay-later)`.
    * FR15. The clerk must be able to save the transaction. 
    * FR16. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR17. The clerk must be able to view the transaction history.
    * FR18. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR19. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields.
    * FR20. The interface must be able to manage integrated online reservation platforms.
    * FR21. The interface must be able to handle integrated online reservation platforms.

* **Gym**
    * FR22. The clerk must be able to create a transaction.
    * FR23. After create transaction, the clerk must be able to input a set of requested input fields such as `Customer Name, Age, starting date of membership, Type of membership (Member, non-member, self training, student, regular routine muaythai, others) Type of payment (QrPH, Cash), Total amount (sale), date (must be automatically generated)`.
    * FR24. The clerk must be able to save the transaction. 
    * FR25. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR26. The clerk must be able to view the transaction history.
    * FR27. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR28. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields.
    * FR29. The create transaction form must be able to handle **monthly fees, walk-in rates, student discounts, 1-month unlimited access, 12-to-15-day session bundles, and a free first trial** within the payment arrangement section.

* **Swimming Pool**
    * FR30. The clerk must be able to create a transaction.
    * FR31. After create transaction, the clerk must be able to input a set of requested input fields such as `(customer name, name of service, service price, payment arrangement[Full Payment, Down Payment, Contract Payment], Payment Channel[QRPh, Cash], upfront payment or pay-later)`.
    * FR32. The clerk must be able to save the transaction. 
    * FR33. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR34. The clerk must be able to view the transaction history.
    * FR35. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR36. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields.

* **KTV Video Rooms**
    * FR37. The clerk must be able to create a transaction.
    * FR38. After create transaction, the clerk must be able to input a set of requested input fields such as `(customer name, name of service, service price, payment arrangement[Full Payment, Down Payment, Contract Payment], Payment Channel[QRPh, Cash], upfront payment or pay-later)`.
    * FR39. The clerk must be able to save the transaction. 
    * FR40. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR41. The clerk must be able to view the transaction history.
    * FR42. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR43. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields.

* **Restaurant / Food & Beverage (F&B)**
    * FR44. The clerk must be able to create a transaction.
    * FR45. After create transaction, the clerk must be able to input a set of requested input fields such as `(customer name, name of service, service price, payment arrangement[Full Payment, Down Payment, Contract Payment], Payment Channel[QRPh, Cash], upfront payment or pay-later)`.
    * FR46. The clerk must be able to save the transaction. 
    * FR47. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR48. The clerk must be able to view the transaction history.
    * FR49. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR50. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields.
    * FR51. The clerk must be able to select which service should be audited to (walk-in clients, function guests, and KTV room users).
    * FR52. POS transactions (orders) must reflect instantaneously to the central database and transaction history.

* **Billiards**
    * FR53. The clerk must be able to create a transaction.
    * FR54. After create transaction, the clerk must be able to input a set of requested input fields such as `(customer name, name of service, service price, payment arrangement[Full Payment, Down Payment, Contract Payment], Payment Channel[QRPh, Cash], upfront payment or pay-later)`.
    * FR55. The clerk must be able to save the transaction. 
    * FR56. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR57. The clerk must be able to view the transaction history.
    * FR58. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR59. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields.

* **Table Tennnis**
    * FR60. The clerk must be able to create a transaction.
    * FR61. After create transaction, the clerk must be able to input a set of requested input fields such as `(customer name, name of service, service price, payment arrangement[Full Payment, Down Payment, Contract Payment], Payment Channel[QRPh, Cash], upfront payment or pay-later)`.
    * FR62. The clerk must be able to save the transaction. 
    * FR63. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR64. The clerk must be able to view the transaction history.
    * FR65. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR66. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields.

* **Parking Lot**
    * FR67. The clerk must be able to create a transaction.
    * FR68. After create transaction, the clerk must be able to input a set of requested input fields such as `Vehicle Plate number, type of vehicle, type of payment (QrPH, Cash), type of parking (day, night, overnight)`.
    * FR69. The clerk must be able to save the transaction. 
    * FR70. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR71. The clerk must be able to view the transaction history.
    * FR72. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR73. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields.

* **Events & Location Rentals**
    * FR74. The clerk must be able to create a transaction.
    * FR75. After create transaction, the clerk must be able to input a set of requested input fields such as `(customer name, name of service, service price, payment arrangement[Full Payment, Down Payment, Contract Payment], Payment Channel[QRPh, Cash], upfront payment or pay-later)`.
    * FR76. The clerk must be able to save the transaction. 
    * FR77. If the transaction is paid it must be **resolved** or **marked as paid**, If the service is still **unpaid** it must be marked as **pending** and the clerk must still *be able to edit a pending transaction*.
    * FR78. The clerk must be able to view the transaction history.
    * FR79. The clerk must be able to request for transaction deletion (void), to be approved by admin.
    * FR80. The create transaction form must have a drop down menu of pre-set services that automatically fills up the input fields.

* **Admin**
    * FR81. The admin must be able to approve and disapprove newly created accounts.
    * FR82. The admin must have **admin privilages** within the system granting the admin full access to different functional sytem attributes.
    * FR83. **Admin Confirmation** — The admin shall be able to approve cash payments. Approving cash payments means that the cash money are sent/audited to the bank account.
    * FR84. The admin shall be able to switch and simulate different outlet interfaces.
    * FR85. The admin shall be able to modify the attributes of a transaction without any approval.
    * FR86. The admin shall be able to view historical transactions.
    * FR87. The admin shall be able to delete transactions without any approval.
    * FR88. The admin shall be able to dynamically add services, and outlets. Either from scratch or with a pre-set template.

* **Accountant**
    * FR89. The user shall be able to view historical transactions.
    * FR90. The user shall be able to view a listed summary of transactions.
    * FR91. The user should be able to view the summary of transactions via total sales that can be filtered to each *day, week, month, year*.
    * FR92. The user should be able to **modify** transactions *under admin approval*.
    * FR93. The user should be able to **delete** transactions *under admin approval*.

* **POS Ordering System Interface**
    * FR94. POS must be able to create individual orders.
    * FR95. Order transaction must stay in-sync under Food & Beverages.
    * FR96. For each new order, provide a CTA to print a receipt with order details, for the kitchen to see an order.


## Non-Functional Requirements
* **General**
    * NFR1. Every transaction must be stored in the database, whether it's a pending transaction or a paid transaction.
    * NFR2. Online payments (QrPH) must automatically be validated upon scanning. The system should know when the unique QR was scanned -- *create only a workaround method for now, this requirement system is only a prototype*
    * NFR3. Transaction History list must update in real-time after every transaction.
    * NFR4. Must be able to handle concurent transaction request from different users and different outlets at the same time.
    * NFR5. Transactions submitted at the exact same time must still be recorded in the database and not cause any clash or race conditions.
    * NFR6. If a transaction is under modification, that transaction must be on lock-out to avoid *race conditions*.

* **Database**
    * NFR7. All data must be in one central database.
    * NFR8. Each interface must have their own table in a database with its dedicated primary key (eg. `pickleballID`)
    * NFR9. Database must have one table that calls all primary keys on different tables. (for unfiltered transactional history that retrieves all data across interfaces.)