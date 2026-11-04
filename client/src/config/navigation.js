import {
  Activity,
  BarChart3,
  Bell,
  Calendar,
  Car,
  ClipboardCheck,
  CreditCard,
  Fuel,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  Receipt,
  Settings,
  Truck,
  UserCheck,
  Users,
  Wrench
} from 'lucide-react';

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
  {
    title: 'Customer Management',
    icon: Users,
    submenus: [
      { name: 'Customer Accounts', path: '/crm/customers', description: 'Manage customer profiles, account status and KYC reviews.' },
      { name: 'Customer Portal', path: '/crm/portal', description: 'Manage customer self-service profiles and KYC documents.' },
      { name: 'Booking History', path: '/crm/history', description: 'Review customer booking history.' },
      { name: 'Feedback Management', path: '/crm/feedback', description: 'Review and respond to customer feedback.' }
    ]
  },
  {
    title: 'Booking Management',
    icon: Calendar,
    submenus: [
      { name: 'Vehicle Booking', path: '/bookings/vehicle', description: 'Create and manage vehicle booking requests.' },
      { name: 'Online Booking', path: '/bookings/online', description: 'Review bookings submitted through customer channels.' },
      { name: 'Booking Calendar', path: '/bookings/calendar', description: 'View bookings by pickup and delivery dates.' },
      { name: 'Booking Status', path: '/bookings/status', description: 'Track and update booking status.' }
    ]
  },
  {
    title: 'Cargo & Shipment',
    icon: Package,
    submenus: [
      { name: 'Shipment Booking', path: '/cargo/booking', description: 'Create shipment and consignment records.' },
      { name: 'Parcel Tracking', path: '/cargo/tracking', description: 'Track parcel movement and delivery progress.' },
      { name: 'Delivery Status', path: '/cargo/status', description: 'Review delivery status and exceptions.' },
      { name: 'Consignment / LR', path: '/cargo/consignment', description: 'Manage consignment notes and lorry receipts.' },
      { name: 'POD Management', path: '/cargo/pod', description: 'Manage proof-of-delivery records.' }
    ]
  },
  {
    title: 'Route Management',
    icon: MapPin,
    submenus: [
      { name: 'Route Creation', path: '/routes/create', description: 'Create and maintain transport routes.' },
      { name: 'Distance Management', path: '/routes/distance', description: 'Maintain route distances and transit estimates.' },
      { name: 'Route Optimization', path: '/routes/optimization', description: 'Plan efficient routes for transport operations.' },
      { name: 'Toll Tracking', path: '/routes/tolls', description: 'Manage toll information for routes.' }
    ]
  },
  {
    title: 'Trip Management',
    icon: Truck,
    submenus: [
      { name: 'Trip Scheduling', path: '/trips/scheduling', description: 'Schedule trips against confirmed bookings.' },
      { name: 'Route Planning', path: '/trips/route-planning', description: 'Plan trip routes and milestones.' },
      { name: 'Trip Assignment', path: '/trips/assignment', description: 'Assign vehicles and drivers to trips.' },
      { name: 'Trip Monitoring', path: '/trips/monitoring', description: 'Monitor in-progress trips and exceptions.' },
      { name: 'Trip History', path: '/trips/history', description: 'Review completed and cancelled trips.' },
    ]
  },
  {
    title: 'Fleet Management',
    icon: Car,
    submenus: [
      { name: 'Vehicle Registration', path: '/fleet/register', description: 'Register vehicles and manage fleet records.' },
      { name: 'Fleet Dashboard', path: '/fleet/dashboard', description: 'Review fleet availability and operational status.' },
      { name: 'Vehicle Allocation', path: '/fleet/allocation', description: 'Allocate vehicles to bookings and trips.' },
      { name: 'Fleet Status', path: '/fleet/status', description: 'Review and update vehicle operational status.' },
      { name: 'Fleet History', path: '/fleet/history', description: 'Review vehicle allocation and service history.' },
      { name: 'Fleet Performance', path: '/fleet/performance', description: 'Review fleet utilization and performance.' }
    ]
  },
  {
    title: 'Driver Management',
    icon: UserCheck,
    submenus: [
      { name: 'Driver Registration', path: '/drivers/register', description: 'Register drivers and maintain their profiles.' },
      { name: 'License Management', path: '/drivers/licenses', description: 'Track driver licence details and expiry.' },
      { name: 'Driver Documents', path: '/drivers/documents', description: 'Manage driver compliance documents.' },
      { name: 'Driver Attendance', path: '/drivers/attendance', description: 'Record and review driver attendance.' },
      { name: 'Driver Performance', path: '/drivers/performance', description: 'Review driver performance and trip history.' },
      { name: 'Driver Salary', path: '/drivers/salary', description: 'Manage driver salary and payment records.' }
    ]
  },
  {
    title: 'GPS Tracking',
    icon: Navigation,
    submenus: [
      { name: 'Live Tracking', path: '/gps/live', description: 'View live vehicle location data.' },
      { name: 'Route Tracking', path: '/gps/route', description: 'Compare trip progress against planned routes.' },
      { name: 'Geofencing', path: '/gps/geofencing', description: 'Configure and review geofence events.' },
      { name: 'Location History', path: '/gps/history', description: 'Review recorded vehicle location history.' },
      { name: 'Speed Monitoring', path: '/gps/speed', description: 'Review vehicle speed events.' },
      { name: 'Alerts & Notifications', path: '/gps/alerts', description: 'Review GPS and vehicle alerts.' }
    ]
  },
  {
    title: 'Fuel Management',
    icon: Fuel,
    submenus: [
      { name: 'Fuel Entry', path: '/fuel/entry', description: 'Record vehicle fuel transactions.' },
      { name: 'Fuel Consumption', path: '/fuel/consumption', description: 'Review vehicle fuel consumption.' },
      { name: 'Mileage Tracking', path: '/fuel/mileage', description: 'Track vehicle mileage and efficiency.' },
      { name: 'Fuel Cost Analysis', path: '/fuel/cost-analysis', description: 'Analyze fuel expenditure.' }
    ]
  },
  {
    title: 'Vehicle Maintenance',
    icon: Wrench,
    submenus: [
      { name: 'Service Schedule', path: '/maintenance/schedule', description: 'Plan and review vehicle servicing.' },
      { name: 'Repair Management', path: '/maintenance/repairs', description: 'Track vehicle repairs and work orders.' },
      { name: 'Insurance Tracking', path: '/maintenance/insurance', description: 'Track vehicle insurance details and expiry.' },
      { name: 'Fitness Certificate', path: '/maintenance/fitness', description: 'Track vehicle fitness certificates and expiry.' },
      { name: 'Maintenance History', path: '/maintenance/history', description: 'Review vehicle maintenance history.' },
      { name: 'Reminder Alerts', path: '/maintenance/reminders', description: 'Review upcoming service and compliance reminders.' }
    ]
  },
  {
    title: 'Billing & Accounting',
    icon: Receipt,
    submenus: [
      { name: 'Invoice Generation', path: '/billing/invoices', description: 'Create and manage customer invoices.' },
      { name: 'Payment Collection', path: '/billing/payments', description: 'Record and review customer payments.' },
      { name: 'Expense Tracking', path: '/billing/expenses', description: 'Track operational expenses.' },
      { name: 'Tax Management', path: '/billing/tax', description: 'Manage tax information and filings.' },
      { name: 'Financial Reports', path: '/billing/reports', description: 'Review financial reports.' }
    ]
  },
  {
    title: 'Notification Center',
    icon: Bell,
    submenus: [
      { name: 'SMS Alerts', path: '/notifications/sms', description: 'Manage SMS alert delivery.' },
      { name: 'Email Notifications', path: '/notifications/email', description: 'Manage email notifications.' },
      { name: 'Push Notifications', path: '/notifications/push', description: 'Manage push notifications.' },
      { name: 'Trip Alerts', path: '/notifications/trips', description: 'Review trip-related notifications.' }
    ]
  },
  {
    title: 'Reports & Analytics',
    icon: BarChart3,
    submenus: [
      { name: 'Fleet Reports', path: '/reports/fleet', description: 'Analyze fleet operations.' },
      { name: 'Driver Reports', path: '/reports/driver', description: 'Analyze driver activity and performance.' },
      { name: 'Fuel Reports', path: '/reports/fuel', description: 'Analyze fuel activity and cost.' },
      { name: 'Maintenance Reports', path: '/reports/maintenance', description: 'Analyze maintenance activity.' },
      { name: 'Revenue Reports', path: '/reports/revenue', description: 'Analyze transport revenue.' },
      { name: 'Expense Reports', path: '/reports/expense', description: 'Analyze operational expenses.' },
      { name: 'Trip Reports', path: '/reports/trip', description: 'Analyze trip activity.' },
      { name: 'Vehicle Utilization', path: '/reports/utilization', description: 'Analyze vehicle utilization.' }
    ]
  },
  {
    title: 'System Settings',
    icon: Settings,
    submenus: [
      { name: 'Manager Accounts', path: '/settings/managers', description: 'Create transport manager logins and enable or disable their access.' },
      { name: 'User Roles & Permissions', path: '/settings/roles', description: 'Manage application roles and permissions.' },
      { name: 'Multi-Branch Management', path: '/settings/branches', description: 'Manage operating branches.' },
      { name: 'Payment Gateway Settings', path: '/settings/payment-gateway', description: 'Configure payment gateway settings.' },
      { name: 'Backup & Restore', path: '/settings/backup', description: 'Manage system backup and restore.' },
      { name: 'Multi-Language Support', path: '/settings/language', description: 'Configure application languages.' }
    ]
  }
];

