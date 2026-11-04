const text = (name, label, options = {}) => ({ name, label, type: 'text', ...options });
const number = (name, label, options = {}) => ({ name, label, type: 'number', ...options });
const date = (name, label, options = {}) => ({ name, label, type: 'date', ...options });
const select = (name, label, options, extra = {}) => ({ name, label, type: 'select', options, ...extra });
const textarea = (name, label, options = {}) => ({ name, label, type: 'textarea', ...options });

const fields = {
  feedback: [
    select('category', 'Feedback category', ['Service', 'Driver', 'Vehicle', 'Delivery', 'Other'], { required: true }),
    select('rating', 'Rating', ['1', '2', '3', '4', '5'], { required: true }),
    text('subject', 'Subject', { required: true }),
    textarea('message', 'Feedback', { required: true }),
    select('status', 'Status', ['Open', 'InReview', 'Resolved', 'Closed'], { required: true })
  ],
  cargo: [
    text('bookingId', 'Booking reference'),
    text('consignmentNumber', 'Consignment / LR number'),
    text('goodsType', 'Goods type', { required: true }),
    text('packageType', 'Package type'),
    number('quantity', 'Quantity', { required: true, min: 1 }),
    number('weightKg', 'Weight (kg)', { required: true, min: 0.01 }),
    text('origin.city', 'Pickup city', { required: true }),
    text('destination.city', 'Delivery city', { required: true }),
    select('status', 'Status', ['Booked', 'PickedUp', 'InTransit', 'OutForDelivery', 'Delivered', 'Exception'], { required: true })
  ],
  pod: [
    text('bookingId', 'Booking reference', { required: true }),
    text('consignmentNumber', 'Consignment / LR number'),
    date('deliveredAt', 'Delivery date', { required: true }),
    text('receivedBy', 'Received by', { required: true }),
    text('receiverPhone', 'Receiver phone'),
    text('documentUrl', 'POD document URL'),
    textarea('remarks', 'Delivery remarks'),
    select('status', 'POD status', ['Submitted', 'Verified', 'Rejected'], { required: true })
  ],
  route: [
    text('routeName', 'Route name', { required: true }),
    text('origin', 'Origin', { required: true }),
    text('destination', 'Destination', { required: true }),
    number('distanceKm', 'Distance (km)', { min: 0 }),
    number('estimatedHours', 'Estimated transit hours', { min: 0 }),
    textarea('waypoints', 'Waypoints'),
    textarea('notes', 'Notes')
  ],
  routePlan: [
    text('tripId', 'Trip reference', { required: true }),
    text('routeId', 'Route reference', { required: true }),
    textarea('waypoints', 'Planned stops'),
    date('plannedStartDate', 'Planned start'),
    textarea('notes', 'Trip instructions')
  ],
  optimization: [
    text('origin', 'Origin', { required: true }),
    text('destination', 'Destination', { required: true }),
    select('vehicleType', 'Vehicle type', ['Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other']),
    select('avoidTolls', 'Avoid toll roads?', ['Yes', 'No']),
    select('avoidRestrictedRoads', 'Avoid restricted roads?', ['Yes', 'No']),
    textarea('waypoints', 'Required stops')
  ],
  toll: [
    text('routeId', 'Route reference', { required: true }),
    text('tollName', 'Toll plaza', { required: true }),
    text('location', 'Location'),
    number('amount', 'Toll amount', { min: 0 }),
    select('vehicleType', 'Vehicle type', ['Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other']),
    textarea('notes', 'Notes')
  ],
  trip: [
    text('bookingId', 'Booking reference', { required: true }),
    text('routeId', 'Route reference'),
    text('vehicleId', 'Vehicle reference'),
    text('driverId', 'Driver reference'),
    date('scheduledAt', 'Scheduled pickup', { required: true }),
    date('expectedDeliveryAt', 'Expected delivery'),
    select('status', 'Trip status', ['Scheduled', 'Assigned', 'InProgress', 'Delayed', 'Completed', 'Cancelled']),
    textarea('notes', 'Trip instructions')
  ],
  allocation: [
    text('bookingId', 'Booking reference', { required: true }),
    text('vehicleId', 'Vehicle reference', { required: true }),
    date('plannedPickupDate', 'Planned pickup', { required: true }),
    date('plannedDeliveryDate', 'Planned delivery', { required: true }),
    textarea('remarks', 'Allocation notes')
  ],
  vehicle: [
    text('registrationNumber', 'Vehicle registration', { required: true }),
    text('vehicleType', 'Vehicle type'),
    text('manufacturer', 'Manufacturer'),
    text('model', 'Model'),
    number('manufacturingYear', 'Manufacturing year'),
    select('vehicleStatus', 'Status', ['Available', 'Allocated', 'OnTrip', 'UnderMaintenance', 'Inactive'])
  ],
  driver: [
    text('personalInfo.fullName', 'Driver name', { required: true }),
    date('personalInfo.dateOfBirth', 'Date of birth'),
    select('personalInfo.gender', 'Gender', ['Male', 'Female', 'Other']),
    text('contactInfo.phone', 'Mobile number', { required: true }),
    text('contactInfo.alternatePhone', 'Alternate mobile'),
    text('contactInfo.email', 'Email', { type: 'email' }),
    text('contactInfo.address.street', 'Street address'),
    text('contactInfo.address.city', 'City'),
    text('contactInfo.address.state', 'State'),
    text('contactInfo.address.postalCode', 'Postal code'),
    text('contactInfo.address.country', 'Country'),
    text('emergencyContact.name', 'Emergency contact name'),
    text('emergencyContact.relationship', 'Emergency contact relationship'),
    text('emergencyContact.phone', 'Emergency contact phone'),
    date('employmentDetails.joiningDate', 'Joining date', { required: true }),
    select('employmentDetails.employmentType', 'Employment type', ['FullTime', 'Contract', 'Attached'], { required: true }),
    number('employmentDetails.experienceYears', 'Experience (years)', { min: 0, max: 60 }),
    select('driverStatus', 'Status', ['Available', 'OnLeave', 'Inactive', 'Suspended'], { required: true }),
    textarea('notes', 'Notes')
  ],
  license: [
    text('driverId', 'Driver reference', { required: true }),
    text('licenseNumber', 'Licence number', { required: true }),
    select('licenseType', 'Licence class', ['LMV', 'HMV', 'Transport', 'Other'], { required: true }),
    date('issueDate', 'Issue date'),
    date('expiryDate', 'Expiry date', { required: true }),
    select('status', 'Status', ['Valid', 'ExpiringSoon', 'Expired', 'UnderReview'])
  ],
  driverDocument: [
    text('driverId', 'Driver reference', { required: true }),
    select('documentType', 'Document type', ['DrivingLicence', 'IdentityProof', 'AddressProof', 'MedicalCertificate', 'Other'], { required: true }),
    text('documentNumber', 'Document number'),
    date('issueDate', 'Issue date'),
    date('expiryDate', 'Expiry date'),
    text('fileUrl', 'Document URL')
  ],
  vehicleDocument: [
    text('vehicleId', 'Vehicle reference', { required: true }),
    select('documentType', 'Document type', ['Insurance', 'FitnessCertificate', 'Permit', 'Other'], { required: true }),
    text('documentNumber', 'Policy / document number'),
    date('issueDate', 'Issue date'),
    date('expiryDate', 'Expiry date', { required: true }),
    text('provider', 'Provider / issuer'),
    text('fileUrl', 'Document URL')
  ],
  attendance: [
    text('driverId', 'Driver reference', { required: true }),
    date('attendanceDate', 'Attendance date', { required: true }),
    select('status', 'Attendance', ['Present', 'Absent', 'OnLeave', 'HalfDay'], { required: true }),
    text('checkIn', 'Check-in time', { type: 'time' }),
    text('checkOut', 'Check-out time', { type: 'time' }),
    textarea('remarks', 'Remarks')
  ],
  gps: [
    text('vehicleId', 'Vehicle reference', { required: true }),
    number('latitude', 'Latitude', { required: true, min: -90, max: 90, step: 'any' }),
    number('longitude', 'Longitude', { required: true, min: -180, max: 180, step: 'any' }),
    date('recordedAt', 'Recorded date'),
    number('speedKph', 'Speed (km/h)', { min: 0 }),
    text('eventType', 'Event type')
  ],
  geofence: [
    text('name', 'Geofence name', { required: true }),
    text('center.latitude', 'Center latitude', { required: true }),
    text('center.longitude', 'Center longitude', { required: true }),
    number('radiusKm', 'Radius (km)', { required: true, min: 0.1 }),
    select('eventType', 'Alert on', ['Entry', 'Exit', 'Both']),
    select('status', 'Status', ['Active', 'Inactive'])
  ],
  fuel: [
    text('vehicleId', 'Vehicle reference', { required: true }),
    date('filledAt', 'Fill date', { required: true }),
    number('quantityLitres', 'Quantity (litres)', { required: true, min: 0.01 }),
    number('pricePerLitre', 'Price per litre', { min: 0 }),
    number('odometerKm', 'Odometer (km)', { min: 0 }),
    text('stationName', 'Fuel station'),
    text('receiptNumber', 'Receipt reference')
  ],
  maintenance: [
    text('vehicleId', 'Vehicle reference', { required: true }),
    text('workOrderNumber', 'Work order'),
    select('serviceType', 'Service type', ['ScheduledService', 'Repair', 'Inspection', 'Tyre', 'Other'], { required: true }),
    date('scheduledAt', 'Scheduled date'),
    date('completedAt', 'Completed date'),
    number('cost', 'Cost', { min: 0 }),
    text('vendor', 'Workshop / vendor'),
    textarea('notes', 'Work details')
  ],
  invoice: [
    text('customerId', 'Customer reference', { required: true }),
    text('bookingId', 'Booking reference'),
    text('invoiceNumber', 'Invoice number'),
    date('invoiceDate', 'Invoice date', { required: true }),
    date('dueDate', 'Due date'),
    number('amount', 'Amount', { required: true, min: 0.01 }),
    number('taxAmount', 'Tax amount', { min: 0 }),
    select('status', 'Status', ['Draft', 'Issued', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled'])
  ],
  payment: [
    text('customerId', 'Customer reference', { required: true }),
    text('invoiceId', 'Invoice reference'),
    date('receivedAt', 'Payment date', { required: true }),
    number('amount', 'Amount received', { required: true, min: 0.01 }),
    select('method', 'Payment method', ['BankTransfer', 'UPI', 'Card', 'Cash', 'Cheque', 'Other']),
    text('transactionReference', 'Transaction reference'),
    select('status', 'Status', ['Received', 'Pending', 'Failed', 'Refunded'])
  ],
  driverSalary: [
    text('driverId', 'Driver reference', { required: true }),
    date('periodStart', 'Pay period start', { required: true }),
    date('periodEnd', 'Pay period end', { required: true }),
    number('baseAmount', 'Base amount', { required: true, min: 0 }),
    number('allowances', 'Allowances', { min: 0 }),
    number('deductions', 'Deductions', { min: 0 }),
    select('status', 'Payment status', ['Draft', 'Approved', 'Paid', 'OnHold'])
  ],
  taxRecord: [
    text('invoiceId', 'Invoice reference'),
    text('taxType', 'Tax type', { required: true }),
    text('taxRate', 'Tax rate'),
    number('taxableAmount', 'Taxable amount', { required: true, min: 0 }),
    number('taxAmount', 'Tax amount', { required: true, min: 0 }),
    date('periodStart', 'Tax period start'),
    date('periodEnd', 'Tax period end'),
    select('status', 'Status', ['Draft', 'Filed', 'Paid', 'Reconciled'])
  ],
  expense: [
    select('category', 'Expense category', ['Fuel', 'Toll', 'Maintenance', 'Driver', 'Operations', 'Other'], { required: true }),
    text('vehicleId', 'Vehicle reference'),
    text('tripId', 'Trip reference'),
    date('incurredAt', 'Expense date', { required: true }),
    number('amount', 'Amount', { required: true, min: 0.01 }),
    text('vendor', 'Vendor'),
    text('reference', 'Receipt / reference'),
    textarea('description', 'Description')
  ],
  notification: [
    select('channel', 'Channel', ['SMS', 'Email', 'Push'], { required: true }),
    text('recipient', 'Recipient', { required: true }),
    text('subject', 'Subject'),
    textarea('message', 'Message', { required: true }),
    select('status', 'Status', ['Queued', 'Sent', 'Delivered', 'Failed'])
  ],
  manager: [
    text('fullName', 'Full name', { required: true }),
    text('phone', 'Mobile number (10 digits)', { required: true }),
    text('email', 'Email'),
    text('branch', 'Branch'),
    select('status', 'Status', ['Active', 'Inactive'], { required: true })
  ],
  setting: [
    text('name', 'Name', { required: true }),
    text('code', 'Code'),
    textarea('description', 'Description'),
    select('status', 'Status', ['Active', 'Inactive'])
  ],
  report: [
    date('startDate', 'From date'),
    date('endDate', 'To date')
  ],
  generic: [
    text('name', 'Name', { required: true }),
    textarea('description', 'Description'),
    select('status', 'Status', ['Open', 'InProgress', 'Completed', 'Cancelled'])
  ]
};

const moduleSpecs = {
  '/crm/feedback': ['customers/feedback', 'feedback', 'Feedback', 'Submitted feedback and service ratings.'],
  '/cargo/booking': ['cargo/shipments', 'cargo', 'Shipments', 'Shipment bookings and cargo handover.'],
  '/cargo/tracking': ['cargo/tracking', 'cargo', 'Tracking events', 'Shipment location and movement updates.'],
  '/cargo/status': ['cargo/deliveries', 'cargo', 'Delivery status', 'Delivery progress and exceptions.'],
  '/cargo/consignment': ['cargo/consignments', 'cargo', 'Consignments / LR', 'Consignment notes and lorry receipt records.'],
  '/cargo/pod': ['cargo/pod', 'pod', 'Proof of delivery', 'Delivery confirmation and attached POD records.'],
  '/routes/create': ['routes', 'route', 'Routes', 'Origin, destination, distance and planned waypoints.'],
  '/routes/distance': ['routes/distance', 'route', 'Route distances', 'Route mileage and transit estimates.'],
  '/routes/optimization': ['routes/optimization', 'optimization', 'Route optimization', 'Route planning requests and optimization results.'],
  '/routes/tolls': ['routes/tolls', 'toll', 'Toll records', 'Toll plaza details and route costs.'],
  '/trips/scheduling': ['trips', 'trip', 'Scheduled trips', 'Scheduled vehicle movements and delivery windows.'],
  '/trips/route-planning': ['trips/plans', 'routePlan', 'Trip route plans', 'Planned trip routes and milestones.'],
  '/trips/assignment': ['trips/assignments', 'trip', 'Trip assignments', 'Vehicle and driver assignment records.'],
  '/trips/monitoring': ['trips/active', 'trip', 'Active trips', 'In-progress trips and operational exceptions.'],
  '/trips/history': ['trips/history', 'trip', 'Trip history', 'Completed and cancelled trip records.'],
  '/fleet/dashboard': ['fleet/vehicles/dashboard', 'report', 'Fleet overview', 'Live vehicle availability and fleet status totals.'],
  '/fleet/allocation': ['fleet/vehicles/allocations', 'allocation', 'Vehicle allocations', 'Allocate an available vehicle to a confirmed booking and release or cancel the allocation.'],
  '/fleet/history': ['fleet/vehicles/history', 'vehicle', 'Fleet history', 'Vehicle allocation and service history.'],
  '/fleet/performance': ['fleet/vehicles/performance', 'report', 'Fleet performance', 'Fleet utilization and operational performance.'],
  '/drivers/register': ['drivers', 'driver', 'Driver directory', 'Driver contact, licence and employment records.'],
  '/drivers/licenses': ['drivers/licenses', 'license', 'Licence records', 'Driver licence classes, validity and expiry.'],
  '/drivers/documents': ['drivers/documents', 'driverDocument', 'Driver documents', 'Driver identity and compliance documents.'],
  '/drivers/attendance': ['drivers/attendance', 'attendance', 'Driver attendance', 'Daily driver attendance and check-in records.'],
  '/drivers/performance': ['drivers/performance', 'report', 'Driver performance', 'Attendance and trip status totals. GPS-based distance and route efficiency will be available when tracking is connected.'],
  '/drivers/salary': ['drivers/payments', 'driverSalary', 'Driver payments', 'Driver salary, pay periods and settlement records.'],
  '/gps/live': ['gps/live', 'gps', 'Live vehicle locations', 'Latest location data reported by connected tracking devices.'],
  '/gps/route': ['gps/routes', 'gps', 'Route tracking', 'Location updates matched against planned trip routes.'],
  '/gps/geofencing': ['gps/geofences', 'geofence', 'Geofences', 'Location-based entry and exit alert boundaries.'],
  '/gps/history': ['gps/history', 'gps', 'Location history', 'Recorded vehicle coordinates and movement history.'],
  '/gps/speed': ['gps/speed-events', 'gps', 'Speed events', 'Vehicle speed readings and threshold events.'],
  '/gps/alerts': ['gps/alerts', 'notification', 'GPS alerts', 'Location and tracking alerts requiring review.'],
  '/fuel/entry': ['fuel/entries', 'fuel', 'Fuel entries', 'Fuel quantities, prices and odometer readings.'],
  '/fuel/consumption': ['fuel/consumption', 'fuel', 'Fuel consumption', 'Vehicle fuel consumption by trip and period.'],
  '/fuel/mileage': ['fuel/mileage', 'fuel', 'Mileage records', 'Odometer-based mileage and efficiency records.'],
  '/fuel/cost-analysis': ['fuel/costs', 'report', 'Fuel cost analysis', 'Fuel spend and cost comparisons for a selected period.'],
  '/maintenance/schedule': ['maintenance/schedules', 'maintenance', 'Service schedule', 'Planned vehicle services and inspection dates.'],
  '/maintenance/repairs': ['maintenance/work-orders', 'maintenance', 'Repair work orders', 'Repair requests, work completed and service costs.'],
  '/maintenance/insurance': ['maintenance/insurance', 'vehicleDocument', 'Vehicle insurance', 'Vehicle insurance policy and renewal dates.'],
  '/maintenance/fitness': ['maintenance/fitness', 'vehicleDocument', 'Fitness certificates', 'Vehicle fitness certificate validity and renewals.'],
  '/maintenance/history': ['maintenance/history', 'maintenance', 'Maintenance history', 'Completed service and repair records.'],
  '/maintenance/reminders': ['maintenance/reminders', 'maintenance', 'Maintenance reminders', 'Upcoming service and compliance reminders.'],
  '/billing/invoices': ['billing/invoices', 'invoice', 'Invoices', 'Customer invoices, taxes and payment status.'],
  '/billing/payments': ['billing/payments', 'payment', 'Payments', 'Payments received and transaction references.'],
  '/billing/expenses': ['billing/expenses', 'expense', 'Expenses', 'Fuel, toll, service and other operating expenses.'],
  '/billing/tax': ['billing/tax-records', 'taxRecord', 'Tax records', 'Tax calculations and filing records.'],
  '/billing/reports': ['billing/reports', 'report', 'Financial reports', 'Revenue, collections and outstanding balance totals.'],
  '/notifications/sms': ['notifications/sms', 'notification', 'SMS notifications', 'SMS delivery status and recipient history.'],
  '/notifications/email': ['notifications/email', 'notification', 'Email notifications', 'Email delivery status and recipient history.'],
  '/notifications/push': ['notifications/push', 'notification', 'Push notifications', 'Push notification delivery and device targeting.'],
  '/notifications/trips': ['notifications/trips', 'notification', 'Trip alerts', 'Trip and delivery notifications.'],
  '/reports/fleet': ['reports/fleet', 'report', 'Fleet reports', 'Fleet availability, assignments and utilization reports.'],
  '/reports/driver': ['reports/driver', 'report', 'Driver reports', 'Driver attendance, assignments and performance reports.'],
  '/reports/fuel': ['reports/fuel', 'report', 'Fuel reports', 'Fuel consumption and cost reports.'],
  '/reports/maintenance': ['reports/maintenance', 'report', 'Maintenance reports', 'Maintenance schedule, downtime and repair costs.'],
  '/reports/revenue': ['reports/revenue', 'report', 'Revenue reports', 'Revenue and booking totals for the selected period.'],
  '/reports/expense': ['reports/expense', 'report', 'Expense reports', 'Operating expenses by category and period.'],
  '/reports/trip': ['trips/metrics', 'report', 'Trip reports', 'Trip completion, delay and route summaries.'],
  '/reports/utilization': ['reports/utilization', 'report', 'Vehicle utilization', 'Vehicle assignment and active time reports.'],
  '/settings/managers': ['admin/managers', 'manager', 'Manager accounts', 'Add transport managers, then use Login on each row to set their login ID and password. Set a manager to Inactive to block their login.'],
  '/settings/roles': ['settings/roles', 'setting', 'Roles & permissions', 'Application roles and permission assignments.'],
  '/settings/branches': ['settings/branches', 'setting', 'Branches', 'Operating branch details and branch status.'],
  '/settings/payment-gateway': ['settings/payment-gateway', 'setting', 'Payment gateway', 'Payment provider configuration references and activation state.'],
  '/settings/backup': ['settings/backups', 'setting', 'Backup & restore', 'Backup job history and restore requests.'],
  '/settings/language': ['settings/languages', 'setting', 'Languages', 'Available application languages and locale settings.']
};

const fieldsByKind = {
  feedback: fields.feedback,
  cargo: fields.cargo,
  pod: fields.pod,
  route: fields.route,
  routePlan: fields.routePlan,
  optimization: fields.optimization,
  toll: fields.toll,
  trip: fields.trip,
  allocation: fields.allocation,
  vehicle: fields.vehicle,
  driver: fields.driver,
  license: fields.license,
  driverDocument: fields.driverDocument,
  vehicleDocument: fields.vehicleDocument,
  attendance: fields.attendance,
  gps: fields.gps,
  geofence: fields.geofence,
  fuel: fields.fuel,
  maintenance: fields.maintenance,
  invoice: fields.invoice,
  payment: fields.payment,
  driverSalary: fields.driverSalary,
  taxRecord: fields.taxRecord,
  expense: fields.expense,
  notification: fields.notification,
  manager: fields.manager,
  setting: fields.setting,
  report: fields.report,
  generic: fields.generic
};

export const moduleWorkspaceByPath = Object.fromEntries(
  Object.entries(moduleSpecs).map(([path, [endpoint, kind, title, description]]) => [
    path,
    {
      endpoint,
      kind,
      title,
      singular: {
        feedback: 'feedback item',
        cargo: 'shipment',
        pod: 'POD record',
        route: 'route',
        routePlan: 'route plan',
        optimization: 'optimization request',
        toll: 'toll record',
        trip: 'trip',
        allocation: 'allocation',
        vehicle: 'vehicle',
        driver: 'driver',
        license: 'licence record',
        driverDocument: 'driver document',
        vehicleDocument: 'vehicle document',
        attendance: 'attendance record',
        gps: 'location record',
        geofence: 'geofence',
        fuel: 'fuel entry',
        maintenance: 'work order',
        invoice: 'invoice',
        payment: 'payment',
        driverSalary: 'salary record',
        taxRecord: 'tax record',
        expense: 'expense',
        notification: 'notification',
        manager: 'manager',
        setting: 'setting',
        report: 'report'
      }[kind] || 'record',
      description,
      readOnly: kind === 'report' || ['/cargo/tracking', '/cargo/status', '/trips/monitoring', '/trips/history', '/fleet/dashboard', '/fleet/history', '/fleet/performance', '/drivers/performance', '/gps/live', '/gps/route', '/gps/history', '/gps/speed', '/gps/alerts', '/fuel/consumption', '/fuel/mileage', '/fuel/cost-analysis', '/maintenance/history', '/maintenance/reminders', '/billing/reports'].includes(path),
      allowEdit: path !== '/fleet/allocation',
      allowDelete: path !== '/fleet/allocation',
      searchable: path !== '/fleet/allocation',
      ...(path === '/fleet/allocation' ? {
        statusField: { name: 'allocationStatus', label: 'Allocation status' },
        statusFilterOptions: ['Allocated', 'Released', 'Cancelled'],
        statusUpdateOptions: ['Released', 'Cancelled'],
        statusLockedValues: ['Released', 'Cancelled']
      } : {}),
      ...(path === '/drivers/register' ? {
        statusUpdateOptions: ['Available', 'OnLeave', 'Inactive', 'Suspended']
      } : {}),
      ...(path === '/drivers/licenses' ? {
        statusUpdateOptions: ['Valid', 'UnderReview']
      } : {}),
      // Rows get a "Login" action to create/reset that person's login ID and password.
      loginAccess: {
        '/settings/managers': { role: 'manager', name: 'fullName', suggestedLoginId: 'phone' },
        '/drivers/register': { role: 'driver', name: 'personalInfo.fullName', suggestedLoginId: 'contactInfo.phone' }
      }[path] || null,
      fields: fieldsByKind[kind] || fields.generic,
      columns: path === '/fleet/allocation'
        ? [
            { name: 'allocationNumber', label: 'Allocation' },
            { name: 'bookingId.bookingNumber', label: 'Booking' },
            { name: 'vehicleId.registrationNumber', label: 'Vehicle' },
            { name: 'plannedPickupDate', label: 'Pickup' },
            { name: 'plannedDeliveryDate', label: 'Delivery' }
          ]
        : kind === 'report'
        ? [{ name: 'metric', label: 'Metric' }, { name: 'value', label: 'Value' }, { name: 'period', label: 'Period' }]
        : kind === 'gps'
          ? [{ name: 'vehicleId', label: 'Vehicle' }, { name: 'latitude', label: 'Latitude' }, { name: 'longitude', label: 'Longitude' }, { name: 'speedKph', label: 'Speed (km/h)' }, { name: 'recordedAt', label: 'Recorded at' }]
          : null
    }
  ])
);

export const moduleFieldDefinitions = fields;
