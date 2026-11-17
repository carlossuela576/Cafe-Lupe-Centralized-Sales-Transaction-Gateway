# Revision 001
## AI Agent Directives (Read First)
> 1. **Context Recollection:** The first set of revision instructions, it is a must to retrieve previous context .md files from the brain and assests of the project for proper context. This will align the AI agent properly on the previous/latest state of the project, to the proceeding queries/revisions. This shall enable the Agent to properly plan out changes and refactorizations without being destructive to the entire codebase.
> 2. **Coupling and Context Reliance:** Ensure to work alongside `requirements.md` and `SPEC.md` for full project context and requirements. That will help the Agent to retrieve necessary information to the codebase and impending software architecture.
> 3. **Milestones and State Management:** The Agent shall produce `lastState.md` in the codebase's brain folder after every state changes into the codebase. This will help the Agent to retrieve previous changes quickly in-case the input context window has degraded.
>4. **Unchanged Function State:** For functions that were not in state to be changed in this revision shall remain unchanged. If other functions that were not explicitly stated for change, needs modification due to parallel logical alignment. **ASK FIRST**. 

## Roles and Credentials
This section pertains to the changes with regards to different log-in accounts, credentials, and to who handles the given outlet.
> 1. **Front-Desk** will be the admin.
> 2. Since Front-Desk handles all `Pickleball, Hostel, Swimming Pool, KTV, Billiards, Table Tennis, Parking Lot, Function Hall, and Location Rental` outlets; these will now be under Front-Desk and the only route to access these outlets was through Front-Desk log-in.
> 3. Only retained outlets/roles that will have their own log-in interface will be `Front-Desk, Accountant, Gym, F&B POS`.
> 4. Any other accounts correlating to the merged outlets, shall be removed.

## Interfaces
This section correlates to the changes within log-in credentials and different log-in entry points that routes to different interfaces.
> 1. Remove `Pickleball, Hostel, Swimming Pool, KTV, Billiards, Table Tennis, Parking Lot, Function Hall, and Location Rental` individual log-in credentials. All these shall be under Front-Desk (Admin).
> 2. **Inside Front-Desk:** `Front-Desk` shall be able to click on a drop down menu named `Outlets`. And change the outlet that they are handling.
> 3. **Inside Front-Desk:** Remove `Simulate Outlet` function.
> 4. Upon Logging-in to F&B the `Create Transaction` function shall be removed. `Open POS` function shall remain.

## Create Transaction (forms)
This section pertains to the changes within `Create Transaction` functionality of each outlet. Changes include the removal of preset drop down menus, changes in various input fields within the form. Details will be stated below:

### General
This applies to `Pickleball, Hostel, Swimming Pool, KTV, Billiards, Table Tennis, Parking Lot, Function Hall`
> 1. Discounts shall be a `Yes` and `No` buttons. If `yes`, apply the discount formula to amount payable. If `no` do not apply the discount formula to amount payable.
> 2. **Discount formula:** `(Final Price = (Selling Price ÷ 1.12) × 0.80)`
> 2. Payment Arrangements must only consist of `Full Payment` and `Down Payment`
> 3. Add input for `Payment cash received by`, input name of staff.
> 4. When adjustments to different attributes are made (e.g. `pax, hour duration, discounts, price of specific facility`) the system shall automatically calculate the logic and adjust the price amount accordingly.
> 5. Remove Preset Service.

### Billiards
> 1. Replace `Table` label to `Place`. Change drop down options to `200 per hour (without aircon) and 400 per hour (with aircon)`. The price shall automatically change according to the choice picked.
> 2. When the value for hours change. The price amount should change accordingly, based onto what price per hour was chosen.
> 3. Add setting of countdown timer, to track the remaining time of a customer.
> 4. After the transaction is confirmed, the timer must start and must be visible within transactions.
> 5. The remaining time shall be visible in `Recent Transactions` when transaction details was viewed.
> 6. The system shall produce a notification alert when the timer runs out.
> 7. A CTA button must be present to acknowledge the alert.
> 8. Two CTA buttons, `Pay Balance` and `Extend`. 
```
If **Pay Balance** is clicked,
    if cash
        > show cash amounts payable details.
        > must have CTA button that confirms cash payment, named `Confirm Payment`.
        > Must have a `Cancel` button too beside CTA button. (remain transaction pending if clicked)
    if QrPH
        > show simulated QR component.
        > Mark as `paid` in transactions, if paid.
If **Extend**
    > Prompt overlay to add hour extension
    > The system must remember the chosen hourly rate for that specific transaction.
    > The system must adjust the amounts payable accordingly, based on the time extension set.
```

