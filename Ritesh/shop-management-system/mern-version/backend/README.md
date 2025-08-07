# Shop Management System - Backend (MERN Stack)

A comprehensive backend API for managing shop customers and their purchase records with real-time updates using Socket.IO.

## 🚀 Features

Based on the user stories from your requirements:

### Core Functionality
- **Dashboard Overview**: Get instant overview of store's financial status
- **Customer Search**: Quickly retrieve customer transaction and pending account history  
- **Purchase Management**: Review detailed pending amounts for each customer
- **Staff Access Control**: Delegate customer and transaction entry with clear, limited access
- **Daily Summaries**: View daily summaries of revenue and outstanding balances
- **Data Security**: All customer and payment data is stored locally and encrypted
- **Overdue Tracking**: See customers with overdue payments highlighted automatically

### Technical Features
- JWT-based authentication
- Real-time updates with Socket.IO
- MongoDB data storage
- RESTful API design
- Data validation and error handling
- Role-based access control

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

## 🛠️ Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   - Copy `.env.example` to `.env` (if exists) or create a new `.env` file
   - Update the following variables:

   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/shop_management
   # For MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/shop_management

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_secure
   JWT_EXPIRES_IN=7d

   # CORS Configuration
   CLIENT_URL=http://localhost:3000
   ```

4. **Database Setup**
   
   For local MongoDB:
   ```bash
   # Make sure MongoDB is running
   mongod
   ```

   For MongoDB Atlas:
   - Create a cluster at https://cloud.mongodb.com
   - Get connection string and update MONGODB_URI

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start at `http://localhost:5000`

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new shop owner
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/password` - Update password
- `POST /api/auth/logout` - Logout user

### Customer Endpoints
- `GET /api/customers` - Get all customers (with search/filter)
- `POST /api/customers` - Create new customer
- `GET /api/customers/:id` - Get single customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/:id/purchases` - Get customer purchase history
- `GET /api/customers/overdue` - Get customers with overdue payments

### Purchase Endpoints
- `GET /api/purchases` - Get all purchases (with filters)
- `POST /api/purchases` - Create new purchase
- `GET /api/purchases/:id` - Get single purchase
- `PUT /api/purchases/:id` - Update purchase
- `DELETE /api/purchases/:id` - Delete purchase
- `PUT /api/purchases/:id/payment` - Update payment status
- `GET /api/purchases/pending` - Get pending payments
- `GET /api/purchases/overdue` - Get overdue payments
- `GET /api/purchases/daily-summary` - Get daily sales summary

### Dashboard Endpoints
- `GET /api/dashboard/overview` - Dashboard statistics
- `GET /api/dashboard/revenue-trends` - Revenue trends (30 days)
- `GET /api/dashboard/top-customers` - Top customers by purchase value
- `GET /api/dashboard/purchase-status` - Purchase status distribution
- `GET /api/dashboard/monthly-comparison` - Current vs previous month
- `GET /api/dashboard/recent-activities` - Recent activities

### Health Check
- `GET /api/health` - API health status

## 🔌 Real-time Features

The application uses Socket.IO for real-time updates:

### Events Emitted:
- `customer_created` - New customer added
- `customer_updated` - Customer information updated
- `customer_deleted` - Customer deleted
- `customer_deactivated` - Customer deactivated
- `purchase_created` - New purchase recorded
- `purchase_updated` - Purchase information updated
- `purchase_deleted` - Purchase deleted
- `payment_updated` - Payment status changed

### Client Connection:
```javascript
const socket = io('http://localhost:5000');
socket.emit('join-shop', userId); // Join room for real-time updates
```

## 📊 Data Models

### User Schema
- Personal details (name, email, password)
- Shop information (shopName, shopAddress)
- Role-based access (owner, manager, staff)

### Customer Schema
- Contact details (name, email, phone, address)
- Purchase statistics (totalPurchases, totalSpent)
- Status tracking (isActive, lastPurchaseDate)

### Purchase Schema
- Customer reference
- Items array (productName, quantity, unitPrice)
- Payment tracking (totalAmount, paidAmount, remainingAmount)
- Status management (pending, completed, overdue)
- Due date tracking

## 🔒 Security Features

- Password hashing with bcryptjs
- JWT token authentication
- Request validation
- CORS protection
- Role-based access control
- Data ownership verification

## 🧪 Testing the API

You can test the API using tools like:
- Postman
- Thunder Client (VS Code extension)
- cURL commands

### Sample API Calls:

1. **Register a new user:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "shopName": "John'\''s Electronics Store",
    "shopAddress": "123 Main St, City",
    "phone": "+1234567890"
  }'
```

2. **Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

3. **Create a customer (with auth token):**
```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "+1234567891",
    "address": {
      "street": "456 Oak Ave",
      "city": "Springfield",
      "state": "IL",
      "zipCode": "62701"
    }
  }'
```

## 🌟 Key Features Implementation

### Real-time Dashboard Updates
All CRUD operations emit Socket.IO events for immediate UI updates without page refresh.

### Advanced Search & Filtering
- Customer search by name, email, or phone
- Purchase filtering by date range, payment status, customer
- Pagination support for large datasets

### Payment Tracking
- Automatic overdue payment detection
- Payment status lifecycle management
- Outstanding balance calculations

### Business Analytics
- Revenue trends and comparisons
- Customer value analysis
- Payment collection rates

## 🚨 Error Handling

The API includes comprehensive error handling:
- Validation errors
- Authentication errors
- Database connection errors
- Not found errors
- Server errors

All errors return consistent JSON responses:
```json
{
  "status": "error",
  "message": "Error description",
  "statusCode": 400
}
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/shop_management |
| JWT_SECRET | JWT signing secret | required |
| JWT_EXPIRES_IN | JWT expiration time | 7d |
| CLIENT_URL | Frontend URL for CORS | http://localhost:3000 |

## 🔧 Troubleshooting

### Common Issues:

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in .env
   - Verify network connectivity for Atlas

2. **JWT Token Errors**
   - Ensure JWT_SECRET is set
   - Check token expiration
   - Verify Authorization header format

3. **Socket.IO Connection Issues**
   - Check CORS configuration
   - Verify client connection URL
   - Ensure server is running

## 🚀 Deployment

### Using PM2 (Recommended for production):
```bash
npm install -g pm2
pm2 start server.js --name "shop-management-api"
```

### Using Docker:
```bash
# Build image
docker build -t shop-management-api .

# Run container
docker run -p 5000:5000 --env-file .env shop-management-api
```

## 📞 Support

For issues and questions:
1. Check this README
2. Review API documentation
3. Check console logs for error details
4. Verify environment variables

## 🎯 Next Steps

After setting up the backend:
1. Test all endpoints with Postman
2. Set up the React frontend
3. Configure Socket.IO client
4. Test real-time features
5. Deploy to production

---

*This backend implements all the user stories from your requirements including dashboard overview, customer search, purchase tracking, staff access control, daily summaries, data security, and overdue payment tracking.*