const pathsForRole = {
  admin: menuItems.flatMap((item) => item.submenus?.map((submenu) => submenu.path) || []),
  manager: [
    '/crm/customers', '/crm/history', '/crm/feedback',
    '/bookings/vehicle', '/bookings/online', '/bookings/calendar', '/bookings/status',
    '/cargo/booking', '/cargo/tracking', '/cargo/status', '/cargo/consignment', '/cargo/pod',
    '/routes/create', '/routes/distance', '/routes/optimization', '/routes/tolls',
    '/trips/scheduling', '/trips/route-planning', '/trips/assignment', '/trips/monitoring', '/trips/history',
    '/fleet/register', '/fleet/dashboard', '/fleet/allocation', '/fleet/status', '/fleet/history', '/fleet/performance',
    '/drivers/register', '/drivers/licenses', '/drivers/documents', '/drivers/attendance', '/drivers/performance', '/drivers/salary',
    '/gps/live', '/gps/route', '/gps/geofencing', '/gps/history', '/gps/speed', '/gps/alerts',
    '/fuel/entry', '/fuel/consumption', '/fuel/mileage', '/fuel/cost-analysis',
    '/maintenance/schedule', '/maintenance/repairs', '/maintenance/insurance', '/maintenance/fitness', '/maintenance/history', '/maintenance/reminders',
    '/billing/invoices', '/billing/payments', '/billing/expenses', '/billing/tax', '/billing/reports',
    '/notifications/sms', '/notifications/email', '/notifications/push', '/notifications/trips',
    '/reports/fleet', '/reports/driver', '/reports/fuel', '/reports/maintenance', '/reports/revenue', '/reports/expense', '/reports/trip', '/reports/utilization'
  ],
  driver: [
    '/trips/assignment', '/trips/monitoring', '/trips/history',
    '/routes/distance',
    '/drivers/licenses', '/drivers/documents', '/drivers/attendance', '/drivers/salary',
    '/gps/live', '/gps/route', '/gps/history', '/gps/speed', '/gps/alerts',
    '/maintenance/schedule', '/maintenance/repairs', '/maintenance/insurance', '/maintenance/fitness',
    '/notifications/trips'
  ],
  customer: [
    '/crm/portal', '/crm/history', '/crm/feedback',
    '/bookings/vehicle', '/bookings/online', '/bookings/status',
    '/cargo/tracking', '/cargo/status', '/cargo/pod',
    '/billing/invoices', '/billing/payments'
  ]
};

