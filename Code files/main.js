const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Error logging setup
const userDataPath = app.getPath('userData');
const errorLogPath = path.join(userDataPath, 'error.log');

function logError(error, context = 'General') {
  const timestamp = new Date().toISOString();
  const errorMessage = `${timestamp} [${context}] ${error.stack || error}\n`;

  fs.appendFile(errorLogPath, errorMessage, (err) => {
    if (err) console.error('Failed to write to error log:', err);
  });
}

process.on('uncaughtException', (error) => {
  logError(error, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason) => {
  logError(reason, 'Unhandled Rejection');
});

let mainWindow;
let db;
const isDev = !app.isPackaged;

// Database path
const dbPath = path.join(userDataPath, 'sales_management.db');

console.log('Database path:', dbPath);

// Initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        reject(err);
        return;
      }

      console.log('Connected to SQLite database');
      createTables().then(() => {
        seedData();
        resolve();
      }).catch(reject);
    });
  });
}

// Seed sample data (only if database is empty)
function seedData() {
  db.get('SELECT COUNT(*) as count FROM districts', (err, row) => {
    if (err) {
      console.error('Error checking seed status:', err);
      return;
    }

    if (row.count === 0) {
      db.serialize(() => {
        // Districts (5 sample districts)
        const districts = [
          { code: 'DT001', name: 'Central District' },
          { code: 'DT002', name: 'North District' },
          { code: 'DT003', name: 'South District' },
          { code: 'DT004', name: 'East District' },
          { code: 'DT005', name: 'West District' }
        ];

        districts.forEach(district => {
          db.run(
            'INSERT OR IGNORE INTO districts (code, name) VALUES (?, ?)',
            [district.code, district.name]
          );
        });

        // Towns (8 sample towns)
        const towns = [
          { code: 'TW001', name: 'Downtown', district_id: 1 },
          { code: 'TW002', name: 'Midtown', district_id: 1 },
          { code: 'TW003', name: 'Uptown', district_id: 2 },
          { code: 'TW004', name: 'Riverside', district_id: 3 },
          { code: 'TW005', name: 'Harbor View', district_id: 2 },
          { code: 'TW006', name: 'Green Valley', district_id: 4 },
          { code: 'TW007', name: 'Lakeside', district_id: 5 },
          { code: 'TW008', name: 'Industrial Area', district_id: 1 }
        ];

        towns.forEach(town => {
          db.run(
            'INSERT OR IGNORE INTO towns (code, name, district_id) VALUES (?, ?, ?)',
            [town.code, town.name, town.district_id]
          );
        });

        // Routes (8 sample routes)
        const routes = [
          { code: 'RT001', name: 'Route A - Main Street', town_id: 1 },
          { code: 'RT002', name: 'Route B - Market Road', town_id: 2 },
          { code: 'RT003', name: 'Route C - Business Park', town_id: 3 },
          { code: 'RT004', name: 'Route D - Riverside Drive', town_id: 4 },
          { code: 'RT005', name: 'Route E - Harbor Lane', town_id: 5 },
          { code: 'RT006', name: 'Route F - Green Fields', town_id: 6 },
          { code: 'RT007', name: 'Route G - Lake Boulevard', town_id: 7 },
          { code: 'RT008', name: 'Route H - Industrial Road', town_id: 8 }
        ];

        routes.forEach(route => {
          db.run(
            'INSERT OR IGNORE INTO routes (code, name, town_id) VALUES (?, ?, ?)',
            [route.code, route.name, route.town_id]
          );
        });

        // Products (15 sample products)
        const products = [
          { code: 'PRD001', name: 'Rice 1kg', unit_price: 120, stock_quantity: 500, min_stock_level: 100, unit: 'kg', category: 'food' },
          { code: 'PRD002', name: 'Wheat Flour 1kg', unit_price: 80, stock_quantity: 300, min_stock_level: 50, unit: 'kg', category: 'food' },
          { code: 'PRD003', name: 'Sugar 1kg', unit_price: 90, stock_quantity: 400, min_stock_level: 80, unit: 'kg', category: 'food' },
          { code: 'PRD004', name: 'Salt 1kg', unit_price: 25, stock_quantity: 600, min_stock_level: 100, unit: 'kg', category: 'food' },
          { code: 'PRD005', name: 'Tea Leaves 250g', unit_price: 180, stock_quantity: 200, min_stock_level: 50, unit: 'g', category: 'food' },
          { code: 'PRD006', name: 'Coffee Powder 250g', unit_price: 250, stock_quantity: 150, min_stock_level: 40, unit: 'g', category: 'food' },
          { code: 'PRD007', name: 'Cooking Oil 1L', unit_price: 180, stock_quantity: 250, min_stock_level: 60, unit: 'L', category: 'food' },
          { code: 'PRD008', name: 'Biscuits Pack', unit_price: 60, stock_quantity: 400, min_stock_level: 100, unit: 'packs', category: 'food' },
          { code: 'PRD009', name: 'Soap Bar', unit_price: 45, stock_quantity: 500, min_stock_level: 100, unit: 'bars', category: 'cleaning' },
          { code: 'PRD010', name: 'Shampoo 200ml', unit_price: 150, stock_quantity: 180, min_stock_level: 50, unit: 'ml', category: 'cleaning' },
          { code: 'PRD011', name: 'Toothpaste Tube', unit_price: 85, stock_quantity: 300, min_stock_level: 80, unit: 'tubes', category: 'cleaning' },
          { code: 'PRD012', name: 'Detergent Powder 1kg', unit_price: 120, stock_quantity: 200, min_stock_level: 50, unit: 'kg', category: 'cleaning' },
          { code: 'PRD013', name: 'Smartphone Model X', unit_price: 15000, stock_quantity: 50, min_stock_level: 10, unit: 'units', category: 'electronics' },
          { code: 'PRD014', name: 'Bluetooth Speaker', unit_price: 2500, stock_quantity: 75, min_stock_level: 20, unit: 'units', category: 'electronics' },
          { code: 'PRD015', name: 'USB Cable 1m', unit_price: 150, stock_quantity: 200, min_stock_level: 50, unit: 'units', category: 'electronics' }
        ];

        products.forEach(product => {
          db.run(
            'INSERT OR IGNORE INTO products (code, name, unit_price, stock_quantity, min_stock_level, unit, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [product.code, product.name, product.unit_price, product.stock_quantity, product.min_stock_level, product.unit, product.category]
          );
        });

        // Salespersons (8 sample salespersons)
        const salespersons = [
          { code: 'SP001', name: 'John Smith', contact_number: '9876543210', vehicle_number: 'AB-1234-CD', target_amount: 50000 },
          { code: 'SP002', name: 'Sarah Johnson', contact_number: '9876543211', vehicle_number: 'EF-5678-GH', target_amount: 45000 },
          { code: 'SP003', name: 'Michael Brown', contact_number: '9876543212', vehicle_number: 'IJ-9012-KL', target_amount: 55000 },
          { code: 'SP004', name: 'Emily Davis', contact_number: '9876543213', vehicle_number: 'MN-3456-OP', target_amount: 40000 },
          { code: 'SP005', name: 'David Wilson', contact_number: '9876543214', vehicle_number: 'QR-7890-ST', target_amount: 60000 },
          { code: 'SP006', name: 'Lisa Anderson', contact_number: '9876543215', vehicle_number: 'UV-1234-WX', target_amount: 48000 },
          { code: 'SP007', name: 'Robert Taylor', contact_number: '9876543216', vehicle_number: 'YZ-5678-AB', target_amount: 52000 },
          { code: 'SP008', name: 'Jennifer Lee', contact_number: '9876543217', vehicle_number: 'CD-9012-EF', target_amount: 47000 }
        ];

        salespersons.forEach(sp => {
          db.run(
            'INSERT OR IGNORE INTO salespersons (code, name, contact_number, vehicle_number, target_amount) VALUES (?, ?, ?, ?, ?)',
            [sp.code, sp.name, sp.contact_number, sp.vehicle_number, sp.target_amount]
          );
        });

        // Shops (15 sample shops)
        const shops = [
          { code: 'SH001', name: 'Fresh Mart', owner_name: 'Alice Cooper', contact_number: '9123456789', district_id: 1, town_id: 1, route_id: 1, credit_limit: 20000, current_balance: -5000 },
          { code: 'SH002', name: 'Daily Needs Store', owner_name: 'Bob Davis', contact_number: '9123456790', district_id: 1, town_id: 2, route_id: 2, credit_limit: 15000, current_balance: -3000 },
          { code: 'SH003', name: 'Super Market', owner_name: 'Carol Evans', contact_number: '9123456791', district_id: 2, town_id: 3, route_id: 3, credit_limit: 30000, current_balance: -8000 },
          { code: 'SH004', name: 'Quick Stop', owner_name: 'Daniel Fox', contact_number: '9123456792', district_id: 2, town_id: 5, route_id: 5, credit_limit: 10000, current_balance: -1500 },
          { code: 'SH005', name: 'Value Shop', owner_name: 'Eva Green', contact_number: '9123456793', district_id: 3, town_id: 4, route_id: 4, credit_limit: 25000, current_balance: -12000 },
          { code: 'SH006', name: 'Easy Shop', owner_name: 'Frank Harris', contact_number: '9123456794', district_id: 4, town_id: 6, route_id: 6, credit_limit: 18000, current_balance: -4000 },
          { code: 'SH007', name: 'Prime Store', owner_name: 'Grace White', contact_number: '9123456795', district_id: 5, town_id: 7, route_id: 7, credit_limit: 35000, current_balance: -20000 },
          { code: 'SH008', name: 'Mini Mart', owner_name: 'Henry Black', contact_number: '9123456796', district_id: 1, town_id: 8, route_id: 8, credit_limit: 12000, current_balance: -6000 },
          { code: 'SH009', name: 'City Store', owner_name: 'Ivy King', contact_number: '9123456797', district_id: 1, town_id: 1, route_id: 1, credit_limit: 22000, current_balance: 0 },
          { code: 'SH010', name: 'Town Corner', owner_name: 'Jack Queen', contact_number: '9123456798', district_id: 1, town_id: 2, route_id: 2, credit_limit: 16000, current_balance: 0 },
          { code: 'SH011', name: 'Green Shop', owner_name: 'Kate Lewis', contact_number: '9123456799', district_id: 2, town_id: 3, route_id: 3, credit_limit: 28000, current_balance: 0 },
          { code: 'SH012', name: 'Lake View Store', owner_name: 'Leo Miller', contact_number: '9123456800', district_id: 3, town_id: 4, route_id: 4, credit_limit: 14000, current_balance: 0 },
          { code: 'SH013', name: 'Harbor Shop', owner_name: 'Mia Nelson', contact_number: '9123456801', district_id: 2, town_id: 5, route_id: 5, credit_limit: 19000, current_balance: -2000 },
          { code: 'SH014', name: 'Valley Mart', owner_name: 'Noah Clark', contact_number: '9123456802', district_id: 4, town_id: 6, route_id: 6, credit_limit: 17000, current_balance: 0 },
          { code: 'SH015', name: 'Tech Gadgets', owner_name: 'Olivia Walker', contact_number: '9123456803', district_id: 5, town_id: 7, route_id: 7, credit_limit: 50000, current_balance: -15000 }
        ];

        shops.forEach(shop => {
          db.run(
            'INSERT OR IGNORE INTO shops (code, name, owner_name, contact_number, district_id, town_id, route_id, credit_limit, current_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [shop.code, shop.name, shop.owner_name, shop.contact_number, shop.district_id, shop.town_id, shop.route_id, shop.credit_limit, shop.current_balance]
          );
        });

        // Sample salesperson stock assignments
        const salespersonStock = [
          { salesperson_id: 1, product_id: 1, quantity: 100 },
          { salesperson_id: 1, product_id: 2, quantity: 80 },
          { salesperson_id: 1, product_id: 3, quantity: 60 },
          { salesperson_id: 1, product_id: 9, quantity: 50 },
          { salesperson_id: 1, product_id: 13, quantity: 10 },
          { salesperson_id: 2, product_id: 4, quantity: 120 },
          { salesperson_id: 2, product_id: 5, quantity: 40 },
          { salesperson_id: 2, product_id: 6, quantity: 30 },
          { salesperson_id: 2, product_id: 10, quantity: 40 },
          { salesperson_id: 3, product_id: 1, quantity: 90 },
          { salesperson_id: 3, product_id: 7, quantity: 50 },
          { salesperson_id: 3, product_id: 8, quantity: 60 },
          { salesperson_id: 3, product_id: 14, quantity: 15 },
          { salesperson_id: 4, product_id: 2, quantity: 70 },
          { salesperson_id: 4, product_id: 3, quantity: 50 },
          { salesperson_id: 4, product_id: 9, quantity: 60 },
          { salesperson_id: 4, product_id: 11, quantity: 80 },
          { salesperson_id: 5, product_id: 5, quantity: 35 },
          { salesperson_id: 5, product_id: 6, quantity: 25 },
          { salesperson_id: 5, product_id: 12, quantity: 30 },
          { salesperson_id: 5, product_id: 15, quantity: 40 },
          { salesperson_id: 6, product_id: 1, quantity: 85 },
          { salesperson_id: 6, product_id: 4, quantity: 95 },
          { salesperson_id: 6, product_id: 7, quantity: 45 },
          { salesperson_id: 7, product_id: 8, quantity: 55 },
          { salesperson_id: 7, product_id: 13, quantity: 8 },
          { salesperson_id: 7, product_id: 14, quantity: 12 },
          { salesperson_id: 8, product_id: 9, quantity: 70 },
          { salesperson_id: 8, product_id: 10, quantity: 35 },
          { salesperson_id: 8, product_id: 12, quantity: 25 }
        ];

salespersonStock.forEach(stock => {
          db.run(
            'INSERT OR IGNORE INTO salesperson_stock (salesperson_id, product_id, quantity) VALUES (?, ?, ?)',
            [stock.salesperson_id, stock.product_id, stock.quantity]
          );
        });

        // Sample sales and sale_items
        const sales = [
          { shop_id: 1, salesperson_id: 1, route_id: 1, total_amount: 600, paid_amount: 600, balance_amount: 0, payment_type: 'cash', daysAgo: 5 },
          { shop_id: 1, salesperson_id: 1, route_id: 1, total_amount: 800, paid_amount: 280, balance_amount: 520, payment_type: 'credit', daysAgo: 3 },
          { shop_id: 2, salesperson_id: 2, route_id: 2, total_amount: 360, paid_amount: 360, balance_amount: 0, payment_type: 'cash', daysAgo: 4 },
          { shop_id: 2, salesperson_id: 2, route_id: 2, total_amount: 500, paid_amount: 250, balance_amount: 250, payment_type: 'credit', daysAgo: 2 },
          { shop_id: 3, salesperson_id: 3, route_id: 3, total_amount: 500, paid_amount: 500, balance_amount: 0, payment_type: 'cash', daysAgo: 6 },
          { shop_id: 3, salesperson_id: 3, route_id: 3, total_amount: 700, paid_amount: 400, balance_amount: 300, payment_type: 'credit', daysAgo: 1 },
          { shop_id: 4, salesperson_id: 4, route_id: 5, total_amount: 300, paid_amount: 300, balance_amount: 0, payment_type: 'cash', daysAgo: 7 },
          { shop_id: 4, salesperson_id: 4, route_id: 5, total_amount: 600, paid_amount: 300, balance_amount: 300, payment_type: 'credit', daysAgo: 2 },
          { shop_id: 5, salesperson_id: 5, route_id: 4, total_amount: 800, paid_amount: 800, balance_amount: 0, payment_type: 'cash', daysAgo: 5 },
          { shop_id: 5, salesperson_id: 5, route_id: 4, total_amount: 550, paid_amount: 300, balance_amount: 250, payment_type: 'credit', daysAgo: 4 },
          { shop_id: 6, salesperson_id: 6, route_id: 6, total_amount: 500, paid_amount: 500, balance_amount: 0, payment_type: 'cash', daysAgo: 6 },
          { shop_id: 6, salesperson_id: 6, route_id: 6, total_amount: 400, paid_amount: 200, balance_amount: 200, payment_type: 'credit', daysAgo: 3 },
          { shop_id: 7, salesperson_id: 7, route_id: 7, total_amount: 15000, paid_amount: 10000, balance_amount: 5000, payment_type: 'credit', daysAgo: 2 },
          { shop_id: 7, salesperson_id: 7, route_id: 7, total_amount: 4500, paid_amount: 4500, balance_amount: 0, payment_type: 'cash', daysAgo: 1 },
          { shop_id: 8, salesperson_id: 8, route_id: 8, total_amount: 600, paid_amount: 600, balance_amount: 0, payment_type: 'cash', daysAgo: 7 },
          { shop_id: 9, salesperson_id: 1, route_id: 1, total_amount: 500, paid_amount: 500, balance_amount: 0, payment_type: 'cash', daysAgo: 5 },
          { shop_id: 10, salesperson_id: 2, route_id: 2, total_amount: 450, paid_amount: 450, balance_amount: 0, payment_type: 'cash', daysAgo: 4 },
          { shop_id: 11, salesperson_id: 3, route_id: 3, total_amount: 700, paid_amount: 700, balance_amount: 0, payment_type: 'cash', daysAgo: 6 },
          { shop_id: 12, salesperson_id: 4, route_id: 4, total_amount: 450, paid_amount: 200, balance_amount: 250, payment_type: 'credit', daysAgo: 2 },
          { shop_id: 13, salesperson_id: 5, route_id: 5, total_amount: 500, paid_amount: 500, balance_amount: 0, payment_type: 'cash', daysAgo: 5 },
          { shop_id: 14, salesperson_id: 6, route_id: 6, total_amount: 700, paid_amount: 700, balance_amount: 0, payment_type: 'cash', daysAgo: 3 },
          { shop_id: 15, salesperson_id: 7, route_id: 7, total_amount: 5000, paid_amount: 2000, balance_amount: 3000, payment_type: 'credit', daysAgo: 1 }
        ];

        // Generate dates within last 30 days
        const getDateDaysAgo = (days) => {
          const d = new Date();
          d.setDate(d.getDate() - days);
          return d.toISOString().replace('T', ' ').substring(0, 19);
        };

        let saleId = 1;
        sales.forEach(sale => {
          const saleDate = getDateDaysAgo(sale.daysAgo);
          db.run(
            'INSERT OR IGNORE INTO sales (id, shop_id, salesperson_id, route_id, total_amount, paid_amount, balance_amount, payment_type, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [saleId, sale.shop_id, sale.salesperson_id, sale.route_id, sale.total_amount, sale.paid_amount, sale.balance_amount, sale.payment_type, saleDate]
          );

          // Generate 2 items per sale
          const item1 = {
            sale_id: saleId,
            product_id: (saleId % 15) + 1,
            quantity: (saleId % 10) + 1,
            unit_price: 50 + (saleId * 10),
            total_price: ((saleId % 10) + 1) * (50 + (saleId * 10))
          };
          const item2 = {
            sale_id: saleId,
            product_id: ((saleId + 5) % 15) + 1,
            quantity: (saleId % 5) + 1,
            unit_price: 80 + (saleId * 5),
            total_price: ((saleId % 5) + 1) * (80 + (saleId * 5))
          };

          [item1, item2].forEach(item => {
            db.run(
              'INSERT OR IGNORE INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
              [item.sale_id, item.product_id, item.quantity, item.unit_price, item.total_price]
            );
          });
          saleId++;
        });

        // Sample collections with dates
        const collections = [
          { shop_id: 1, salesperson_id: 1, amount: 4300, daysAgo: 2 },
          { shop_id: 2, salesperson_id: 2, amount: 1500, daysAgo: 4 },
          { shop_id: 3, salesperson_id: 3, amount: 500, daysAgo: 3 },
          { shop_id: 4, salesperson_id: 4, amount: 200, daysAgo: 5 },
          { shop_id: 5, salesperson_id: 5, amount: 4000, daysAgo: 1 },
          { shop_id: 6, salesperson_id: 6, amount: 620, daysAgo: 2 },
          { shop_id: 7, salesperson_id: 7, amount: 1250, daysAgo: 6 },
          { shop_id: 8, salesperson_id: 8, amount: 800, daysAgo: 7 },
          { shop_id: 15, salesperson_id: 7, amount: 2600, daysAgo: 2 }
        ];

        collections.forEach(col => {
          db.run('INSERT OR IGNORE INTO collections (shop_id, salesperson_id, amount, date) VALUES (?, ?, ?, ?)',
            [col.shop_id, col.salesperson_id, col.amount, getDateDaysAgo(col.daysAgo)]);
        });

        // Sample stock issues with dates
        const stockIssues = [
          { salesperson_id: 1, product_id: 1, quantity_issued: 100, daysAgo: 10 },
          { salesperson_id: 1, product_id: 2, quantity_issued: 80, daysAgo: 8 },
          { salesperson_id: 2, product_id: 3, quantity_issued: 120, daysAgo: 7 },
          { salesperson_id: 3, product_id: 4, quantity_issued: 50, daysAgo: 5 }
        ];

        stockIssues.forEach(issue => {
          db.run('INSERT OR IGNORE INTO stock_issues (salesperson_id, product_id, quantity_issued, date) VALUES (?, ?, ?, ?)',
            [issue.salesperson_id, issue.product_id, issue.quantity_issued, getDateDaysAgo(issue.daysAgo)]);
        });

        // Sample stock returns with dates
        const stockReturns = [
          { salesperson_id: 1, product_id: 1, quantity_returned: 10, daysAgo: 3 },
          { salesperson_id: 2, product_id: 3, quantity_returned: 5, daysAgo: 2 }
        ];

        stockReturns.forEach(ret => {
          db.run('INSERT OR IGNORE INTO stock_returns (salesperson_id, product_id, quantity_returned, date) VALUES (?, ?, ?, ?)',
            [ret.salesperson_id, ret.product_id, ret.quantity_returned, getDateDaysAgo(ret.daysAgo)]);
        });

        console.log('Seed data inserted successfully');
      });
    } else {
      console.log('Database already seeded, skipping seed data');
    }
  });
}

