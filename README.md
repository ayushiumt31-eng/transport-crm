# Transport ERP

Starter project with a React (JavaScript) frontend, an Express API, and a local MongoDB connection.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- MongoDB Community Server running locally

## Setup

1. Install dependencies from the project root:

   ```bash
   npm install
   ```

2. Create the server environment file:

   ```powershell
   Copy-Item server\.env.example server\.env
   ```

   The example URI connects to `mongodb://127.0.0.1:27017/transport_erp`. Change `MONGODB_URI` in `server/.env` if your local MongoDB uses a different address.

   Set `CORS_ORIGINS` to the comma-separated frontend origins allowed to call the API. The example allows the local Vite server.

   Set unique random values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (at least 32 characters each), then set `ADMIN_LOGIN_ID` and `ADMIN_PASSWORD` (8+ characters). On first start the server creates the super admin login from these values; after that, change the password from the app (the `.env` value is not read again).

   Keep secrets out of source control.

3. Start MongoDB Community Server if it is not already running.

4. Start the frontend and backend together:

   ```bash
   npm run dev
   ```

   Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The Express API runs at `http://localhost:5000`, and `GET /api/health` reports API and database status.

## Other commands

- `npm run build` — build the React frontend
- `npm start` — start the API server (MongoDB must be running)
- `npm test --workspace=server` — run backend integration tests against a temporary MongoDB database

The Vite development server proxies `/api` requests to Express.

## Current backend scope

The frontend contains the planned role panels and module screens. The backend is being rebuilt incrementally. Working API modules are health checks, authentication, Customer Management / Customer Portal / Feedback Management, Booking Management, Fleet Management, Driver Management, Trip Management, Route Management, GPS Tracking, Notification Center (in-app trip and GPS alerts), Cargo & Shipment, internal Billing, Expense Tracking, Fuel Management, and Vehicle Maintenance. Email and push provider delivery, statutory GST invoice workflows, e-invoicing, and payment-gateway collection are not implemented. Other module screens are not backed by working APIs yet.

## Logins and roles

Everyone signs in at `/login` with their account's **login ID/email and password**. The server returns one of four roles, and the frontend opens the corresponding panel:

| Role | Account setup |
| --- | --- |
| Super Admin (`admin`) | Created on first start from `ADMIN_LOGIN_ID` and `ADMIN_PASSWORD` |
| Transport Manager (`manager`) | Login is attached to a manager profile by authorized staff |
| Driver (`driver`) | Login is attached to a driver profile by authorized staff |
| Customer (`customer`) | Self-registration at `/register` with an email and password; mobile number is contact information |

Authentication uses bcrypt password hashes, case-insensitive login IDs, a 15-minute lock after five failed attempts, signed access tokens, and server-side session-version checks. Password changes and disabled logins revoke older sessions. Login sessions are stored per browser tab.

