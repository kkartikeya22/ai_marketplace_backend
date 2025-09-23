const express = require('express');
const { dbConnect } = require('./utiles/db');
const cors = require('cors');
const http = require('http');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const socket = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());

// Socket.IO
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://critical-hitters-ai-seller-dashboard.netlify.app'
];

app.use(cors({
    origin: function(origin, callback){
        // allow requests with no origin like Postman
        if(!origin) return callback(null, true);
        if(allowedOrigins.indexOf(origin) === -1){
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));


// Socket.IO
const io = socket(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Socket handling
var allCustomer = [];
var allSeller = [];
let admin = {};

const addUser = (customerId, socketId, userInfo) => {
    if (!allCustomer.some(u => u.customerId === customerId)) {
        allCustomer.push({ customerId, socketId, userInfo });
    }
};

const addSeller = (sellerId, socketId, userInfo) => {
    if (!allSeller.some(u => u.sellerId === sellerId)) {
        allSeller.push({ sellerId, socketId, userInfo });
    }
};

const findCustomer = (customerId) => allCustomer.find(c => c.customerId === customerId);
const findSeller = (sellerId) => allSeller.find(c => c.sellerId === sellerId);
const remove = (socketId) => {
    allCustomer = allCustomer.filter(c => c.socketId !== socketId);
    allSeller = allSeller.filter(c => c.socketId !== socketId);
};
const removeAdmin = (socketId) => {
    if (admin.socketId === socketId) admin = {};
};

io.on('connection', (soc) => {
    console.log('socket server is connected...');

    soc.on('add_user', (customerId, userInfo) => {
        addUser(customerId, soc.id, userInfo);
        io.emit('activeSeller', allSeller);
        io.emit('activeCustomer', allCustomer);
    });

    soc.on('add_seller', (sellerId, userInfo) => {
        addSeller(sellerId, soc.id, userInfo);
        io.emit('activeSeller', allSeller);
        io.emit('activeCustomer', allCustomer);
        io.emit('activeAdmin', { status: true });
    });

    soc.on('add_admin', (adminInfo) => {
        delete adminInfo.email;
        admin = adminInfo;
        admin.socketId = soc.id;
        io.emit('activeSeller', allSeller);
        io.emit('activeAdmin', { status: true });
    });

    soc.on('send_seller_message', (msg) => {
        const customer = findCustomer(msg.receverId);
        if (customer) soc.to(customer.socketId).emit('seller_message', msg);
    });

    soc.on('send_customer_message', (msg) => {
        const seller = findSeller(msg.receverId);
        if (seller) soc.to(seller.socketId).emit('customer_message', msg);
    });

    soc.on('send_message_admin_to_seller', (msg) => {
        const seller = findSeller(msg.receverId);
        if (seller) soc.to(seller.socketId).emit('receved_admin_message', msg);
    });

    soc.on('send_message_seller_to_admin', (msg) => {
        if (admin.socketId) soc.to(admin.socketId).emit('receved_seller_message', msg);
    });

    soc.on('disconnect', () => {
        console.log('user disconnected');
        remove(soc.id);
        removeAdmin(soc.id);
        io.emit('activeAdmin', { status: false });
        io.emit('activeSeller', allSeller);
        io.emit('activeCustomer', allCustomer);
    });
});

// Routes
app.use('/api', require('./routes/chatRoutes'));
app.use('/api', require('./routes/paymentRoutes'));
app.use('/api', require('./routes/bannerRoutes'));
app.use('/api', require('./routes/dashboard/dashboardIndexRoutes'));
app.use('/api/home', require('./routes/home/homeRoutes'));
app.use('/api', require('./routes/order/orderRoutes'));
app.use('/api', require('./routes/home/cardRoutes'));
app.use('/api', require('./routes/authRoutes'));
app.use('/api', require('./routes/home/customerAuthRoutes'));
app.use('/api', require('./routes/dashboard/sellerRoutes'));
app.use('/api', require('./routes/dashboard/categoryRoutes'));
app.use('/api', require('./routes/dashboard/productRoutes'));

app.get('/', (req, res) => res.send('Hello World!'));

// Connect DB and start server
const port = process.env.PORT || 5000;
dbConnect();
server.listen(port, () => console.log(`Server is running on port ${port}!`));