// Create all tables
function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Districts table
      db.run(`
        CREATE TABLE IF NOT EXISTS districts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Towns table
      db.run(`
        CREATE TABLE IF NOT EXISTS towns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          district_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (district_id) REFERENCES districts(id)
        )
      `);

      // Routes table
      db.run(`
        CREATE TABLE IF NOT EXISTS routes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          town_id INTEGER NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (town_id) REFERENCES towns(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          unit_price REAL NOT NULL,
          cost_price REAL DEFAULT 0,
          stock_quantity INTEGER DEFAULT 0,
          min_stock_level INTEGER DEFAULT 0,
          max_stock_level INTEGER DEFAULT 0,
          unit TEXT DEFAULT 'units',
          category TEXT DEFAULT 'general',
          description TEXT,
          brand TEXT,
          supplier TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (!err) {
          // Migrations for products table
          const productCols = [
            'cost_price REAL DEFAULT 0',
            'max_stock_level INTEGER DEFAULT 0',
            'brand TEXT',
            'supplier TEXT'
          ];
          productCols.forEach(colDef => {
            db.run(`ALTER TABLE products ADD COLUMN ${colDef}`, (err) => {
              // Ignore errors if column exists
            });
          });
        }
      });

      // Salespersons table
      db.run(`
        CREATE TABLE IF NOT EXISTS salespersons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          contact_number TEXT,
          email TEXT,
          vehicle_number TEXT,
          target_amount REAL DEFAULT 0,
          commission_rate REAL DEFAULT 0,
          start_date DATE,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Shops table
      db.run(`
        CREATE TABLE IF NOT EXISTS shops (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          owner_name TEXT,
          contact_number TEXT,
          email TEXT,
          address TEXT,
          district_id INTEGER,
          town_id INTEGER,
          route_id INTEGER,
          credit_limit REAL DEFAULT 0,
          current_balance REAL DEFAULT 0,
          payment_terms INTEGER DEFAULT 30,
          preferred_payment_method TEXT DEFAULT 'cash',
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (district_id) REFERENCES districts(id),
          FOREIGN KEY (town_id) REFERENCES towns(id),
          FOREIGN KEY (route_id) REFERENCES routes(id)
        )
      `);

      // Sales table
      db.run(`
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          shop_id INTEGER NOT NULL,
          salesperson_id INTEGER NOT NULL,
          route_id INTEGER,
          total_amount REAL NOT NULL,
          paid_amount REAL DEFAULT 0,
          balance_amount REAL DEFAULT 0,
          discount_amount REAL DEFAULT 0,
          tax_amount REAL DEFAULT 0,
          payment_type TEXT,
          payment_method TEXT DEFAULT 'cash',
          vehicle_number TEXT,
          notes TEXT,
          FOREIGN KEY (shop_id) REFERENCES shops(id),
          FOREIGN KEY (salesperson_id) REFERENCES salespersons(id),
          FOREIGN KEY (route_id) REFERENCES routes(id)
        )
      `, (err) => {
        if (!err) {
          // Migrations for sales table
          const salesCols = ['discount_amount', 'tax_amount'];
          salesCols.forEach(col => {
            db.run(`ALTER TABLE sales ADD COLUMN ${col} REAL DEFAULT 0`, (err) => {
              // Ignore errors if column exists
            });
          });
        }
      });

      // Sale items table
      db.run(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);

      // Collections table
      db.run(`
        CREATE TABLE IF NOT EXISTS collections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          shop_id INTEGER NOT NULL,
          salesperson_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          payment_method TEXT,
          reference_number TEXT,
          notes TEXT,
          vehicle_number TEXT,
          FOREIGN KEY (shop_id) REFERENCES shops(id),
          FOREIGN KEY (salesperson_id) REFERENCES salespersons(id)
        )
      `);

      // Salesperson stock table
      db.run(`
        CREATE TABLE IF NOT EXISTS salesperson_stock (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          salesperson_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (salesperson_id) REFERENCES salespersons(id),
          FOREIGN KEY (product_id) REFERENCES products(id),
          UNIQUE(salesperson_id, product_id)
        )
      `);

      // Stock issues table
      db.run(`
        CREATE TABLE IF NOT EXISTS stock_issues (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          salesperson_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity_issued INTEGER NOT NULL,
          vehicle_number TEXT,
          notes TEXT,
          FOREIGN KEY (salesperson_id) REFERENCES salespersons(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);

      // Stock returns table
      db.run(`
        CREATE TABLE IF NOT EXISTS stock_returns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          salesperson_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity_returned INTEGER NOT NULL CHECK(quantity_returned > 0),
          reason TEXT,
          condition TEXT DEFAULT 'good',
          inspection_required INTEGER DEFAULT 0,
          notes TEXT,
          FOREIGN KEY (salesperson_id) REFERENCES salespersons(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);

      // Company settings table (single row)
      db.run(`
        CREATE TABLE IF NOT EXISTS company_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          company_name TEXT NOT NULL DEFAULT 'Sales Management',
          company_tagline TEXT NOT NULL DEFAULT 'Admin Panel',
          company_logo TEXT DEFAULT '',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure default company settings row exists
      db.run(`
        INSERT OR IGNORE INTO company_settings (id, company_name, company_tagline, company_logo)
        VALUES (1, 'Sales Management', 'Admin Panel', '')
      `);

      // Migration: Add payment_method column if it doesn't exist
      db.get("PRAGMA table_info(sales)", (err, rows) => {
        // SQLite PRAGMA table_info returns rows if handled via .all or multiple .get
        // In sqlite3 node module, it's better to use .all
      });

      db.all("PRAGMA table_info(sales)", (err, columns) => {
        if (!err && columns) {
          const hasPaymentMethod = columns.some(col => col.name === 'payment_method');
          if (!hasPaymentMethod) {
            db.run(`ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'cash'`);
          }
        }
      });

      // Add check constraint for products stock
      db.run(`
        CREATE TRIGGER IF NOT EXISTS check_product_stock_positive
        BEFORE UPDATE ON products
        FOR EACH ROW
        WHEN NEW.stock_quantity < 0
        BEGIN
          SELECT RAISE(ABORT, 'Stock quantity cannot be negative');
        END
      `);

      // Add check constraint for salesperson stock
      db.run(`
        CREATE TRIGGER IF NOT EXISTS check_salesperson_stock_positive
        BEFORE UPDATE ON salesperson_stock
        FOR EACH ROW
        WHEN NEW.quantity < 0
        BEGIN
          SELECT RAISE(ABORT, 'Salesperson stock quantity cannot be negative');
        END
      `);

      // Create triggers for updated_at
      db.run(`
        CREATE TRIGGER IF NOT EXISTS update_shops_timestamp 
        AFTER UPDATE ON shops
        BEGIN
          UPDATE shops SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);
      // Create trigger for salespersons updated_at
      db.run(`
        CREATE TRIGGER IF NOT EXISTS update_salespersons_timestamp 
        AFTER UPDATE ON salespersons
        BEGIN
          UPDATE salespersons SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);
      db.run(`
        CREATE TRIGGER IF NOT EXISTS update_company_settings_timestamp
        AFTER UPDATE ON company_settings
        BEGIN
          UPDATE company_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);
      // Create indexes for better performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_shops_district ON shops(district_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_shops_town ON shops(town_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_shops_route ON shops(route_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_shops_active ON shops(is_active)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales(shop_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sales_salesperson ON sales(salesperson_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_collections_date ON collections(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_collections_shop ON collections(shop_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_collections_salesperson ON collections(salesperson_id)`);

      // Sale items indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)`);

      // Stock indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_stock_issues_date ON stock_issues(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_stock_issues_salesperson ON stock_issues(salesperson_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_stock_issues_product ON stock_issues(product_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_stock_returns_date ON stock_returns(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_stock_returns_salesperson ON stock_returns(salesperson_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_stock_returns_product ON stock_returns(product_id)`);

      // Salesperson stock composite index
      db.run(`CREATE INDEX IF NOT EXISTS idx_salesperson_stock_lookup ON salesperson_stock(salesperson_id, product_id)`, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
        } else {
          console.log('All tables created successfully');
          resolve();
        }
      });
    });
  });
}