### Pickleball
```
Price Data

Price per hour: 150 pesos
Paddle Rental: 100 pesos
Ball Rental: 50 pesos
```
> 1. The system must calculate the amount with this formula `{price per hour x pax}`
> 2. The amounts payable must adjust accordingly in real-time based on input information.
> 3. Add setting of countdown timer, to track the remaining time of a customer.
> 4. After the transaction is confirmed, the timer must start and must be visible within transactions.
> 5. The remaining time shall be visible in `Recent Transactions` when transaction details was viewed.
> 6. The system shall produce a notification alert when the timer runs out.
> 7. A CTA button must be present to acknowledge the alert.
> 8. Two CTA buttons, `Pay Balance` and `Extend`. 
```
If **Pay Balance** is clicked,
    if cash
        > show cash amounts payable details.
        > must have CTA button that confirms cash payment, named `Confirm Payment`.
        > Must have a `Cancel` button too beside CTA button. (remain transaction pending if clicked)
    if QrPH
        > show simulated QR component.
        > Mark as `paid` in transactions, if paid.
If **Extend**
    > Prompt overlay to add hour extension
    > The system must remember the hourly rate for that specific transaction.
    > The system must adjust the amounts payable accordingly, based on the time extension set.
```

### Table Tennis
> 1. Price per hour for table tennis is 250 pesos.
> 2. The amounts payable must adjust accordingly in real-time based on input information.
> 3. Add setting of countdown timer, to track the remaining time of a customer.
> 4. After the transaction is confirmed, the timer must start and must be visible within transactions.
> 5. The remaining time shall be visible in `Recent Transactions` when transaction details was viewed.
> 6. The system shall produce a notification alert when the timer runs out.
> 7. A CTA button must be present to acknowledge the alert.
> 8. Two CTA buttons, `Pay Balance` and `Extend`. 
```
If **Pay Balance** is clicked,
    if cash
        > show cash amounts payable details.
        > must have CTA button that confirms cash payment, named `Confirm Payment`.
        > Must have a `Cancel` button too beside CTA button. (remain transaction pending if clicked)
    if QrPH
        > show simulated QR component.
        > Mark as `paid` in transactions, if paid.
If **Extend**
    > Prompt overlay to add hour extension
    > The system must remember the hourly rate for that specific transaction.
    > The system must adjust the amounts payable accordingly, based on the time extension set.
```

### Parking
```
Price Data

4 wheels - 50 pesos
2 wheels - 30 pesos
```
> 1. The `Vehicle type` input section must have a dropdown option of `Car, Van, Truck, Tricycle, Motorcycle, others`.
> 2. `Car, Van, Truck` must be charged for 4 wheels price.  `Motorcycle, Tricycle` must be charged for 2 wheels price.
> 3. When `others` was chosen, the system must reveal two additional input fields. `Vehicle Name` and `Number of Wheels` (dropdown). `Vehicle name` must be manually typed, `Number of Wheels` must be chosen to determine the parking price for the vehicle.
> 4. The amounts payable must adjust accordingly in real-time based on input information.
> 5. If the client is `checked in`. The ticket must be free, 00.0 peso balance.