Available authentication endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/change-password`
- `GET` and `PUT /api/v1/auth/accounts/:role/:profileId` for authorized staff-managed logins

Staff can provision manager and driver login credentials from the relevant profiles. Existing customer accounts created before email login may still have a mobile-number login ID; authorized staff should update those accounts to the customer's email before using email-only sign-in. Customer profiles can be managed through the Customer Management API. API documentation is available at `/api/docs`.

Customer Management endpoints (admin and manager roles):

- `GET /api/v1/customers/management/summary`
- `GET /api/v1/customers/management` — search, status/KYC filters, pagination
- `GET` and `PUT /api/v1/customers/management/:id`
- `PATCH /api/v1/customers/management/:id/status` and `/kyc`
- `GET /api/v1/customers/management/:id/kyc/documents`
- `PATCH /api/v1/customers/management/:id/kyc/documents/:documentId/review`
- `GET /api/v1/customers/management/:id/kyc/documents/:documentId/download`
- `GET` and `POST /api/v1/customers/management/:id/activities`
- `PATCH /api/v1/customers/management/:id/activities/:activityId/complete`

Notification Center endpoints (admin, manager, driver, and customer roles; each sees only notifications addressed to their account):

- `GET /api/v1/notifications` — personal trip and GPS notification history, with category/unread filters
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

Trip status transitions and GPS speed/geofence alerts create in-app notifications for active staff accounts and, when provisioned, the assigned driver and linked customer. SMS/email/push delivery requires a provider integration and is not claimed as active.

Customer Portal endpoints (customer role):

- `GET /api/v1/customers/portal/dashboard`, `/profile`, `/preferences`, and `/addresses`
- `PUT /api/v1/customers/portal/profile` and `/preferences`
- `POST /api/v1/customers/portal/kyc/submit` and `/kyc/documents`
- `GET /api/v1/customers/portal/kyc/documents` and `/kyc/documents/:documentId/download`
- `POST /api/v1/customers/portal/addresses`, `PUT /api/v1/customers/portal/addresses/:id`, and `DELETE /api/v1/customers/portal/addresses/:id`

KYC document uploads are optional and limited to PDF, JPEG, or PNG files up to 5 MB. Uploaded documents are private; if a customer uploads documents, staff must review them before approving KYC. Changing customer identity data resets KYC verification and requires uploaded documents to be reviewed again.

Customer Feedback endpoints:

- Customer: `GET /api/v1/customers/feedback/options/shipments` — list owned delivered shipments with POD that have no feedback yet
- Customer: `POST /api/v1/customers/feedback` and `GET /api/v1/customers/feedback` — submit one 1–5 rating and review per delivered shipment, then view only their own submissions and staff responses
- Admin and manager: `GET /api/v1/customers/feedback`, `GET /api/v1/customers/feedback/summary`, and `PATCH /api/v1/customers/feedback/:id` — search the feedback queue, review status, respond to the customer, and resolve cases

Feedback is append-once per shipment; a database uniqueness constraint also prevents concurrent duplicate submissions. Resolving a record requires a customer-facing response. SMS/email delivery of responses is not configured.

Booking Management endpoints:

- `POST /api/v1/customers/booking/vehicle` and `/online` — customer booking requests
- `GET /api/v1/customers/booking?page=&limit=&status=` — paginated bookings (customers see only their own)
- `GET /api/v1/customers/booking/calendar?startDate=&endDate=` — admin/manager schedule calendar
- `GET /api/v1/customers/booking/:bookingId` and `/:bookingId/history` — booking details and status history
- `PUT /api/v1/customers/booking/:bookingId/quote` — staff issues or revises a dated INR quote with line items and terms
- `PATCH /api/v1/customers/booking/:bookingId/quote/decision` — the owning customer accepts or declines the current quote
- `PATCH /api/v1/customers/booking/:bookingId/status` — staff review/rejection/cancellation or customer cancellation before confirmation

Bookings receive a unique yearly booking number and start as `pending`. Staff move them to `under_review`, then issue a versioned quote that remains pending until the customer responds. Only the owning customer can accept a current, unexpired quote; acceptance confirms the booking and fixes the quoted INR amount for invoicing. Customers may decline with a reason; staff can revise an unanswered quote or expire it after its validity ends. Each quote/status transition records history. Customers can cancel their own unconfirmed bookings but cannot alter another customer's records or advance staff-controlled statuses.

Fleet Management endpoints (admin and manager roles):

- `GET /api/v1/fleet/vehicles` — searchable, paginated vehicle directory with status filter
- `POST /api/v1/fleet/vehicles` and `PATCH /api/v1/fleet/vehicles/:id` — register and maintain vehicle/compliance records
- `PATCH /api/v1/fleet/vehicles/:id/status` and `DELETE /api/v1/fleet/vehicles/:id` — controlled status updates and soft deletion
- `GET /api/v1/fleet/vehicles/dashboard` — live vehicle totals and vehicle type breakdown
- `GET /api/v1/fleet/vehicles/allocations/options/bookings` — confirmed bookings not yet allocated
- `GET /api/v1/fleet/vehicles/allocations/options/vehicles?bookingId=` — available vehicle matches
- `GET` and `POST /api/v1/fleet/vehicles/allocations` — allocation directory and allocation creation
- `PATCH /api/v1/fleet/vehicles/allocations/:id/status` — release or cancel an active allocation

Vehicle registration numbers are unique, and chassis/engine numbers cannot be duplicated. Only available vehicles with compatible type and sufficient weight capacity can be allocated to confirmed bookings. Allocations are date-checked, prevent overlapping use, reserve the vehicle, and can be released or cancelled to return it to Available. Vehicle and allocation status changes are audited; allocated/in-trip vehicles cannot be manually set to another status or deleted.

Driver Management endpoints:

- Admin and manager: `GET` / `POST /api/v1/drivers`, `GET` / `PATCH /api/v1/drivers/:id`, `PATCH /api/v1/drivers/:id/status`, and `DELETE /api/v1/drivers/:id`
- Admin and manager: CRUD operations under `/api/v1/drivers/licenses`, `/documents`, `/attendance`, and `/payments`; each child resource supports a status route where the UI exposes a controlled status
- Driver, admin, and manager: read driver-owned records from `/api/v1/drivers/licenses`, `/documents`, `/attendance`, and `/payments`; drivers are scoped to their own profile and cannot write records
- Admin and manager: `POST /api/v1/drivers/documents` creates a driver compliance record with an optional validated PDF/JPEG/PNG attachment up to 5 MB; `GET /api/v1/drivers/documents/:id/download` returns an attached private file, with driver ownership enforced
- Admin and manager: `GET /api/v1/drivers/performance` for attendance-based summary metrics

Driver codes are generated sequentially by year; mobile numbers and licence numbers are unique. Driver statuses, attendance changes, licence reviews, and salary approval/payment transitions are audited. Inactive or suspended profiles have their login disabled and active sessions revoked; driver soft deletion removes its login while retaining historical records. Attendance is unique per driver and UTC calendar date. Licence expiry states are derived from expiry dates (including the 30-day warning window). Driver compliance records can be created with or without a file; attached PDF/JPEG/PNG files are content-validated and stored privately (maximum 5 MB). Only authorized staff can create records, while a driver can retrieve only documents attached to their own profile. Older records with HTTPS links remain readable for transition but cannot be added or changed. Salary entries calculate net pay, reject overlapping pay periods, and may only be edited or archived while Draft; salary records track approval and payment but do not initiate an external bank transfer.

Trip Management endpoints:

- Admin and manager: `GET /api/v1/trips/options/allocations` and `POST /api/v1/trips` — schedule one trip for an active allocation on a confirmed booking
- Admin and manager: `PATCH /api/v1/trips/:id/assignment` — assign an available driver with a valid HMV or Transport licence through the planned delivery date
- Admin and manager: `GET` / `POST /api/v1/trips/plans` and `PATCH` / `DELETE /api/v1/trips/plans/:id` — create and maintain route references and planned stops before departure
- Admin and manager: `GET /api/v1/trips/metrics` (optional pickup-date filters); the Trip Reports screen uses these live metrics. All roles: `GET /api/v1/trips`, `/assignments`, `/active`, and `/history` as authorized
- Assigned drivers can read only their own trips and update their own status: `Assigned → InProgress → Delayed / InProgress → Completed`. Only staff can cancel before departure; delay and cancellation require a reason.

Trip numbers are sequential by year. A vehicle allocation can create only one trip; a driver cannot have overlapping scheduled or active trips. Starting and completing a trip update the linked vehicle, driver, allocation, and status history. When a booking has a shipment, the trip cannot be completed until that shipment reaches `OutForDelivery`. Staff cannot independently release an allocation while its trip is active. Trip history retains completed and cancelled trips. Driver performance now includes trip status totals; distance, delivery punctuality, and route efficiency require GPS tracking integration.

Cargo & Shipment endpoints:

- Admin and manager: `GET /api/v1/cargo/shipments/options/bookings` — confirmed bookings without a consignment
- Admin and manager: `POST /api/v1/cargo/shipments` — create one shipment from a confirmed booking
- Staff, the assigned driver, and the booking's customer: `GET /api/v1/cargo/shipments`, `GET /api/v1/cargo/shipments/:id`, and `GET /api/v1/cargo/shipments/:id/pod/download`, scoped to the caller
- Admin, manager, and the assigned driver: `PATCH /api/v1/cargo/shipments/:id/status` — audited milestone updates
- Admin, manager, and the assigned driver: `POST /api/v1/cargo/shipments/:id/pod` — record receiver and delivery time; an optional private PDF, JPEG, or PNG attachment may be added (up to 5 MB)

Consignment numbers are generated sequentially by year, and a confirmed booking can have only one shipment. The status sequence is `Booked → ReadyForPickup → PickedUp → InTransit → OutForDelivery → Delivered`; staff can raise and resolve exceptions or cancel before pickup. Pickup and transit milestones require the linked trip to be active, and delivery requires both a completed trip and a POD record with receiver and delivery time; attaching a file is optional. Customers can only view shipments for their own bookings; drivers can only view and update shipments linked to their assigned trips. Attached POD file bytes are stored in MongoDB and are never exposed in list/detail responses; downloads require authentication and ownership authorization. Use a managed private object store with lifecycle/backups before scaling file retention beyond the current MongoDB-backed implementation.

Billing endpoints:

- Super Admin: `GET` and `PUT /api/v1/billing/gst-profile` — optional seller details and CA-reviewed tax-category inputs; GST setup is not required for the internal invoice/payment workflow and does not enable statutory GST invoice issuance
- Admin and manager: `GET /api/v1/billing/options/shipments` — delivered shipments with POD that have not yet been invoiced
- Admin and manager: `POST /api/v1/billing/invoices` — issue one INR-denominated internal invoice per delivered shipment, with saved customer/booking details, charge lines, optional manually entered tax percentage, and due date
- Admin and manager, plus the invoice's customer: `GET /api/v1/billing/invoices`, `GET /api/v1/billing/invoices/:id`, and `GET /api/v1/billing/payments`
- Admin and manager: `POST /api/v1/billing/invoices/:id/payments` — record funds already received; idempotency keys protect retries and payment amounts cannot exceed the remaining invoice balance
- Admin and manager: `PATCH /api/v1/billing/invoices/:id/cancel` — cancel an unpaid invoice with a reason; invoices with payments cannot be cancelled
- Admin and manager: `GET /api/v1/billing/reports/summary` — issued, collected, outstanding, and overdue totals

Invoice and receipt numbers are generated sequentially by year. Amounts and calculated totals are stored in paise to avoid floating-point currency drift; payment collection atomically updates the invoice and appends its receipt. Invoice prices and the optional generic tax rate are entered by authorized staff because the current booking workflow has no approved fare/quote. GST profile setup is optional and does not block the internal billing workflow. The Super Admin can save a GST business profile and CA-reviewed service tax categories under Tax Management. This is configuration only; existing invoices remain an internal billing ledger, **not** compliant GST tax invoices. GST classification/place-of-supply calculations, statutory numbering/credit notes, IRN/e-invoice, and external payment verification/gateway are not configured. Verify profile data and tax treatment with the business accountant before using for statutory filings or enabling online payments.

Fuel Management endpoints:

- Admin and manager: `GET /api/v1/fuel/options/vehicles` and `GET /api/v1/fuel/options/trips?vehicleId=...` — select a registered vehicle and its trips for an entry
- Admin and manager: `POST /api/v1/fuel/entries` — record a fuel purchase with vehicle, optional trip, fill time, quantity/unit, unit price, odometer, full-tank indicator, receipt details, and an idempotency key
- Admin and manager: `GET /api/v1/fuel/entries` — search and page through the fuel ledger, with optional vehicle and date filters
- Admin and manager: `GET /api/v1/fuel/reports/summary` — total fuel cost, quantities by unit, per-vehicle breakdowns, and full-tank mileage intervals

Fuel amounts are stored in integer paise and quantities in thousandths. Each new entry must have an odometer reading greater than the vehicle's latest recorded fuel entry, and its fill time cannot precede the previous entry. Diesel/petrol/hybrid use litres, CNG/LNG use kilograms, and electric vehicles use kWh; vehicles with an unspecified fuel type can use any supported unit. Mileage is calculated only between full-tank entries and includes intervening fuel purchases; it is an operational estimate from manually entered odometer/fuel data, not a GPS or fuel-sensor measurement. Fuel records are staff-only and append-only; external fuel-card/station integrations and automated fraud detection are not connected.

Vehicle Maintenance endpoints:

- Admin and manager: `GET /api/v1/maintenance/options/vehicles` — select a registered vehicle for maintenance or compliance records
- Admin and manager: `POST /api/v1/maintenance/records` and `GET /api/v1/maintenance/records` — schedule service, create repair work orders, and review maintenance history
- Admin and manager: `PATCH /api/v1/maintenance/records/:id/status` — start, complete, or cancel a record; completion records actual cost and odometer
- Admin and manager: `PATCH /api/v1/maintenance/vehicles/:id/documents/:documentType` — update insurance or fitness-certificate metadata (`documentType` is `insurance` or `fitnessCertificate`)
- Admin and manager: `GET /api/v1/maintenance/reminders` — list due/overdue scheduled work and insurance/fitness expiry reminders
- Admin and manager: `GET /api/v1/maintenance/reports/summary` — service/repair counts and completed cost totals

Starting service or a repair atomically marks an available vehicle `UnderMaintenance`; vehicles with active trips or allocations cannot be taken out of service, and fleet allocation continues to allow only available vehicles. Completion records actual cost and odometer, then returns the vehicle to `Available`. A scheduled maintenance record can be cancelled only before work starts; every status transition is audited. Odometer reminders compare scheduled thresholds to the latest odometer captured in the fuel ledger. Each next service must be scheduled as a new record. Insurance/fitness endpoints store metadata and a URL, not uploaded files; configure private storage and access controls before using sensitive document links. Reminder results appear in the application, but automated SMS/email delivery is not configured.

Route Management endpoints:

- Admin and manager: `POST /api/v1/routes`, `PATCH /api/v1/routes/:id`, and `PATCH /api/v1/routes/:id/archive` — maintain manually verified route, distance, duration, waypoint, and toll data
- Admin, manager, and driver: `GET /api/v1/routes` — browse active saved routes
- Admin and manager: `GET /api/v1/routes/suggestions?origin=...&destination=...&vehicleType=...` — rank exact origin/destination matches by recorded distance, duration, and toll cost
- Admin and manager: `GET /api/v1/routes/reports/summary` — review route counts and linked trip-plan distance/toll estimates
- Admin and manager: select a saved route in Trip Route Planning to copy its route number, waypoints, distance, duration, and toll schedule into an immutable trip snapshot

Route distance, estimated duration, and toll prices are entered and maintained by staff. Suggestions rank only exact matches in this local catalogue; they are not road-network directions or live traffic-aware optimization. Route changes do not rewrite existing trip snapshots.

GPS Tracking endpoints:

- Admin and manager: `GET /api/v1/gps/active` — view current InProgress/Delayed trips and their latest location; drivers see only their own active trips
- Assigned driver: `POST /api/v1/gps/trips/:tripId/location` — share a phone/browser location while an assigned trip is active or delayed
- Admin, manager, and assigned driver: `GET /api/v1/gps/trips/:tripId/locations` — review that trip's recorded location history
- Shipment customer: `GET /api/v1/cargo/shipments/:id/live-location` — view the latest location and up to 100 trail points for their own active shipment trip; other customers receive 404
- Admin and manager: `POST /api/v1/gps/geofences` and `PATCH /api/v1/gps/geofences/:id/archive` — manage circular geofences (50 m–100 km radius)
- Admin, manager, and driver: `GET /api/v1/gps/alerts` — view speed-threshold and geofence entry/exit alerts; drivers see only their own alerts
- Authenticated staff, drivers, and customers: `GET /api/v1/gps/map-config` — retrieve the configured Google Maps browser key for map rendering

Set `VITE_GOOGLE_MAPS_API_KEY` in `server/.env` and enable the Google Maps JavaScript API and billing. The key is necessarily visible in a browser; restrict it by production website referrer and enabled API in Google Cloud, and never reuse a server-side secret key. `GPS_SPEED_ALERT_LIMIT_KMH` controls the operational alert threshold (default 80 km/h); these alerts are not legal evidence. Driver sharing requires browser permission, HTTPS outside localhost, and the page kept open; background sharing and hardware tracker providers are not connected. Customers can view a map and the last 100 shared points only for their own active shipment; the map refreshes every 15 seconds and indicates stale data. Location reports are client-device measurements, are not tamper-proof, and are collected only during active trips after sharing is explicitly started. Configure an approved privacy notice, access policy, and data-retention policy before production use.

Expense Tracking endpoints (admin and manager roles):

- `POST /api/v1/billing/expenses` — append an operating expense in INR; supports idempotent submission
- `GET /api/v1/billing/expenses` — paginated ledger with category, vehicle, trip, search and date filters
- `GET /api/v1/billing/expenses/reports/summary` — totals by category and vehicle for the selected period

Expense entries are append-only and preserve the staff creator and timestamps. The manual ledger is separate from Fuel and Maintenance records; do not record the same transaction in multiple ledgers or totals may be double-counted. Receipt uploads and expense approval workflow are not implemented.

Local MongoDB backups (Super Admin only):

- `GET /api/v1/settings/backups/status` — check the connected database and whether `mongodump` is available
- `POST /api/v1/settings/backups/local` — create and download a compressed archive of the currently connected database

Install the official MongoDB Database Tools on the API host. Put `mongodump` on the server process `PATH`, or set `MONGODUMP_PATH` in `server/.env` to its executable and restart the API. Backup generation temporarily stages the archive on server disk, then removes the temporary files after download; it does not retain backups or provide restore. Ensure there is enough free disk space for a full compressed database archive. Store downloaded backups securely and separately from the computer; they contain private business data. Restore is intentionally disabled to prevent accidental data overwrite.

## Reports & Analytics

- Fleet status report reads the current fleet dashboard; it is not a historical status report.
- Driver, fuel, revenue, and trip reports use their connected backend summaries and support the date range where that API provides it.
- Maintenance summary is all-time; the current endpoint does not accept a date range.
- CSV export is available for report tables.
- Vehicle utilization reports actual trip hours per vehicle from recorded start/completion timestamps, clipped to the selected date range. In-progress and delayed trips are measured through the current time. This is measured trip usage, not an availability-adjusted utilization percentage; vehicle availability history and shift hours are not tracked.
- Expense reports summarize manual ledger entries.

## UI and backend libraries

- Tailwind CSS v4 is enabled through the Vite plugin; use utility classes in React components.
- Lucide React provides the frontend icon set.
- The server uses Express, MongoDB/Mongoose, Joi request validation, JSON Web Tokens, and bcrypt password hashing.
