module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Transport CRM API',
    version: '1.0.0',
    description: 'Authentication, customer management, customer portal, booking, fleet, driver, and trip endpoints currently enabled in the backend.'
  },
  servers: [{ url: '/', description: 'Current API host' }],
  tags: [
    { name: 'Health' },
    { name: 'Authentication' },
    { name: 'Customer Management' },
    { name: 'Customer Portal' },
    { name: 'Booking Management' },
    { name: 'Fleet Management' },
    { name: 'Driver Management' },
    { name: 'Trip Management' }
  ],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas: {
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errors: { type: 'array', items: { type: 'object' } }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['loginId', 'password'],
        properties: {
          loginId: { type: 'string', example: 'admin' },
          password: { type: 'string', format: 'password' }
        },
        additionalProperties: false
      },
      CustomerRegistration: {
        type: 'object',
        required: ['contactPerson', 'phone', 'password'],
        properties: {
          contactPerson: { type: 'string', minLength: 2, maxLength: 100 },
          companyName: { type: 'string', maxLength: 150 },
          phone: { type: 'string', pattern: '^[6-9]\\d{9}$', example: '9876543210' },
          password: { type: 'string', minLength: 8, maxLength: 72, format: 'password' }
        },
        additionalProperties: false
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', format: 'password' },
          newPassword: { type: 'string', minLength: 8, maxLength: 72, format: 'password' }
        },
        additionalProperties: false
      },
      AccountUpsert: {
        type: 'object',
        required: ['loginId'],
        properties: {
          loginId: { type: 'string', minLength: 3, maxLength: 50 },
          password: { type: 'string', minLength: 8, maxLength: 72, format: 'password' },
          status: { type: 'string', enum: ['Active', 'Disabled'] }
        },
        additionalProperties: false
      },
      CustomerProfileUpdate: {
        type: 'object',
        properties: {
          companyName: { type: 'string', maxLength: 150 },
          contactPerson: { type: 'string', maxLength: 100 },
          customerType: { type: 'string', enum: ['individual', 'business'] },
          businessType: { type: 'string', maxLength: 120 },
          industry: { type: 'string', maxLength: 120 },
          phone: { type: 'string', pattern: '^[6-9]\\d{9}$' },
          email: { type: 'string', format: 'email' },
          gstin: { type: 'string', pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' },
          pan: { type: 'string', pattern: '^[A-Z]{5}\\d{4}[A-Z]$' },
          address: { type: 'object', additionalProperties: { type: 'string' } },
          notes: { type: 'string', maxLength: 2000 }
        },
        additionalProperties: false
      },
      CustomerPortalProfileUpdate: {
        type: 'object',
        properties: {
          companyName: { type: 'string', maxLength: 150 },
          contactPerson: { type: 'string', maxLength: 100 },
          email: { type: 'string', format: 'email' },
          gstin: { type: 'string' },
          pan: { type: 'string', pattern: '^[A-Z]{5}\\d{4}[A-Z]$' },
          address: { type: 'object', additionalProperties: { type: 'string' } }
        },
        additionalProperties: false
      },
      KycReview: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['Verified', 'Rejected'] },
          remarks: { type: 'string', maxLength: 500 }
        },
        additionalProperties: false
      },
      CustomerActivity: {
        type: 'object',
        required: ['type', 'subject'],
        properties: {
          type: { type: 'string', enum: ['note', 'call', 'email', 'sms', 'follow_up'] },
          subject: { type: 'string', minLength: 1, maxLength: 120 },
          description: { type: 'string', maxLength: 2000 },
          followUpAt: { type: 'string', format: 'date-time' }
        },
        additionalProperties: false
      },
      SavedAddress: {
        type: 'object',
        required: ['address', 'city', 'state', 'pincode'],
        properties: {
          label: { type: 'string', maxLength: 60 },
          address: { type: 'string', minLength: 3, maxLength: 500 },
          city: { type: 'string', minLength: 2, maxLength: 100 },
          state: { type: 'string', minLength: 2, maxLength: 100 },
          pincode: { type: 'string', pattern: '^\\d{6}$' },
          contactName: { type: 'string', maxLength: 100 },
          contactPhone: { type: 'string', maxLength: 20 },
          isDefault: { type: 'boolean' }
        },
        additionalProperties: false
      },
      BookingRequest: {
        type: 'object',
        required: ['pickupAddress', 'deliveryAddress', 'cargo', 'vehicleRequirement', 'schedule'],
        properties: {
          pickupAddress: { $ref: '#/components/schemas/BookingAddress' },
          deliveryAddress: { $ref: '#/components/schemas/BookingAddress' },
          cargo: {
            type: 'object',
            required: ['goodsType', 'packageType', 'quantity', 'weightKg'],
            properties: {
              goodsType: { type: 'string', minLength: 2, maxLength: 100 },
              description: { type: 'string', maxLength: 1000 },
              packageType: { type: 'string', enum: ['box', 'bag', 'pallet', 'carton', 'drum', 'container', 'loose', 'other'] },
              quantity: { type: 'integer', minimum: 1, maximum: 100000 },
              weightKg: { type: 'number', exclusiveMinimum: 0, maximum: 100000000 },
              volumeCbm: { type: 'number', minimum: 0 },
              specialInstructions: { type: 'string', maxLength: 1000 }
            },
            additionalProperties: false
          },
          vehicleRequirement: {
            type: 'object',
            required: ['vehicleType'],
            properties: {
              vehicleType: { type: 'string', enum: ['Open Body', 'Container', 'Trailer', 'Heavy Duty', 'Temperature Controlled'] },
              minCapacityKg: { type: 'number', minimum: 0 },
              specialRequirements: { type: 'string', maxLength: 500 }
            },
            additionalProperties: false
          },
          schedule: {
            type: 'object',
            required: ['pickupDate', 'expectedDeliveryDate'],
            properties: {
              pickupDate: { type: 'string', format: 'date-time' },
              expectedDeliveryDate: { type: 'string', format: 'date-time' }
            },
            additionalProperties: false
          }
        },
        additionalProperties: false
      },
      BookingAddress: {
        type: 'object',
        required: ['contactName', 'contactPhone', 'street', 'city', 'state', 'pincode'],
        properties: {
          contactName: { type: 'string', minLength: 2, maxLength: 100 },
          contactPhone: { type: 'string', pattern: '^\\+?[0-9][0-9\\s-]{7,19}$' },
          street: { type: 'string', minLength: 3, maxLength: 200 },
          city: { type: 'string', minLength: 2, maxLength: 100 },
          state: { type: 'string', minLength: 2, maxLength: 100 },
          pincode: { type: 'string', pattern: '^\\d{6}$' },
          landmark: { type: 'string', maxLength: 150 },
          country: { type: 'string', maxLength: 80, default: 'India' }
        },
        additionalProperties: false
      },
      BookingStatusUpdate: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['pending', 'under_review', 'quoted', 'confirmed', 'rejected', 'cancelled', 'expired'] },
          remarks: { type: 'string', maxLength: 500 }
        },
        additionalProperties: false
      },
      FleetVehicle: {
        type: 'object',
        required: ['registrationNumber', 'vehicleType', 'manufacturer', 'model', 'manufacturingYear', 'capacity', 'fuelType'],
        properties: {
          registrationNumber: { type: 'string', pattern: '^[A-Z0-9 -]{5,20}$' },
          vehicleType: { type: 'string', enum: ['Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other'] },
          manufacturer: { type: 'string', minLength: 2, maxLength: 100 },
          model: { type: 'string', minLength: 1, maxLength: 100 },
          manufacturingYear: { type: 'integer', minimum: 1950 },
          capacity: {
            type: 'object',
            required: ['value', 'unit'],
            properties: {
              value: { type: 'number', exclusiveMinimum: 0 },
              unit: { type: 'string', enum: ['Ton', 'KG', 'Litre'] }
            },
            additionalProperties: false
          },
          FleetVehicleUpdate: {
            type: 'object',
            minProperties: 1,
            properties: {
              registrationNumber: { type: 'string', pattern: '^[A-Z0-9 -]{5,20}$' },
              vehicleType: { type: 'string', enum: ['Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other'] },
              manufacturer: { type: 'string', minLength: 2, maxLength: 100 },
              model: { type: 'string', minLength: 1, maxLength: 100 },
              manufacturingYear: { type: 'integer', minimum: 1950 },
              capacity: { type: 'object', required: ['value', 'unit'], properties: { value: { type: 'number', exclusiveMinimum: 0 }, unit: { type: 'string', enum: ['Ton', 'KG', 'Litre'] } }, additionalProperties: false },
              fuelType: { type: 'string', enum: ['Diesel', 'Petrol', 'CNG', 'LNG', 'Electric', 'Hybrid', 'Other'] },
              ownershipType: { type: 'string', enum: ['Owned', 'Leased', 'Attached'] },
              color: { type: 'string', maxLength: 50 },
              chassisNumber: { type: 'string', maxLength: 100 },
              engineNumber: { type: 'string', maxLength: 100 },
              purchaseDate: { type: 'string', format: 'date-time', nullable: true },
              notes: { type: 'string', maxLength: 1000 },
              documents: { type: 'object' }
            },
            additionalProperties: false
          },
          fuelType: { type: 'string', enum: ['Diesel', 'Petrol', 'CNG', 'LNG', 'Electric', 'Hybrid', 'Other'] },
          ownershipType: { type: 'string', enum: ['Owned', 'Leased', 'Attached'] },
          color: { type: 'string', maxLength: 50 },
          chassisNumber: { type: 'string', maxLength: 100 },
          engineNumber: { type: 'string', maxLength: 100 },
          purchaseDate: { type: 'string', format: 'date-time', nullable: true },
          notes: { type: 'string', maxLength: 1000 },
          documents: { type: 'object' }
        },
        additionalProperties: false
      },
      FleetVehicleStatus: {
        type: 'object',
        required: ['vehicleStatus'],
        properties: {
          vehicleStatus: { type: 'string', enum: ['Available', 'UnderMaintenance', 'Inactive'] },
          remarks: { type: 'string', maxLength: 500 }
        },
        additionalProperties: false
      },
      VehicleAllocation: {
        type: 'object',
        required: ['bookingId', 'vehicleId', 'plannedPickupDate', 'plannedDeliveryDate'],
        properties: {
          bookingId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
          vehicleId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
          plannedPickupDate: { type: 'string', format: 'date-time' },
          plannedDeliveryDate: { type: 'string', format: 'date-time' },
          remarks: { type: 'string', maxLength: 500 }
        },
        additionalProperties: false
      },
      AllocationStatusUpdate: {
        type: 'object',
        required: ['allocationStatus'],
        properties: {
          allocationStatus: { type: 'string', enum: ['Released', 'Cancelled'] },
          remarks: { type: 'string', maxLength: 500 }
        },
        additionalProperties: false
      }
    }
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API and MongoDB status',
        responses: {
          200: { description: 'API health and database connection state.' }
        }
      }
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign in and receive the role associated with the login',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } }
          }
        },
        responses: {
          200: { description: 'Authenticated session and role.' },
          400: { description: 'Invalid request.' },
          401: { description: 'Incorrect login ID or password.' },
          429: { description: 'Login temporarily locked after repeated failures.' }
        }
      }
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a customer account',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CustomerRegistration' } }
          }
        },
        responses: {
          201: { description: 'Customer account created and signed in.' },
          400: { description: 'Invalid request.' },
          409: { description: 'Mobile number is already registered.' }
        }
      }
    },
    '/api/v1/auth/session': {
      get: {
        tags: ['Authentication'],
        summary: 'Revalidate the current session',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Current role and user profile.' },
          401: { description: 'Session is invalid, expired or disabled.' }
        }
      }
    },
    '/api/v1/auth/change-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Change the signed-in user password',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } }
          }
        },
        responses: {
          200: { description: 'Password changed; a new access token is returned.' },
          400: { description: 'Current password is incorrect or the new password is invalid.' },
          401: { description: 'Session is invalid, expired or disabled.' }
        }
      }
    },
    '/api/v1/auth/accounts/{role}/{profileId}': {
      parameters: [
        {
          name: 'role',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: ['manager', 'driver', 'customer'] }
        },
        {
          name: 'profileId',
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }
        }
      ],
      get: {
        tags: ['Authentication'],
        summary: 'Get a staff-managed login',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Login ID and access status, if provisioned.' },
          403: { description: 'The current role cannot manage this login.' }
        }
      },
      put: {
        tags: ['Authentication'],
        summary: 'Create or update a staff-managed login',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AccountUpsert' } }
          }
        },
        responses: {
          200: { description: 'Login saved.' },
          400: { description: 'Invalid request or profile ID.' },
          403: { description: 'The current role cannot manage this login.' },
          404: { description: 'The referenced profile does not exist.' },
          409: { description: 'Login ID is already in use.' }
        }
      }
    },
    '/api/v1/customers/management/summary': {
      get: {
        tags: ['Customer Management'],
        summary: 'Get customer and KYC status counts',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Summary for admin and manager roles.' }, 403: { description: 'Staff role required.' } }
      }
    },
    '/api/v1/customers/management': {
      get: {
        tags: ['Customer Management'],
        summary: 'Search and paginate customers',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['Pending', 'Active', 'Suspended'] } },
          { name: 'kycStatus', in: 'query', schema: { type: 'string', enum: ['NotSubmitted', 'Pending', 'Verified', 'Rejected'] } }
        ],
        responses: { 200: { description: 'Customer page and pagination details.' } }
      }
    },
    '/api/v1/customers/management/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
      get: {
        tags: ['Customer Management'],
        summary: 'Get a customer profile',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Customer profile.' }, 404: { description: 'Customer not found.' } }
      },
      put: {
        tags: ['Customer Management'],
        summary: 'Update customer profile',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerProfileUpdate' } } }
        },
        responses: { 200: { description: 'Profile updated.' }, 409: { description: 'Duplicate customer identity field.' } }
      }
    },
    '/api/v1/customers/management/{id}/status': {
      patch: {
        tags: ['Customer Management'],
        summary: 'Update customer account status',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['Pending', 'Active', 'Suspended'] }, remarks: { type: 'string', maxLength: 250 } }, additionalProperties: false } } } },
        responses: { 200: { description: 'Status updated; suspended customer sessions are revoked.' } }
      }
    },
    '/api/v1/customers/management/{id}/kyc': {
      patch: {
        tags: ['Customer Management'],
        summary: 'Approve or reject a pending KYC submission',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/KycReview' } } } },
        responses: { 200: { description: 'KYC review saved.' }, 409: { description: 'Submission or uploaded documents are not ready for approval.' } }
      }
    },
    '/api/v1/customers/management/{id}/activities': {
      get: {
        tags: ['Customer Management'],
        summary: 'List customer activities and follow-ups',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }
        ],
        responses: { 200: { description: 'Activities ordered newest first.' } }
      },
      post: {
        tags: ['Customer Management'],
        summary: 'Record a customer activity or follow-up',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerActivity' } } } },
        responses: { 201: { description: 'Activity recorded.' } }
      }
    },
    '/api/v1/customers/management/{id}/activities/{activityId}/complete': {
      patch: {
        tags: ['Customer Management'],
        summary: 'Complete a customer follow-up',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'activityId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Follow-up marked complete.' } }
      }
    },
    '/api/v1/customers/management/{id}/kyc/documents': {
      get: {
        tags: ['Customer Management'],
        summary: 'List KYC document metadata without file contents',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Private document metadata.' } }
      }
    },
    '/api/v1/customers/management/{id}/kyc/documents/{documentId}/review': {
      patch: {
        tags: ['Customer Management'],
        summary: 'Review a customer KYC document',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'documentId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/KycReview' } } } },
        responses: { 200: { description: 'Document review saved.' } }
      }
    },
    '/api/v1/customers/management/{id}/kyc/documents/{documentId}/download': {
      get: {
        tags: ['Customer Management'],
        summary: 'Download an owned KYC document',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'documentId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Private document stream.' }, 404: { description: 'Document not found for customer.' } }
      }
    },
    '/api/v1/customers/portal/dashboard': {
      get: {
        tags: ['Customer Portal'],
        summary: 'Get profile completion and saved address count',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Customer dashboard summary.' } }
      }
    },
    '/api/v1/customers/portal/profile': {
      get: {
        tags: ['Customer Portal'],
        summary: 'Get the signed-in customer profile',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Customer profile.' } }
      },
      put: {
        tags: ['Customer Portal'],
        summary: 'Update the signed-in customer profile',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerPortalProfileUpdate' } } } },
        responses: { 200: { description: 'Profile updated; identity changes reset KYC verification.' } }
      }
    },
    '/api/v1/customers/portal/kyc/submit': {
      post: {
        tags: ['Customer Portal'],
        summary: 'Submit a complete profile for KYC review',
        description: 'KYC documents are optional. Any uploaded documents must be reviewed before approval.',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Submission queued for review.' }, 409: { description: 'Profile is incomplete or KYC is already pending/verified.' } }
      }
    },
    '/api/v1/customers/portal/kyc/documents': {
      get: {
        tags: ['Customer Portal'],
        summary: 'List the signed-in customer KYC document metadata',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Only the current customer’s documents are returned.' } }
      },
      post: {
        tags: ['Customer Portal'],
        summary: 'Upload a private KYC document',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['documentType', 'file'],
                properties: {
                  documentType: { type: 'string', enum: ['pan', 'gstin', 'address_proof'] },
                  file: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Private PDF, JPEG or PNG document stored (maximum 5 MB).' }, 415: { description: 'File signature is not supported.' } }
      }
    },
    '/api/v1/customers/portal/kyc/documents/{documentId}/download': {
      get: {
        tags: ['Customer Portal'],
        summary: 'Download one of the signed-in customer’s own documents',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'documentId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Private document stream.' }, 404: { description: 'Document not found.' } }
      }
    },
    '/api/v1/customers/portal/preferences': {
      get: {
        tags: ['Customer Portal'],
        summary: 'Get notification and booking preferences',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Current customer preferences.' } }
      },
      put: {
        tags: ['Customer Portal'],
        summary: 'Update notification and booking preferences',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { language: { type: 'string', enum: ['en', 'hi', 'mr', 'gu'] }, defaultVehicleType: { type: 'string' }, notifyBySms: { type: 'boolean' }, notifyByEmail: { type: 'boolean' } }, additionalProperties: false } } } },
        responses: { 200: { description: 'Preferences saved.' } }
      }
    },
    '/api/v1/customers/portal/addresses': {
      get: {
        tags: ['Customer Portal'],
        summary: 'List saved customer addresses',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Current customer saved addresses.' } }
      },
      post: {
        tags: ['Customer Portal'],
        summary: 'Save a customer address',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SavedAddress' } } } },
        responses: { 201: { description: 'Address saved; only one address is default.' }, 409: { description: 'Address limit reached.' } }
      }
    },
    '/api/v1/customers/portal/addresses/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
      put: {
        tags: ['Customer Portal'],
        summary: 'Update a saved customer address',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SavedAddress' } } } },
        responses: { 200: { description: 'Address updated.' }, 404: { description: 'Address not found.' } }
      },
      delete: {
        tags: ['Customer Portal'],
        summary: 'Delete a saved customer address',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Address deleted; a remaining address becomes default if necessary.' }, 404: { description: 'Address not found.' } }
      }
    },
    '/api/v1/customers/booking/vehicle': {
      post: {
        tags: ['Booking Management'],
        summary: 'Submit a vehicle booking request for the signed-in customer',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingRequest' } } }
        },
        responses: {
          201: { description: 'Booking created with a unique booking number and pending status.' },
          400: { description: 'Invalid booking details or schedule.' },
          403: { description: 'An active customer account is required.' }
        }
      }
    },
    '/api/v1/customers/booking/online': {
      post: {
        tags: ['Booking Management'],
        summary: 'Submit an online booking request for the signed-in customer',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingRequest' } } }
        },
        responses: {
          201: { description: 'Online booking created with pending status.' },
          400: { description: 'Invalid booking details or schedule.' }
        }
      }
    },
    '/api/v1/customers/booking': {
      get: {
        tags: ['Booking Management'],
        summary: 'List bookings (customers see only their own)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'under_review', 'quoted', 'confirmed', 'rejected', 'cancelled', 'expired'] } }
        ],
        responses: { 200: { description: 'Paginated booking list.' } }
      }
    },
    '/api/v1/customers/booking/calendar': {
      get: {
        tags: ['Booking Management'],
        summary: 'List bookings intersecting a pickup/delivery date range (admin and manager)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: { 200: { description: 'Calendar bookings sorted by pickup date.' }, 403: { description: 'Staff role required.' } }
      }
    },
    '/api/v1/customers/booking/{bookingId}': {
      parameters: [{ name: 'bookingId', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
      get: {
        tags: ['Booking Management'],
        summary: 'Get booking details (customers can access only their own)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Booking and status history.' }, 404: { description: 'Booking not found.' } }
      }
    },
    '/api/v1/customers/booking/{bookingId}/history': {
      get: {
        tags: ['Booking Management'],
        summary: 'Get booking status history',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'bookingId', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Chronological status changes for the booking.' }, 404: { description: 'Booking not found.' } }
      }
    },
    '/api/v1/customers/booking/{bookingId}/status': {
      patch: {
        tags: ['Booking Management'],
        summary: 'Advance booking status (staff) or cancel an unconfirmed own booking (customer)',
        description: 'Staff transitions: pending → under_review → quoted → confirmed. Rejection or cancellation is terminal; expiry is available from quoted. Customers may cancel only pending, under-review, or quoted bookings.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'bookingId', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingStatusUpdate' } } }
        },
        responses: {
          200: { description: 'Booking status updated and appended to status history.' },
          403: { description: 'Role or booking ownership does not permit the requested change.' },
          409: { description: 'Requested status transition is not allowed or status changed concurrently.' }
        }
      }
    },
    '/api/v1/fleet/vehicles': {
      get: {
        tags: ['Fleet Management'],
        summary: 'Search and paginate fleet vehicles (admin and manager)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'vehicleStatus', in: 'query', schema: { type: 'string', enum: ['Available', 'Allocated', 'OnTrip', 'UnderMaintenance', 'Inactive'] } }
        ],
        responses: { 200: { description: 'Paged fleet vehicle records.' }, 403: { description: 'Staff role required.' } }
      },
      post: {
        tags: ['Fleet Management'],
        summary: 'Register a fleet vehicle',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/FleetVehicle' } } }
        },
        responses: { 201: { description: 'Vehicle registered as Available.' }, 409: { description: 'Registration, chassis, or engine number is already in use.' } }
      }
    },
    '/api/v1/fleet/vehicles/dashboard': {
      get: {
        tags: ['Fleet Management'],
        summary: 'Get live fleet status and vehicle type totals',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Fleet totals and type breakdown.' } }
      }
    },
    '/api/v1/fleet/vehicles/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
      patch: {
        tags: ['Fleet Management'],
        summary: 'Update a vehicle record',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/FleetVehicleUpdate' } } }
        },
        responses: { 200: { description: 'Vehicle updated.' }, 404: { description: 'Vehicle not found.' }, 409: { description: 'Duplicate identity or vehicle is allocated.' } }
      },
      delete: {
        tags: ['Fleet Management'],
        summary: 'Soft-delete an inactive vehicle',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Vehicle marked deleted.' }, 409: { description: 'Allocated or in-trip vehicle cannot be deleted.' } }
      }
    },
    '/api/v1/fleet/vehicles/{id}/status': {
      patch: {
        tags: ['Fleet Management'],
        summary: 'Set a vehicle available, under maintenance, or inactive',
        description: 'Allocated and in-trip states are controlled by operations, not manual status edits.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/FleetVehicleStatus' } } }
        },
        responses: { 200: { description: 'Vehicle status updated and audited.' }, 409: { description: 'Vehicle has an active allocation.' } }
      }
    },
    '/api/v1/fleet/vehicles/allocations/options/bookings': {
      get: {
        tags: ['Fleet Management'],
        summary: 'List confirmed bookings without active vehicle allocations',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Bookings eligible for allocation.' } }
      }
    },
    '/api/v1/fleet/vehicles/allocations/options/vehicles': {
      get: {
        tags: ['Fleet Management'],
        summary: 'List available vehicles that meet a booking’s type and capacity requirements',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'bookingId', in: 'query', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Eligible available vehicles.' }, 409: { description: 'Booking is not confirmed.' } }
      }
    },
    '/api/v1/fleet/vehicles/allocations': {
      get: {
        tags: ['Fleet Management'],
        summary: 'List vehicle allocations with booking and vehicle details',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'allocationStatus', in: 'query', schema: { type: 'string', enum: ['Allocated', 'Released', 'Cancelled'] } }
        ],
        responses: { 200: { description: 'Paginated allocation history.' } }
      },
      post: {
        tags: ['Fleet Management'],
        summary: 'Allocate an eligible vehicle to a confirmed booking',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/VehicleAllocation' } } }
        },
        responses: { 201: { description: 'Vehicle reserved and status changed to Allocated.' }, 409: { description: 'Vehicle is unavailable or booking is already allocated.' } }
      }
    },
    '/api/v1/fleet/vehicles/allocations/{id}/status': {
      patch: {
        tags: ['Fleet Management'],
        summary: 'Release or cancel an active vehicle allocation',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AllocationStatusUpdate' } } }
        },
        responses: { 200: { description: 'Allocation closed and vehicle returned to Available.' }, 404: { description: 'Active allocation not found.' } }
      }
    },
    '/api/v1/drivers': {
      get: {
        tags: ['Driver Management'],
        summary: 'Search and paginate driver profiles (admin and manager)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'driverStatus', in: 'query', schema: { type: 'string', enum: ['Available', 'OnTrip', 'OnLeave', 'Inactive', 'Suspended'] } }
        ],
        responses: { 200: { description: 'Paginated driver directory.' }, 403: { description: 'Staff role required.' } }
      },
      post: {
        tags: ['Driver Management'],
        summary: 'Register a driver and assign a sequential driver code',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Driver registered.' }, 409: { description: 'Mobile number is already registered.' } }
      }
    },
    '/api/v1/drivers/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
      get: {
        tags: ['Driver Management'],
        summary: 'Read a driver profile (admin and manager)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Driver profile.' }, 404: { description: 'Driver not found.' } }
      },
      patch: {
        tags: ['Driver Management'],
        summary: 'Update driver profile details',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Driver profile updated.' }, 409: { description: 'Driver is on an active trip or phone is duplicated.' } }
      },
      delete: {
        tags: ['Driver Management'],
        summary: 'Soft-delete a driver and remove the associated login',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Driver removed from the active directory.' } }
      }
    },
    '/api/v1/drivers/{id}/status': {
      patch: {
        tags: ['Driver Management'],
        summary: 'Change driver availability and audit the status change',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Driver status updated; inactive or suspended logins are disabled.' }, 409: { description: 'Trip operations control the status of an assigned driver.' } }
      }
    },
    '/api/v1/drivers/licenses': {
      get: {
        tags: ['Driver Management'],
        summary: 'List licence records (drivers can only read their own)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Paginated licence records with expiry status.' } }
      },
      post: {
        tags: ['Driver Management'],
        summary: 'Add a licence record for an active driver',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Licence record created with derived expiry status.' }, 409: { description: 'Licence number is already in use.' } }
      }
    },
    '/api/v1/drivers/licenses/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
      patch: {
        tags: ['Driver Management'],
        summary: 'Update a licence record and recompute its expiry status',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Licence record updated.' }, 409: { description: 'Licence number is duplicated.' } }
      },
      delete: {
        tags: ['Driver Management'],
        summary: 'Archive a licence record',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Licence record archived.' } }
      }
    },
    '/api/v1/drivers/licenses/{id}/status': {
      patch: {
        tags: ['Driver Management'],
        summary: 'Place a licence under review or clear its review',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Licence review status updated.' }, 409: { description: 'An expired or expiring licence cannot be marked Valid.' } }
      }
    },
    '/api/v1/drivers/documents': {
      get: {
        tags: ['Driver Management'],
        summary: 'List driver compliance document metadata (drivers can only read their own records)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Paginated role-scoped driver document metadata.' } }
      },
      post: {
        tags: ['Driver Management'],
        summary: 'Add a driver compliance document',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Driver document created.' } }
      }
    },
    '/api/v1/drivers/documents/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
      patch: {
        tags: ['Driver Management'],
        summary: 'Update a driver document',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Driver document updated.' } }
      },
      delete: {
        tags: ['Driver Management'],
        summary: 'Archive a driver document',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Driver document archived.' } }
      }
    },
    '/api/v1/drivers/attendance': {
      get: {
        tags: ['Driver Management'],
        summary: 'List attendance records (drivers can only read their own)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Paginated attendance records.' } }
      },
      post: {
        tags: ['Driver Management'],
        summary: 'Record attendance once per driver and UTC calendar date',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Attendance recorded.' }, 409: { description: 'A record already exists for this driver and date.' } }
      }
    },
    '/api/v1/drivers/attendance/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
      patch: {
        tags: ['Driver Management'],
        summary: 'Correct attendance data and audit status changes',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Attendance updated.' }, 409: { description: 'Driver already has attendance on that date.' } }
      },
      delete: {
        tags: ['Driver Management'],
        summary: 'Archive an attendance record',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Attendance archived.' } }
      }
    },
    '/api/v1/drivers/attendance/{id}/status': {
      patch: {
        tags: ['Driver Management'],
        summary: 'Change and audit attendance status',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Attendance status updated.' } }
      }
    },
    '/api/v1/drivers/payments': {
      get: {
        tags: ['Driver Management'],
        summary: 'List salary records (drivers can only read their own)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Paginated salary records and net amounts.' } }
      },
      post: {
        tags: ['Driver Management'],
        summary: 'Create a Draft salary record for an active driver',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Draft salary record created.' }, 409: { description: 'Pay period overlaps another salary record.' } }
      }
    },
    '/api/v1/drivers/payments/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
      patch: {
        tags: ['Driver Management'],
        summary: 'Edit a Draft salary record',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Salary record updated.' }, 409: { description: 'Only Draft records may be edited or pay periods may overlap.' } }
      },
      delete: {
        tags: ['Driver Management'],
        summary: 'Archive a Draft salary record',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Draft salary record archived.' }, 409: { description: 'Only Draft records may be archived.' } }
      }
    },
    '/api/v1/drivers/payments/{id}/status': {
      patch: {
        tags: ['Driver Management'],
        summary: 'Approve, hold, or mark a salary record paid',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Salary status transition audited.' }, 409: { description: 'Salary status transition is not allowed.' } }
      }
    },
    '/api/v1/drivers/performance': {
      get: {
        tags: ['Driver Management'],
        summary: 'Get date-filtered attendance performance metrics (admin and manager)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Attendance rates and trip status totals; GPS-based metrics are not included.' } }
      }
    },
    '/api/v1/trips': {
      get: {
        tags: ['Trip Management'],
        summary: 'List scheduled and historical trips (drivers see only their own assignments)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['Scheduled', 'Assigned', 'InProgress', 'Delayed', 'Completed', 'Cancelled'] } }
        ],
        responses: { 200: { description: 'Paginated populated trip records.' } }
      },
      post: {
        tags: ['Trip Management'],
        summary: 'Schedule a trip from an active vehicle allocation',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Trip scheduled with a generated trip number.' }, 409: { description: 'Allocation is inactive or already scheduled.' } }
      }
    },
    '/api/v1/trips/options/allocations': {
      get: {
        tags: ['Trip Management'],
        summary: 'List active allocations for confirmed bookings without a trip',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Trip-scheduling allocation options.' } }
      }
    },
    '/api/v1/trips/options/drivers': {
      get: {
        tags: ['Trip Management'],
        summary: 'List available drivers with a valid HMV or Transport licence for the trip date',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'tripId', in: 'query', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Eligible available drivers.' }, 409: { description: 'Trip is not awaiting assignment.' } }
      }
    },
    '/api/v1/trips/assignments': {
      get: {
        tags: ['Trip Management'],
        summary: 'List scheduled or assigned trips; drivers see only their own',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Paginated trip assignment records.' } }
      }
    },
    '/api/v1/trips/active': {
      get: {
        tags: ['Trip Management'],
        summary: 'List in-progress and delayed trips',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Active trip monitoring records.' } }
      }
    },
    '/api/v1/trips/history': {
      get: {
        tags: ['Trip Management'],
        summary: 'List completed and cancelled trips',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Paginated trip history.' } }
      }
    },
    '/api/v1/trips/metrics': {
      get: {
        tags: ['Trip Management'],
        summary: 'Summarize trip totals by operational status',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'startDate', schema: { type: 'string', format: 'date' }, description: 'Optional inclusive start date for scheduled pickup.' },
          { in: 'query', name: 'endDate', schema: { type: 'string', format: 'date' }, description: 'Optional inclusive end date for scheduled pickup.' }
        ],
        responses: { 200: { description: 'Trip status totals for the selected pickup-date range.' } }
      }
    },
    '/api/v1/trips/{id}/assignment': {
      patch: {
        tags: ['Trip Management'],
        summary: 'Assign an available, licence-qualified driver to a scheduled trip',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Driver assigned; driver availability is reserved.' }, 409: { description: 'Trip or driver is no longer available.' } }
      }
    },
    '/api/v1/trips/{id}/status': {
      patch: {
        tags: ['Trip Management'],
        summary: 'Start, delay, resume, complete, or pre-departure cancel a trip',
        description: 'Drivers may update only their own assigned trips. Starting and completing synchronizes the vehicle, driver, and allocation statuses.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Trip transition recorded.' }, 409: { description: 'Trip transition or linked resource status conflict.' } }
      }
    },
    '/api/v1/trips/plans': {
      get: {
        tags: ['Trip Management'],
        summary: 'List trip route plans; drivers see only plans for their own trips',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Paginated trip route plans.' } }
      },
      post: {
        tags: ['Trip Management'],
        summary: 'Create a route plan for a scheduled or assigned trip',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Trip route plan created.' }, 409: { description: 'A plan already exists or trip has started.' } }
      }
    },
    '/api/v1/trips/plans/{id}': {
      patch: {
        tags: ['Trip Management'],
        summary: 'Update a route plan before trip departure',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Route plan updated.' }, 409: { description: 'Trip has already started.' } }
      },
      delete: {
        tags: ['Trip Management'],
        summary: 'Delete a route plan before trip departure',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: { 200: { description: 'Route plan deleted.' }, 409: { description: 'Trip has already started.' } }
      }
    }
  }
};