### KTV Rooms
```
Price Data
Price per hour - 1000

Packages
1. KTV 1 & 2 - 3 hours (1000 pesos per hour) + 5000 pesos consumable 10-15 pax.
2. KTV suite 4 - 3 hours (1000 pesos per hour) + 15000 consumable 20-25 pax
```
> 1. For custom reservations and inquiries, the system must calculate the amount with this formula `{price per hour x pax}`
> 2. The amounts payable must adjust accordingly in real-time based on input information.
> 3. Remove `Preset Service`. Migrate drop-down menu to `Package` containing two options. `KTV 1 & 2 - 3 hours (1000 pesos per hour) + 5000 pesos consumable 10-15 pax.` and `KTV suite 4 - 3 hours (1000 pesos per hour) + 15000 consumable 20-25 pax`
> 4. Change `Room` drop-down menu choices to these list `Room 1, Room 2, Room 3, Room 4`.
> 5. Add `Hours` input. Price should change in real-time upon input change.
> 6. Add setting of countdown timer, to track the remaining time of a customer.
> 7. After the transaction is confirmed, the timer must start and must be visible within transactions.
> 8. The remaining time shall be visible in `Recent Transactions` when transaction details was viewed.
> 9. The system shall produce a notification alert when the timer runs out.
> 10. A CTA button must be present to acknowledge the alert.
> 11. Two CTA buttons, `Pay Balance` and `Extend`. 
```
If **Pay Balance** is clicked,
    if cash
        > show cash amounts payable details.
        > must have CTA button that confirms cash payment, named `Confirm Payment`.
        > Must have a `Cancel` button too beside CTA button. (remain transaction pending if clicked)
    if QrPH
        > show simulated QR component.
        > Mark as `paid` in transactions, if paid.
If **Extend**
    > Prompt overlay to add hour extension
    > The system must remember the hourly rate for that specific transaction.
    > The system must adjust the amounts payable accordingly, based on the time extension set.
```

### Swimming Pool
```
Price Data

Adult 300 per head
Children 150 per head
```
> 1. Remove `Preset Service`
> 2. When `Walk-in` is picked in `Guest type`. The system must charge the customer according to the given price and the number of people set in the input.
> 3. When `Hotel Guest` is picked in `Guest type`. The system must not charge the customer.
> 4. The amounts payable must adjust accordingly in real-time based on input information.

### Hostel
```
Price Data

2 single bed (1,680 per night)
King size bed (3, 136 pesos per night)
Queen size bed (2,800 pesos per night)
Suite rooms - overlooking (4, 480 pesos per night)
```
> 1. Consider pricing logics within:
> 2. No Service charge
> 3. Inclusive of 12% VAT
> 4. Remove `Preset Service`
> 5. Change `Room Type` drop-down choices to the given price data. Amounts payable must change accordingly upon choice.
> 6. Based on `check-in` and  `check-out` dates, amounts payable must also change accordingly by the price per night chosen.
> 7. The amounts payable must adjust accordingly in real-time based on input information.
> 8. Add amenities drop-down input with these lists of choices. This shall have no effect on price onto amounts payable. Only for Additional customer details.
```
Amenities

- Swimming pool
- Billiards
- Table tennis
- Jacuzzi
- Sauna
```

### Events & Location rentals
> 1. No data as of now
> 2. Forms Remain unchaged

## Other Outlet interface
This section pertains to changes within the remaining outlet serices that has their own external log-in credentials and shall not be under `Front-desk`

### Gym
```
Price Data

ANNUAL MEMBERSHIP: P1,600.00
Inclusions:
- 1 Year Membership
- Free use of locker
- Can avail the monthly sessions
- Access of Swimming Pool

MONTHLY PACKAGES
- MONTHLY UNLIMITED: P3,500.00
- 12 sessions (1 month) BOXING: P2,000.00
- 12 sessions (1 month) MUAY THAI: P5,000.00

PER SESSION RATES
- BOXING SESSION (Member): P200.00
- BOXING SESSION (Non-Member): P250.00
- BOXING SESSION (Student, M): P150.00
- BOXING SESSION (Student, NM): P200.00
- MUAY THAI SESSION (Member): P300.00
- MUAY THAI SESSION (Non-Member): P400.00
- MUAY THAI SESSION (Student, M): P300.00
- MUAY THAI SESSION (Student, NM): P350.00

Session Inclusions:
- Coach/Trainer (1 hour)
- Circuit (Program by Coach)
- Free Use of Gym Equipment (After Training)
- Free use of Shower room
- Free Use of Locker

SELF TRAIN SESSION
- SELF TRAIN SESSION (Member): P100.00
- SELF TRAIN SESSION (Non-Member): P150.00
- SELF TRAIN SESSION (Student): P100.00
```
> 1. Consider the following data given in `Price data` and adjust the forms for new transaction accordingly.
> 2. The amounts payable must adjust accordingly in real-time based on input information.
> 3. You may adjust the transaction forms onto what is most optimal based on `Price data`. Before appending, ASK ME FIRST for the confirmation within the change.

