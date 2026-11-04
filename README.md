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
- `npm test --workspace=server` — run authentication and customer integration tests against a temporary MongoDB database

The Vite development server proxies `/api` requests to Express.

## Current backend scope

The frontend contains the planned role panels and module screens. The backend is being rebuilt incrementally. Working API modules are health checks, authentication, Customer Management / Customer Portal, Booking Management, Fleet Management, Driver Management, and Trip Management. Other module screens are not backed by working APIs yet. Customer self-registration does not yet verify phone ownership with OTP, so add that before opening registration to the public in production.

## Logins and roles

Everyone signs in at `/login` with a **login ID and password**. The server returns one of four roles, and the frontend opens the corresponding panel:

| Role | Account setup |
| --- | --- |
| Super Admin (`admin`) | Created on first start from `ADMIN_LOGIN_ID` and `ADMIN_PASSWORD` |
| Transport Manager (`manager`) | Login is attached to a manager profile by authorized staff |
| Driver (`driver`) | Login is attached to a driver profile by authorized staff |
| Customer (`customer`) | Self-registration at `/register`; the mobile number becomes the login ID |

Authentication uses bcrypt password hashes, case-insensitive login IDs, a 15-minute lock after five failed attempts, signed access tokens, and server-side session-version checks. Password changes and disabled logins revoke older sessions. Login sessions are stored per browser tab.

Available authentication endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/change-password`
- `GET` and `PUT /api/v1/auth/accounts/:role/:profileId` for authorized staff-managed logins

Staff can provision manager and driver login credentials from the relevant profiles. Customer profiles can be managed through the Customer Management API. API documentation is available at `/api/docs`.

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

Customer Portal endpoints (customer role):

- `GET /api/v1/customers/portal/dashboard`, `/profile`, `/preferences`, and `/addresses`
- `PUT /api/v1/customers/portal/profile` and `/preferences`
- `POST /api/v1/customers/portal/kyc/submit` and `/kyc/documents`
- `GET /api/v1/customers/portal/kyc/documents` and `/kyc/documents/:documentId/download`
- `POST /api/v1/customers/portal/addresses`, `PUT /api/v1/customers/portal/addresses/:id`, and `DELETE /api/v1/customers/portal/addresses/:id`

KYC document uploads are optional and limited to PDF, JPEG, or PNG files up to 5 MB. Uploaded documents are private; if a customer uploads documents, staff must review them before approving KYC. Changing customer identity data resets KYC verification and requires uploaded documents to be reviewed again.

Booking Management endpoints:

- `POST /api/v1/customers/booking/vehicle` and `/online` — customer booking requests
- `GET /api/v1/customers/booking?page=&limit=&status=` — paginated bookings (customers see only their own)
- `GET /api/v1/customers/booking/calendar?startDate=&endDate=` — admin/manager schedule calendar
- `GET /api/v1/customers/booking/:bookingId` and `/:bookingId/history` — booking details and status history
- `PATCH /api/v1/customers/booking/:bookingId/status` — staff status progression or customer cancellation before confirmation

Bookings receive a unique yearly booking number and start as `pending`. Staff advance them through `under_review`, `quoted`, and `confirmed`, or reject/cancel them; quoted requests can also expire. Each status change records its actor, timestamp, and remarks. Customers can cancel their own unconfirmed bookings but cannot alter another customer's records or advance staff-controlled statuses.

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
- Admin and manager: `GET /api/v1/drivers/performance` for attendance-based summary metrics

Driver codes are generated sequentially by year; mobile numbers and licence numbers are unique. Driver statuses, attendance changes, licence reviews, and salary approval/payment transitions are audited. Inactive or suspended profiles have their login disabled and active sessions revoked; driver soft deletion removes its login while retaining historical records. Attendance is unique per driver and UTC calendar date. Licence expiry states are derived from expiry dates (including the 30-day warning window). Driver document records accept HTTPS references and are role-scoped, but binary upload and private file storage are not connected yet. Salary entries calculate net pay, reject overlapping pay periods, and may only be edited or archived while Draft; salary records track approval and payment but do not initiate an external bank transfer.

Trip Management endpoints:

- Admin and manager: `GET /api/v1/trips/options/allocations` and `POST /api/v1/trips` — schedule one trip for an active allocation on a confirmed booking
- Admin and manager: `PATCH /api/v1/trips/:id/assignment` — assign an available driver with a valid HMV or Transport licence through the planned delivery date
- Admin and manager: `GET` / `POST /api/v1/trips/plans` and `PATCH` / `DELETE /api/v1/trips/plans/:id` — create and maintain route references and planned stops before departure
- Admin and manager: `GET /api/v1/trips/metrics` (optional pickup-date filters); the Trip Reports screen uses these live metrics. All roles: `GET /api/v1/trips`, `/assignments`, `/active`, and `/history` as authorized
- Assigned drivers can read only their own trips and update their own status: `Assigned → InProgress → Delayed / InProgress → Completed`. Only staff can cancel before departure; delay and cancellation require a reason.

Trip numbers are sequential by year. A vehicle allocation can create only one trip; a driver cannot have overlapping scheduled or active trips. Starting and completing a trip update the linked vehicle, driver, allocation, and status history. Staff cannot independently release an allocation while its trip is active. Trip history retains completed and cancelled trips. Driver performance now includes trip status totals; distance, delivery punctuality, and route efficiency require GPS tracking integration.

## UI and backend libraries

- Tailwind CSS v4 is enabled through the Vite plugin; use utility classes in React components.
- Lucide React provides the frontend icon set.
- The server uses Express, MongoDB/Mongoose, Joi request validation, JSON Web Tokens, and bcrypt password hashing.