// IPC Handlers for database operations
ipcMain.handle('db-query', async (event, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('Query error:', err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
});

ipcMain.handle('db-select', async (event, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Select error:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('db-get', async (event, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('Get error:', err);
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
});

// Note: db-transaction handler removed because functions cannot be passed via IPC.
// Front-end should manage transactions by sending individual BEGIN/COMMIT/ROLLBACK queries.

ipcMain.handle('db-backup', async () => {
  const backupPath = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupPath, `backup_${timestamp}.db`);

  return new Promise((resolve, reject) => {
    fs.copyFile(dbPath, backupFile, (err) => {
      if (err) {
        console.error('Backup error:', err);
        reject(err);
      } else {
        console.log('Backup created:', backupFile);
        resolve(backupFile);
      }
    });
  });
});

// Window creation
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    frame: true,  // â† Changed from false to true
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000').catch(e => {
      console.error('Error loading React Dev Server:', e);
      // Fallback to a simple error page if dev server is not running
      const errorHtml = `
        <html>
          <body style="font-family: system-ui, sans-serif; text-align: center; padding-top: 50px; background-color: #f3f4f6;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h1 style="color: #ef4444; margin-bottom: 20px;">Connection Failed</h1>
              <p style="color: #374151; font-size: 18px; margin-bottom: 30px;">
                The React development server is not reachable at <strong>http://localhost:3000</strong>.
              </p>
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; text-align: left; margin-bottom: 20px;">
                <p style="margin: 0; color: #1e40af; font-weight: bold;">To fix this:</p>
                <p style="margin: 10px 0 0 0; color: #1e3a8a;">Run the following command instead:</p>
                <code style="display: block; background: #dbeafe; padding: 10px; margin-top: 5px; border-radius: 4px; font-family: monospace;">npm run electron-dev</code>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                <em>This command starts both the React dev server and Electron concurrently.</em>
              </p>
            </div>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'build/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control handlers
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
      win.webContents.send('window-restored', false);
    } else {
      win.maximize();
      win.webContents.send('window-maximized', true);
    }
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// Handle frontend error logging
ipcMain.on('log-error', (event, error) => {
  logError(error, 'Renderer Process');
});

ipcMain.handle('window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isMaximized() : false;
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    await initDatabase();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (err) {
    console.error('Failed to initialize:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (db) {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      else console.log('Database closed');
    });
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = { db };