### F&B POS
```
Price Data

CAFE LUPE MENU

ALL DAY BREAKFAST
- Garlic Longganisa: P 350
- Garlic Bangus: P 350
- Glazed Tocino: P 350
- Corned Beef Delimondo: P 350

APPETIZER
- Nachos Muchos: P 490
- Buffalo Wings: P 580
- Taco Fries: P 320
- Pork Sisig w/ Egg: P 500
- Fish and Chips: P 400
- Potato Fries: P 250

PASTA
- Spaghetti Bolognese: P 400
- Spaghetti Carbonara: P 400

MAIN COURSE
- Beef Bulalo: P 900
- Pork Kadios: P 750
- Crispy Pata: P 850
- Pinakbet: P 300
- Pork Binagoongan: P 320
- Bulalo Kansi: P 850
- Garlic Chicken Whole: P 850
- Ensaladang Talong: P 250
- Garlic Rice: P 45
- Plain Rice: P 40

MEXICAN
- QUESADILLA (Beef / Chicken / Cheese): P 450
- SOFT TACOS (Beef / Chicken): P 350

PIZZA
- Pepperoni / Cheese / All Meat: P 700
- Hawaiian / Ham & Cheese / Seafood: P 750

---

CAFE LUPE DRINKS

BEERS
- Lupe Lada: P 180
- SM Light: P 140
- SM Apple: P 150
- SM Pale: P 150
- SM Bucket Mix: P 700
- Engkanto Mango: P 200
- Engkanto Honey: P 180

COCKTAILS
- Margarita: P 300
- Pinacolada: P 300
- Sangria: P 300
- Mojito: P 300
- Long Island: P 300
- Mudslide: P 300

COFFEE | CHOCOLATE | TEA
- Kapeng Barako: Hot P 120 | Cold P 180
- Latte: Hot P 150 | Cold P 200
- Cappuccino: Hot P 150 | Cold P 200
- Mocha: Hot P 150 | Cold P 220
- Caramel Macchiato: Hot P 150 | Cold P 220
- Chocolate: Hot P 150 | Cold P 200
- Tea: Hot P 110 | Cold P 130
- Spanish Latte (Cold): P 220

FRAPPES
- Chocolate Frappe: P 220
- Mocha Frappe: P 220
- Caramel Frappe: P 220

SOFT DRINKS
- Coke: In can P 120 | 1.5 Liter P 250
- Sprite: In can P 120 | 1.5 Liter P 250
- Royal: In can P 120
- Pineapple Juice: In can P 100
- Bottled Water: P 35

SHAKES | REFRESHERS
- Ripe Mango: P 180
- Green Mango: P 180
- Pineapple: P 180
- Apple: P 180
- Lemonade: P 180
- Houseblend: Glass P 120 | Pitcher P 450 | Tower P 1,200

OTHERS
- Captain Morgan: Shot P 300 | Bottle P 2,900
- Jack Daniels: Shot P 300 | Bottle P 3,500
- Johnnie Walker: Shot P 300 | Bottle P 3,300
- Jose Cuervo: Shot P 220 | Bottle P 2,500
```
> 1. Consider the following data given in `Price data` and adjust the data in F&B POS accordingly.
> 2. The amounts payable must adjust accordingly in real-time based on chosen items.

## Database Schema and Architecture
This section includes instructions and directives to the agent with regards to the database schema and Arhitecture of the web application.
> 1. Since a lot of data was given, the database schema must adjust accordingly.
> 2. Formulate the best and most optimal database schema considering all the data and details that must be seen after every transactions.
> 3. Before appending any changes. Create a database schema diagram and consult the new schema with me first. AWAIT FOR CONFIRMATION before doing any changes.
> 4. Each details in forms must be seen in the transaction details. Expect to have changes in columns within the database schema.