function menuForRole(role) {
  const allowedPaths = new Set(pathsForRole[role] || []);
  return [
    menuItems[0],
    ...menuItems.slice(1).flatMap((item) => {
      const submenus = item.submenus.filter((submenu) => allowedPaths.has(submenu.path));
      return submenus.length ? [{ ...item, submenus }] : [];
    })
  ];
}

// Each login role gets its own panel. `value` matches the role in the API access token.
export const panelOptions = [
  {
    value: 'admin',
    label: 'Super Admin Panel',
    title: 'Super Admin',
    description: 'Full access to every module, system settings and manager accounts.'
  },
  {
    value: 'manager',
    label: 'Transport Manager Panel',
    title: 'Transport Manager',
    description: 'Run daily operations: customers, bookings, fleet, drivers and reports.'
  },
  {
    value: 'driver',
    label: 'Driver Panel',
    title: 'Driver',
    description: 'See your trips, attendance, licence, documents and salary records.'
  },
  {
    value: 'customer',
    label: 'Customer Panel',
    title: 'Customer',
    description: 'Book vehicles, track shipments, manage your profile and KYC.'
  }
];

export const panelByRole = Object.fromEntries(panelOptions.map((panel) => [panel.value, panel]));

// Roles that can only view records in the generic module workspaces (the API enforces this too).
export const readOnlyRoles = ['driver'];

export const roleMenus = {
  admin: menuForRole('admin'),
  manager: menuForRole('manager'),
  driver: menuForRole('driver'),
  customer: menuForRole('customer')
};

export function canAccessPath(role, path) {
  return (roleMenus[role] || []).some((item) => item.submenus?.some((submenu) => submenu.path === path));
}

export const moduleByPath = Object.fromEntries(
  menuItems.flatMap((item) =>
    (item.submenus || []).map((submenu) => [
      submenu.path,
      { ...submenu, category: item.title, icon: item.icon }
    ])
  )
);

export const allModulePaths = Object.keys(moduleByPath);
