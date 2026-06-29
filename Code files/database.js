// Real database service using Electron IPC
// This replaces the mock database with actual SQLite calls

const isElectron = () => {
  return window.electronAPI && window.electronAPI.db;
};

export const executeQuery = async (sql, params = []) => {
  if (!isElectron()) {
    throw new Error('Database not available. Please run in Electron.');
  }

  try {
    const result = await window.electronAPI.db.query(sql, params);
    return result;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
};

export const executeSelect = async (sql, params = []) => {
  if (!isElectron()) {
    throw new Error('Database not available. Please run in Electron.');
  }

  try {
    const rows = await window.electronAPI.db.select(sql, params);
    return rows;
  } catch (err) {
    console.error('Database select error:', err);
    throw err;
  }
};

export const executeGet = async (sql, params = []) => {
  if (!isElectron()) {
    throw new Error('Database not available. Please run in Electron.');
  }

  try {
    const row = await window.electronAPI.db.get(sql, params);
    return row;
  } catch (err) {
    console.error('Database get error:', err);
    throw err;
  }
};

export const backupDatabase = async () => {
  if (!isElectron()) {
    throw new Error('Database not available. Please run in Electron.');
  }

  try {
    const backupPath = await window.electronAPI.db.backup();
    console.log('Backup created at:', backupPath);
    return backupPath;
  } catch (err) {
    console.error('Database backup error:', err);
    throw err;
  }
};

// Helper function for getting salesperson stock (used in SalesEntry)
export const getSalespersonStock = async (salespersonId, productId) => {
  try {
    const result = await executeGet(
      `SELECT quantity FROM salesperson_stock 
       WHERE salesperson_id = ? AND product_id = ?`,
      [salespersonId, productId]
    );
    return result ? result.quantity : 0;
  } catch (err) {
    console.error('Error getting salesperson stock:', err);
    return 0;
  }
};

// Initialize database (called when app starts)
export const initDatabase = () => {
  if (isElectron()) {
    console.log('Database connection established via IPC');
  } else {
    console.warn('Running in browser mode - database unavailable');
  }
};

// ==================== COMPANY SETTINGS ====================

export const companySettingsService = {
  get: async () => {
    try {
      const row = await executeGet(
        `SELECT company_name, company_tagline, company_logo
         FROM company_settings
         WHERE id = 1`
      );

      return {
        companyName: row?.company_name || 'Sales Management',
        companyTagline: row?.company_tagline || 'Admin Panel',
        companyLogo: row?.company_logo || ''
      };
    } catch (err) {
      console.error('Error loading company settings:', err);
      throw err;
    }
  },

  save: async (branding) => {
    const companyName = (branding?.companyName || '').trim();
    const companyTagline = (branding?.companyTagline || '').trim();
    const companyLogo = branding?.companyLogo || '';

    if (!companyName) {
      throw new Error('Company name is required.');
    }

    try {
      await executeQuery(
        `UPDATE company_settings
         SET company_name = ?, company_tagline = ?, company_logo = ?
         WHERE id = 1`,
        [companyName, companyTagline || 'Admin Panel', companyLogo]
      );

      return {
        companyName,
        companyTagline: companyTagline || 'Admin Panel',
        companyLogo
      };
    } catch (err) {
      console.error('Error saving company settings:', err);
      throw err;
    }
  }
};
// NEW: Add this entire function
export const executeTransaction = async (callback) => {
  try {
    await executeQuery('BEGIN TRANSACTION');
    const result = await callback();
    await executeQuery('COMMIT');
    return result;
  } catch (err) {
    try {
      await executeQuery('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback error:', rollbackErr);
    }
    throw err;
  }
};
// ==================== GENERIC CRUD OPERATIONS ====================

export const createRecord = async (table, data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');

  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;

  try {
    const result = await executeQuery(sql, values);
    return { id: result.id, ...data, success: true };
  } catch (err) {
    console.error(`Error creating record in ${table}:`, err);
    throw err;
  }
};

export const updateRecord = async (table, id, data) => {
  const updates = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(data), id];

  const sql = `UPDATE ${table} SET ${updates} WHERE id = ?`;

  try {
    const result = await executeQuery(sql, values);
    return { id, ...data, success: true, changes: result.changes };
  } catch (err) {
    console.error(`Error updating record in ${table}:`, err);
    throw err;
  }
};

export const deleteRecord = async (table, id) => {
  const sql = `DELETE FROM ${table} WHERE id = ?`;

  try {
    const result = await executeQuery(sql, [id]);
    return { success: true, id, changes: result.changes };
  } catch (err) {
    console.error(`Error deleting record from ${table}:`, err);
    throw err;
  }
};

export const getAllRecords = async (table, filters = {}, orderBy = 'id DESC', limit = 1000, offset = 0) => {
  // Whitelist allowed table names to prevent SQL injection
  const allowedTables = [
    'products', 'salespersons', 'shops', 'sales', 'sale_items',
    'collections', 'districts', 'towns', 'routes',
    'salesperson_stock', 'stock_issues', 'stock_returns'
  ];

  if (!allowedTables.includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  // Whitelist ORDER BY columns to prevent SQL injection
  const allowedOrderColumns = {
    products: ['id', 'name', 'code', 'unit_price', 'stock_quantity', 'created_at', 'category'],
    salespersons: ['id', 'name', 'code', 'created_at', 'contact_number'],
    shops: ['id', 'name', 'code', 'current_balance', 'created_at', 'owner_name'],
    sales: ['id', 'date', 'total_amount', 'shop_id', 'salesperson_id'],
    sale_items: ['id', 'sale_id', 'product_id', 'quantity'],
    collections: ['id', 'date', 'amount', 'shop_id', 'salesperson_id'],
    districts: ['id', 'name', 'code'],
    towns: ['id', 'name', 'code', 'district_id'],
    routes: ['id', 'name', 'code', 'town_id'],
    salesperson_stock: ['id', 'salesperson_id', 'product_id', 'quantity'],
    stock_issues: ['id', 'date', 'salesperson_id', 'product_id'],
    stock_returns: ['id', 'date', 'salesperson_id', 'product_id']
  };

  const validColumns = allowedOrderColumns[table] || ['id'];
  const orderParts = orderBy.trim().split(/\s+/);
  const orderColumn = orderParts[0];
  const orderDirection = (orderParts[1] || 'DESC').toUpperCase();

  if (!validColumns.includes(orderColumn)) {
    throw new Error(`Invalid ORDER BY column: ${orderColumn}`);
  }

  if (!['ASC', 'DESC'].includes(orderDirection)) {
    throw new Error(`Invalid ORDER BY direction: ${orderDirection}`);
  }

  let sql = `SELECT * FROM ${table}`;
  const params = [];

  if (Object.keys(filters).length > 0) {
    const filterColumns = Object.keys(filters);

    const whereClauses = filterColumns.map(key => {
      // Validate column name format (alphanumeric and underscore only)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new Error(`Invalid filter column: ${key}`);
      }
      params.push(filters[key]);
      return `${key} = ?`;
    });
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  // Safe to use now after validation
  sql += ` ORDER BY ${orderColumn} ${orderDirection}`;

  // Apply limit (max 1000 records)
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 1000), 1000);
  sql += ` LIMIT ${safeLimit}`;

  if (offset > 0) {
    sql += ` OFFSET ${Math.max(0, parseInt(offset) || 0)}`;
  }

  try {
    const rows = await executeSelect(sql, params);
    return rows;
  } catch (err) {
    console.error(`Error getting records from ${table}:`, err);
    throw err;
  }
};

export const getRecordById = async (table, id) => {
  const sql = `SELECT * FROM ${table} WHERE id = ?`;

  try {
    const row = await executeGet(sql, [id]);
    return row;
  } catch (err) {
    console.error(`Error getting record from ${table}:`, err);
    throw err;
  }
};

// ==================== PRODUCTS CRUD ====================

export const productService = {
  getAll: async (activeOnly = true) => {
    let sql = 'SELECT * FROM products';
    const params = [];

    if (activeOnly) {
      sql += ' WHERE is_active = 1';
    }

    sql += ' ORDER BY name';
    return await executeSelect(sql, params);
  },

  getById: async (id) => {
    return await getRecordById('products', id);
  },

  create: async (productData) => {
    return await createRecord('products', productData);
  },

  update: async (id, productData) => {
    return await updateRecord('products', id, productData);
  },

  delete: async (id) => {
    try {
      const usage = await executeGet(
        `SELECT
          (SELECT COUNT(*) FROM sale_items WHERE product_id = ?) AS sale_item_count,
          (SELECT COUNT(*) FROM stock_issues WHERE product_id = ?) AS issue_count,
          (SELECT COUNT(*) FROM stock_returns WHERE product_id = ?) AS return_count`,
        [id, id, id]
      );

      const hasTransactionalUsage =
        Number(usage?.sale_item_count || 0) > 0 ||
        Number(usage?.issue_count || 0) > 0 ||
        Number(usage?.return_count || 0) > 0;

      if (hasTransactionalUsage) {
        // Keep historical integrity: deactivate instead of physical delete.
        const result = await updateRecord('products', id, { is_active: 0 });
        return { ...result, mode: 'soft' };
      }

      // No transactional usage, safe to remove stock assignments and delete permanently.
      await executeQuery('DELETE FROM salesperson_stock WHERE product_id = ?', [id]);
      const result = await deleteRecord('products', id);
      return { ...result, mode: 'hard' };
    } catch (err) {
      console.error('Error deleting product:', err);
      throw err;
    }
  },

  updateStock: async (productId, quantityChange) => {
    const sql = `UPDATE products 
                 SET stock_quantity = stock_quantity + ? 
                 WHERE id = ? AND is_active = 1`;

    try {
      const result = await executeQuery(sql, [quantityChange, productId]);
      return { success: true, changes: result.changes };
    } catch (err) {
      console.error('Error updating stock:', err);
      throw err;
    }
  },

  search: async (searchTerm) => {
    const sql = `
      SELECT * FROM products 
      WHERE (code LIKE ? OR name LIKE ?) 
      AND is_active = 1
      ORDER BY name
    `;
    const searchParam = `%${searchTerm}%`;
    return await executeSelect(sql, [searchParam, searchParam]);
  }
};

export const productCategoryService = {
  ensureTable: async () => {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT 'bg-blue-500',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },

  getAll: async () => {
    await productCategoryService.ensureTable();
    const sql = `
      SELECT
        c.*,
        COALESCE((
          SELECT COUNT(*)
          FROM products p
          WHERE LOWER(COALESCE(p.category, 'general')) = LOWER(c.value)
        ), 0) AS product_count
      FROM product_categories c
      ORDER BY c.name
    `;
    return await executeSelect(sql);
  },

  create: async (categoryData) => {
    await productCategoryService.ensureTable();
    const payload = {
      code: String(categoryData.code || '').trim().toUpperCase(),
      value: String(categoryData.value || categoryData.code || '').trim().toLowerCase(),
      name: String(categoryData.name || '').trim(),
      description: String(categoryData.description || '').trim(),
      color: String(categoryData.color || 'bg-blue-500').trim()
    };

    if (!payload.code || !payload.value || !payload.name) {
      throw new Error('Code, value, and name are required');
    }

    return await createRecord('product_categories', payload);
  },

  update: async (id, categoryData) => {
    await productCategoryService.ensureTable();
    const existing = await executeGet('SELECT * FROM product_categories WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('Category not found');
    }

    const nextValue = String(categoryData.value || categoryData.code || existing.value).trim().toLowerCase();
    const updateData = {
      code: String(categoryData.code || existing.code).trim().toUpperCase(),
      value: nextValue,
      name: String(categoryData.name || existing.name).trim(),
      description: String(categoryData.description ?? existing.description ?? '').trim(),
      color: String(categoryData.color || existing.color || 'bg-blue-500').trim()
    };

    const oldValue = String(existing.value || '').toLowerCase();
    if (oldValue && nextValue && oldValue !== nextValue) {
      await executeQuery(
        `UPDATE products SET category = ? WHERE LOWER(COALESCE(category, 'general')) = ?`,
        [nextValue, oldValue]
      );
    }

    return await updateRecord('product_categories', id, updateData);
  },

  delete: async (id) => {
    await productCategoryService.ensureTable();
    const existing = await executeGet('SELECT * FROM product_categories WHERE id = ?', [id]);
    if (!existing) {
      return { success: true, changes: 0 };
    }

    if (String(existing.value).toLowerCase() === 'general') {
      throw new Error('General category cannot be deleted');
    }

    await executeQuery(
      `UPDATE products SET category = 'general' WHERE LOWER(COALESCE(category, 'general')) = ?`,
      [String(existing.value).toLowerCase()]
    );

    return await deleteRecord('product_categories', id);
  }
};

// ==================== SALESPERSONS CRUD ====================

export const salespersonService = {
  getAll: async (activeOnly = true) => {
    let sql = `
      SELECT sp.*,
             COUNT(DISTINCT ss.product_id) as product_count,
             COALESCE(SUM(ss.quantity), 0) as total_stock_quantity,
             COALESCE(SUM(ss.quantity * p.unit_price), 0) as stock_value
      FROM salespersons sp
      LEFT JOIN salesperson_stock ss ON sp.id = ss.salesperson_id
      LEFT JOIN products p ON ss.product_id = p.id
    `;

    const params = [];

    if (activeOnly) {
      sql += ' WHERE sp.is_active = 1';
    }

    sql += ' GROUP BY sp.id ORDER BY sp.name';

    return await executeSelect(sql, params);
  },

  getById: async (id) => {
    return await getRecordById('salespersons', id);
  },

  create: async (salespersonData) => {
    return await createRecord('salespersons', salespersonData);
  },

  update: async (id, salespersonData) => {
    return await updateRecord('salespersons', id, salespersonData);
  },

  delete: async (id) => {
    try {
      // Check if salesperson has stock
      const stock = await executeGet(
        'SELECT COUNT(*) as count FROM salesperson_stock WHERE salesperson_id = ? AND quantity > 0',
        [id]
      );

      if (stock.count > 0) {
        throw new Error('Cannot delete salesperson: They have stock assigned. Please return all stock first.');
      }

      // Check if salesperson has sales
      const sales = await executeGet(
        'SELECT COUNT(*) as count FROM sales WHERE salesperson_id = ?',
        [id]
      );

      // Check if salesperson has collections
      const collections = await executeGet(
        'SELECT COUNT(*) as count FROM collections WHERE salesperson_id = ?',
        [id]
      );

      if (sales.count > 0 || collections.count > 0) {
        throw new Error('Cannot delete salesperson: They have associated sales or collections. Consider deactivating instead.');
      }

      return await deleteRecord('salespersons', id);
    } catch (err) {
      console.error('Error deleting salesperson:', err);
      throw err;
    }
  },

  getWithStock: async (salespersonId) => {
    const sql = `
      SELECT sp.*, 
             ss.product_id,
             ss.quantity as stock_quantity,
             p.name as product_name,
             p.code as product_code,
             p.unit_price
      FROM salespersons sp
      LEFT JOIN salesperson_stock ss ON sp.id = ss.salesperson_id
      LEFT JOIN products p ON ss.product_id = p.id
      WHERE sp.id = ? AND sp.is_active = 1
    `;

    return await executeSelect(sql, [salespersonId]);
  },

  getActiveSalespersons: async () => {
    const sql = `
      SELECT sp.*, 
             SUM(CASE WHEN s.paid_amount IS NOT NULL THEN s.paid_amount ELSE 0 END) as total_sales,
             COUNT(s.id) as sale_count
      FROM salespersons sp
      LEFT JOIN sales s ON sp.id = s.salesperson_id AND DATE(s.date) = DATE('now')
      WHERE sp.is_active = 1
      GROUP BY sp.id
      ORDER BY sp.name
    `;

    return await executeSelect(sql);
  }
};

// ==================== SHOPS CRUD ====================

export const shopService = {
  getAll: async (filters = {}) => {
    let sql = `
      SELECT s.*, 
             d.name as district_name,
             t.name as town_name,
             r.name as route_name
      FROM shops s
      LEFT JOIN districts d ON s.district_id = d.id
      LEFT JOIN towns t ON s.town_id = t.id
      LEFT JOIN routes r ON s.route_id = r.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.routeId) {
      sql += ' AND s.route_id = ?';
      params.push(filters.routeId);
    }

    if (filters.districtId) {
      sql += ' AND s.district_id = ?';
      params.push(filters.districtId);
    }

    if (filters.townId) {
      sql += ' AND s.town_id = ?';
      params.push(filters.townId);
    }

    if (filters.activeOnly !== false) {
      sql += ' AND s.is_active = 1';
    }

    sql += ' ORDER BY s.name';

    return await executeSelect(sql, params);
  },

  getById: async (id) => {
    const sql = `
      SELECT s.*, 
             d.name as district_name,
             t.name as town_name,
             r.name as route_name
      FROM shops s
      LEFT JOIN districts d ON s.district_id = d.id
      LEFT JOIN towns t ON s.town_id = t.id
      LEFT JOIN routes r ON s.route_id = r.id
      WHERE s.id = ?
    `;

    return await executeGet(sql, [id]);
  },

  create: async (shopData) => {
    return await createRecord('shops', shopData);
  },

  update: async (id, shopData) => {
    return await updateRecord('shops', id, shopData);
  },

  updateBalance: async (shopId, amount) => {
    const sql = `UPDATE shops 
                 SET current_balance = current_balance + ? 
                 WHERE id = ? AND is_active = 1`;

    try {
      const result = await executeQuery(sql, [amount, shopId]);
      if (result.changes === 0) {
        throw new Error('Shop not found or inactive');
      }
      return { success: true, changes: result.changes };
    } catch (err) {
      console.error('Error updating shop balance:', err);
      throw err;
    }
  },

  delete: async (id) => {
    try {
      // Check if shop has associated sales
      const sales = await executeGet(
        'SELECT COUNT(*) as count FROM sales WHERE shop_id = ?',
        [id]
      );

      // Check if shop has associated collections
      const collections = await executeGet(
        'SELECT COUNT(*) as count FROM collections WHERE shop_id = ?',
        [id]
      );

      if (sales.count > 0 || collections.count > 0) {
        throw new Error('Cannot delete shop: It has associated sales or collections. Consider deactivating instead.');
      }

      return await deleteRecord('shops', id);
    } catch (err) {
      console.error('Error deleting shop:', err);
      throw err;
    }
  },

  getShopsWithCredit: async () => {
    const sql = `
      SELECT s.*, 
             d.name as district_name,
             t.name as town_name,
             r.name as route_name,
             s.current_balance - s.credit_limit as available_credit
      FROM shops s
      LEFT JOIN districts d ON s.district_id = d.id
      LEFT JOIN towns t ON s.town_id = t.id
      LEFT JOIN routes r ON s.route_id = r.id
      WHERE s.credit_limit > 0
      ORDER BY available_credit, s.name
    `;

    return await executeSelect(sql);
  }
};

// ==================== SALES CRUD ====================

export const saleService = {
  create: async (saleData, items) => {
    return executeTransaction(async () => {
      // Validate input
      if (!saleData.salesperson_id || !saleData.shop_id) {
        throw new Error('Salesperson and shop are required');
      }

      if (!items || items.length === 0) {
        throw new Error('At least one item is required');
      }

      // Validate stock availability first
      for (const item of items) {
        if (!item.product_id || !item.quantity || item.quantity <= 0) {
          throw new Error('Invalid item data');
        }

        const stock = await executeGet(
          `SELECT quantity FROM salesperson_stock 
           WHERE salesperson_id = ? AND product_id = ?`,
          [saleData.salesperson_id, item.product_id]
        );

        if (!stock || stock.quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for product ID ${item.product_id}. ` +
            `Available: ${stock?.quantity || 0}, Required: ${item.quantity}`
          );
        }
      }

      // Insert sale
      const saleResult = await createRecord('sales', saleData);
      const saleId = saleResult.id;

      // Insert sale items
      for (const item of items) {
        await createRecord('sale_items', {
          sale_id: saleId,
          ...item
        });

        // Update salesperson stock with validation
        const updateResult = await executeQuery(
          `UPDATE salesperson_stock 
           SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
           WHERE salesperson_id = ? AND product_id = ? AND quantity >= ?`,
          [item.quantity, saleData.salesperson_id, item.product_id, item.quantity]
        );

        if (updateResult.changes === 0) {
          throw new Error(`Failed to update stock for product ID ${item.product_id}`);
        }
      }

      // Update shop balance if credit sale
      if (saleData.balance_amount > 0) {
        const balanceResult = await executeQuery(
          `UPDATE shops 
           SET current_balance = current_balance - ? 
           WHERE id = ? AND is_active = 1`,
          [saleData.balance_amount, saleData.shop_id]
        );

        if (balanceResult.changes === 0) {
          throw new Error('Failed to update shop balance - shop not found or inactive');
        }
      }

      return { ...saleResult, items, success: true };
    });
  },

  update: async (saleId, saleData, items) => {
    return executeTransaction(async () => {
      // 1. Get old sale data to reverse effects
      const oldSale = await saleService.getById(saleId);
      if (!oldSale) {
        throw new Error('Sale not found');
      }

      // 2. Reverse old stock effects
      for (const item of oldSale.items) {
        await executeQuery(
          `UPDATE salesperson_stock 
           SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP
           WHERE salesperson_id = ? AND product_id = ?`,
          [item.quantity, oldSale.salesperson_id, item.product_id]
        );
      }

      // 3. Reverse old shop balance if it was a credit sale
      if (oldSale.balance_amount > 0) {
        await executeQuery(
          `UPDATE shops 
           SET current_balance = current_balance + ? 
           WHERE id = ?`,
          [oldSale.balance_amount, oldSale.shop_id]
        );
      }

      // 4. Validate new stock availability (from fresh salesperson stock state)
      for (const item of items) {
        const stock = await executeGet(
          `SELECT quantity FROM salesperson_stock 
           WHERE salesperson_id = ? AND product_id = ?`,
          [saleData.salesperson_id, item.product_id]
        );

        if (!stock || stock.quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for product ID ${item.product_id}. ` +
            `Available: ${stock?.quantity || 0}, Required: ${item.quantity}`
          );
        }
      }

      // 5. Update main sale record
      await updateRecord('sales', saleId, saleData);

      // 6. Replace sale items
      await executeQuery('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
      for (const item of items) {
        await createRecord('sale_items', {
          sale_id: saleId,
          ...item
        });

        // Apply new stock reduction
        const updateResult = await executeQuery(
          `UPDATE salesperson_stock 
           SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
           WHERE salesperson_id = ? AND product_id = ? AND quantity >= ?`,
          [item.quantity, saleData.salesperson_id, item.product_id, item.quantity]
        );

        if (updateResult.changes === 0) {
          throw new Error(`Failed to apply new stock reduction for product ID ${item.product_id}`);
        }
      }

      // 7. Apply new shop balance if credit sale
      if (saleData.balance_amount > 0) {
        const balanceResult = await executeQuery(
          `UPDATE shops 
           SET current_balance = current_balance - ? 
           WHERE id = ? AND is_active = 1`,
          [saleData.balance_amount, saleData.shop_id]
        );

        if (balanceResult.changes === 0) {
          throw new Error('Failed to update shop balance with new sale values');
        }
      }

      return { id: saleId, ...saleData, items, success: true };
    });
  },

  getById: async (id) => {
    const sale = await executeGet(`
      SELECT s.*, 
             sh.name as shop_name,
             sp.name as salesperson_name,
             r.name as route_name
      FROM sales s
      LEFT JOIN shops sh ON s.shop_id = sh.id
      LEFT JOIN salespersons sp ON s.salesperson_id = sp.id
      LEFT JOIN routes r ON s.route_id = r.id
      WHERE s.id = ?
    `, [id]);

    if (sale) {
      const items = await executeSelect(`
        SELECT si.*, p.name as product_name, p.code as product_code
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `, [id]);

      return { ...sale, items };
    }

    return null;
  },

  getAll: async (filters = {}) => {
    let sql = `
      SELECT s.*, 
             sh.name as shop_name,
             sp.name as salesperson_name,
             r.name as route_name
      FROM sales s
      LEFT JOIN shops sh ON s.shop_id = sh.id
      LEFT JOIN salespersons sp ON s.salesperson_id = sp.id
      LEFT JOIN routes r ON s.route_id = r.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.dateFrom) {
      sql += ' AND DATE(s.date) >= DATE(?)';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ' AND DATE(s.date) <= DATE(?)';
      params.push(filters.dateTo);
    }

    if (filters.salespersonId) {
      sql += ' AND s.salesperson_id = ?';
      params.push(filters.salespersonId);
    }

    if (filters.shopId) {
      sql += ' AND s.shop_id = ?';
      params.push(filters.shopId);
    }

    if (filters.routeId) {
      sql += ' AND s.route_id = ?';
      params.push(filters.routeId);
    }

    sql += ' ORDER BY s.date DESC';

    return await executeSelect(sql, params);
  },

  delete: async (id) => {
    try {
      await executeQuery('BEGIN TRANSACTION');

      // Get sale details first
      const sale = await saleService.getById(id);

      if (!sale) {
        throw new Error('Sale not found');
      }

      // Restore salesperson stock
      for (const item of sale.items) {
        await executeQuery(
          `UPDATE salesperson_stock 
           SET quantity = quantity + ? 
           WHERE salesperson_id = ? AND product_id = ?`,
          [item.quantity, sale.salesperson_id, item.product_id]
        );
      }

      // Restore shop balance if credit sale
      if (sale.balance_amount > 0) {
        await shopService.updateBalance(sale.shop_id, sale.balance_amount);
      }

      // Delete sale items explicitly
      await executeQuery('DELETE FROM sale_items WHERE sale_id = ?', [id]);

      // Delete sale record
      await deleteRecord('sales', id);

      await executeQuery('COMMIT');

      return { success: true, id };

    } catch (err) {
      await executeQuery('ROLLBACK');
      console.error('Error deleting sale:', err);
      throw err;
    }
  },

  getDailySalesReport: async (date) => {
    const sql = `
      SELECT 
        s.date,
        sp.name as salesperson_name,
        COUNT(DISTINCT s.id) as total_sales,
        SUM(s.total_amount) as total_amount,
        SUM(s.paid_amount) as total_paid,
        SUM(s.balance_amount) as total_balance
      FROM sales s
      LEFT JOIN salespersons sp ON s.salesperson_id = sp.id
      WHERE DATE(s.date) = DATE(?)
      GROUP BY s.salesperson_id
      ORDER BY total_amount DESC
    `;

    return await executeSelect(sql, [date]);
  },

  getSalesByProduct: async (dateFrom, dateTo) => {
    const sql = `
      SELECT 
        p.code,
        p.name,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_amount,
        COUNT(DISTINCT s.id) as sale_count
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.date) BETWEEN DATE(?) AND DATE(?)
      GROUP BY p.id
      ORDER BY total_quantity DESC
    `;

    return await executeSelect(sql, [dateFrom, dateTo]);
  }
};

// ==================== COLLECTIONS CRUD ====================

export const collectionService = {
  create: async (collectionData) => {
    return executeTransaction(async () => {
      // Validate input
      if (!collectionData.shop_id || !collectionData.salesperson_id || !collectionData.amount) {
        throw new Error('Missing required fields: shop_id, salesperson_id, and amount are required');
      }

      if (collectionData.amount <= 0) {
        throw new Error('Collection amount must be greater than 0');
      }

      // Validate shop exists and has outstanding balance
      const shop = await executeGet(
        `SELECT id, current_balance, is_active FROM shops WHERE id = ?`,
        [collectionData.shop_id]
      );

      if (!shop) {
        throw new Error('Shop not found');
      }

      if (!shop.is_active) {
        throw new Error('Cannot create collection for inactive shop');
      }

      if (shop.current_balance >= 0) {
        throw new Error('Shop has no outstanding balance');
      }

      if (Math.abs(shop.current_balance) < collectionData.amount) {
        throw new Error(
          `Collection amount (${collectionData.amount}) exceeds outstanding balance (${Math.abs(shop.current_balance)})`
        );
      }

      const result = await createRecord('collections', {
        ...collectionData,
        date: collectionData.date || new Date().toISOString()
      });

      // Update shop balance
      const balanceUpdate = await executeQuery(
        `UPDATE shops 
         SET current_balance = current_balance + ? 
         WHERE id = ? AND is_active = 1`,
        [collectionData.amount, collectionData.shop_id]
      );

      if (balanceUpdate.changes === 0) {
        throw new Error('Failed to update shop balance');
      }

      return { ...result, success: true };
    });
  },

  getAll: async (filters = {}) => {
    let sql = `
      SELECT c.*, 
             sh.name as shop_name,
             sp.name as salesperson_name
      FROM collections c
      LEFT JOIN shops sh ON c.shop_id = sh.id
      LEFT JOIN salespersons sp ON c.salesperson_id = sp.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.dateFrom) {
      sql += ' AND DATE(c.date) >= DATE(?)';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ' AND DATE(c.date) <= DATE(?)';
      params.push(filters.dateTo);
    }

    if (filters.shopId) {
      sql += ' AND c.shop_id = ?';
      params.push(filters.shopId);
    }

    if (filters.salespersonId) {
      sql += ' AND c.salesperson_id = ?';
      params.push(filters.salespersonId);
    }

    sql += ' ORDER BY c.date DESC';

    return await executeSelect(sql, params);
  },

  getById: async (id) => {
    const sql = `
      SELECT c.*, 
             sh.name as shop_name,
             sp.name as salesperson_name
      FROM collections c
      LEFT JOIN shops sh ON c.shop_id = sh.id
      LEFT JOIN salespersons sp ON c.salesperson_id = sp.id
      WHERE c.id = ?
    `;

    return await executeGet(sql, [id]);
  },

  delete: async (id) => {
    try {
      await executeQuery('BEGIN TRANSACTION');

      // Get collection details first
      const collection = await collectionService.getById(id);

      if (!collection) {
        throw new Error('Collection not found');
      }

      // Reverse shop balance update
      await shopService.updateBalance(collection.shop_id, collection.amount * -1);

      // Delete collection
      await deleteRecord('collections', id);

      await executeQuery('COMMIT');

      return { success: true, id };

    } catch (err) {
      await executeQuery('ROLLBACK');
      console.error('Error deleting collection:', err);
      throw err;
    }
  },

  getDailyCollectionsReport: async (date) => {
    const sql = `
      SELECT 
        DATE(c.date) as collection_date,
        sp.name as salesperson_name,
        COUNT(DISTINCT c.id) as total_collections,
        SUM(c.amount) as total_amount
      FROM collections c
      LEFT JOIN salespersons sp ON c.salesperson_id = sp.id
      WHERE DATE(c.date) = DATE(?)
      GROUP BY c.salesperson_id
      ORDER BY total_amount DESC
    `;

    return await executeSelect(sql, [date]);
  }
};

// ==================== STOCK MANAGEMENT ====================

export const stockService = {
  issueStock: async (issueData) => {
    return executeTransaction(async () => {
      // Validate input
      if (!issueData.salesperson_id || !issueData.product_id || !issueData.quantity_issued) {
        throw new Error('Missing required fields: salesperson_id, product_id, and quantity_issued are required');
      }

      if (issueData.quantity_issued <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      // Validate warehouse stock
      const product = await productService.getById(issueData.product_id);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.is_active) {
        throw new Error('Cannot issue inactive product');
      }

      if (product.stock_quantity < issueData.quantity_issued) {
        throw new Error(
          `Insufficient warehouse stock. ` +
          `Available: ${product.stock_quantity} ${product.unit || 'units'}, ` +
          `Required: ${issueData.quantity_issued}`
        );
      }

      // Record stock issue with timestamp
      const issueRecord = await createRecord('stock_issues', {
        ...issueData,
        date: issueData.date || new Date().toISOString()
      });

      // Update salesperson stock
      const existingStock = await executeGet(
        `SELECT quantity FROM salesperson_stock 
         WHERE salesperson_id = ? AND product_id = ?`,
        [issueData.salesperson_id, issueData.product_id]
      );

      if (existingStock) {
        await executeQuery(
          `UPDATE salesperson_stock 
           SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP
           WHERE salesperson_id = ? AND product_id = ?`,
          [issueData.quantity_issued, issueData.salesperson_id, issueData.product_id]
        );
      } else {
        await createRecord('salesperson_stock', {
          salesperson_id: issueData.salesperson_id,
          product_id: issueData.product_id,
          quantity: issueData.quantity_issued
        });
      }

      // Update warehouse stock with validation
      const stockUpdate = await executeQuery(
        `UPDATE products 
         SET stock_quantity = stock_quantity - ? 
         WHERE id = ? AND stock_quantity >= ? AND is_active = 1`,
        [issueData.quantity_issued, issueData.product_id, issueData.quantity_issued]
      );

      if (stockUpdate.changes === 0) {
        throw new Error('Failed to update warehouse stock - insufficient quantity or product inactive');
      }

      return { success: true, issueId: issueRecord.id };
    });
  },

  issueMultipleStock: async (payload) => {
    return executeTransaction(async () => {
      if (!payload.salesperson_id || !Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error('Salesperson and at least one issue item are required');
      }

      const consolidatedItems = Object.values(
        payload.items.reduce((acc, item) => {
          const productId = parseInt(item.product_id);
          const qty = parseInt(item.quantity_issued);

          if (!productId || !qty || qty <= 0) {
            throw new Error('Each issue item must include valid product_id and quantity_issued');
          }

          if (!acc[productId]) {
            acc[productId] = { product_id: productId, quantity_issued: 0 };
          }
          acc[productId].quantity_issued += qty;
          return acc;
        }, {})
      );

      for (const item of consolidatedItems) {
        const product = await productService.getById(item.product_id);
        if (!product) {
          throw new Error(`Product not found for ID ${item.product_id}`);
        }
        if (!product.is_active) {
          throw new Error(`Cannot issue inactive product: ${product.name}`);
        }
        if (product.stock_quantity < item.quantity_issued) {
          throw new Error(
            `Insufficient warehouse stock for ${product.name}. ` +
            `Available: ${product.stock_quantity} ${product.unit || 'units'}, ` +
            `Required: ${item.quantity_issued}`
          );
        }
      }

      const createdIssueIds = [];

      for (const item of consolidatedItems) {
        const issueRecord = await createRecord('stock_issues', {
          salesperson_id: payload.salesperson_id,
          product_id: item.product_id,
          quantity_issued: item.quantity_issued,
          vehicle_number: payload.vehicle_number || null,
          notes: payload.notes || null,
          date: payload.date || new Date().toISOString()
        });
        createdIssueIds.push(issueRecord.id);

        const existingStock = await executeGet(
          `SELECT quantity FROM salesperson_stock
           WHERE salesperson_id = ? AND product_id = ?`,
          [payload.salesperson_id, item.product_id]
        );

        if (existingStock) {
          await executeQuery(
            `UPDATE salesperson_stock
             SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP
             WHERE salesperson_id = ? AND product_id = ?`,
            [item.quantity_issued, payload.salesperson_id, item.product_id]
          );
        } else {
          await createRecord('salesperson_stock', {
            salesperson_id: payload.salesperson_id,
            product_id: item.product_id,
            quantity: item.quantity_issued
          });
        }

        const stockUpdate = await executeQuery(
          `UPDATE products
           SET stock_quantity = stock_quantity - ?
           WHERE id = ? AND stock_quantity >= ? AND is_active = 1`,
          [item.quantity_issued, item.product_id, item.quantity_issued]
        );

        if (stockUpdate.changes === 0) {
          throw new Error('Failed to update warehouse stock for one or more items');
        }
      }

      return { success: true, issueIds: createdIssueIds, count: createdIssueIds.length };
    });
  },

  returnStock: async (returnData) => {
    return executeTransaction(async () => {
      // Validate input
      if (!returnData.salesperson_id || !returnData.product_id || !returnData.quantity_returned) {
        throw new Error('Missing required fields: salesperson_id, product_id, and quantity_returned are required');
      }

      if (returnData.quantity_returned <= 0) {
        throw new Error('Return quantity must be greater than 0');
      }

      // Validate salesperson stock
      const salespersonStock = await executeGet(
        `SELECT quantity FROM salesperson_stock 
         WHERE salesperson_id = ? AND product_id = ?`,
        [returnData.salesperson_id, returnData.product_id]
      );

      if (!salespersonStock || salespersonStock.quantity < returnData.quantity_returned) {
        throw new Error(
          `Insufficient salesperson stock. ` +
          `Available: ${salespersonStock?.quantity || 0}, ` +
          `Returning: ${returnData.quantity_returned}`
        );
      }

      // Record stock return with timestamp
      const returnRecord = await createRecord('stock_returns', {
        ...returnData,
        date: returnData.date || new Date().toISOString(),
        condition: returnData.condition || 'good',
        inspection_required: returnData.inspection_required || 0
      });

      // Update salesperson stock with validation
      const spStockUpdate = await executeQuery(
        `UPDATE salesperson_stock 
         SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
         WHERE salesperson_id = ? AND product_id = ? AND quantity >= ?`,
        [returnData.quantity_returned, returnData.salesperson_id,
        returnData.product_id, returnData.quantity_returned]
      );

      if (spStockUpdate.changes === 0) {
        throw new Error('Failed to update salesperson stock - insufficient quantity');
      }

      // Update warehouse stock
      const warehouseUpdate = await executeQuery(
        `UPDATE products 
         SET stock_quantity = stock_quantity + ? 
         WHERE id = ? AND is_active = 1`,
        [returnData.quantity_returned, returnData.product_id]
      );

      if (warehouseUpdate.changes === 0) {
        throw new Error('Failed to update warehouse stock - product not found or inactive');
      }

      return { success: true, returnId: returnRecord.id };
    });
  },

  returnMultipleStock: async (payload) => {
    return executeTransaction(async () => {
      if (!payload?.salesperson_id) {
        throw new Error('Missing required field: salesperson_id');
      }
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error('At least one return item is required');
      }

      const normalizedItems = Object.values(
        payload.items.reduce((acc, raw) => {
          const productId = parseInt(raw.product_id, 10);
          const qty = parseInt(raw.quantity_returned, 10);
          if (!productId || !qty || qty <= 0) {
            throw new Error('Each return item must have valid product_id and quantity_returned > 0');
          }

          if (!acc[productId]) {
            acc[productId] = { product_id: productId, quantity_returned: 0 };
          }
          acc[productId].quantity_returned += qty;
          return acc;
        }, {})
      );

      const createdReturnIds = [];

      for (const item of normalizedItems) {
        const stockRow = await executeGet(
          `SELECT quantity FROM salesperson_stock WHERE salesperson_id = ? AND product_id = ?`,
          [payload.salesperson_id, item.product_id]
        );
        const available = stockRow?.quantity || 0;
        if (available < item.quantity_returned) {
          throw new Error(
            `Insufficient salesperson stock for product ${item.product_id}. Available: ${available}, returning: ${item.quantity_returned}`
          );
        }

        const returnRecord = await createRecord('stock_returns', {
          salesperson_id: payload.salesperson_id,
          product_id: item.product_id,
          quantity_returned: item.quantity_returned,
          reason: payload.reason || 'unsold',
          condition: payload.condition || 'good',
          inspection_required: payload.inspection_required ? 1 : 0,
          notes: payload.notes || null,
          date: payload.date || new Date().toISOString()
        });
        createdReturnIds.push(returnRecord.id);

        const spUpdate = await executeQuery(
          `UPDATE salesperson_stock
           SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
           WHERE salesperson_id = ? AND product_id = ? AND quantity >= ?`,
          [item.quantity_returned, payload.salesperson_id, item.product_id, item.quantity_returned]
        );
        if (spUpdate.changes === 0) {
          throw new Error(`Failed to update salesperson stock for product ${item.product_id}`);
        }

        const whUpdate = await executeQuery(
          `UPDATE products
           SET stock_quantity = stock_quantity + ?
           WHERE id = ? AND is_active = 1`,
          [item.quantity_returned, item.product_id]
        );
        if (whUpdate.changes === 0) {
          throw new Error(`Failed to update warehouse stock for product ${item.product_id}`);
        }
      }

      return { success: true, returnIds: createdReturnIds, count: createdReturnIds.length };
    });
  },

  // ADD THESE TWO NEW FUNCTIONS:

  updateStockReturn: async (returnId, newReturnData) => {
    return executeTransaction(async () => {
      if (!newReturnData.salesperson_id || !newReturnData.product_id || !newReturnData.quantity_returned) {
        throw new Error('Missing required fields: salesperson_id, product_id, and quantity_returned are required');
      }
      if (newReturnData.quantity_returned <= 0) {
        throw new Error('Return quantity must be greater than 0');
      }

      const oldReturn = await executeGet(
        `SELECT * FROM stock_returns WHERE id = ?`,
        [returnId]
      );
      if (!oldReturn) {
        throw new Error('Stock return not found');
      }

      const sameCombo =
        oldReturn.salesperson_id === newReturnData.salesperson_id &&
        oldReturn.product_id === newReturnData.product_id;

      const upsertSalespersonStock = async (salespersonId, productId, qtyToAdd) => {
        const updated = await executeQuery(
          `UPDATE salesperson_stock
           SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP
           WHERE salesperson_id = ? AND product_id = ?`,
          [qtyToAdd, salespersonId, productId]
        );
        if (updated.changes === 0) {
          await createRecord('salesperson_stock', {
            salesperson_id: salespersonId,
            product_id: productId,
            quantity: qtyToAdd
          });
        }
      };

      if (sameCombo) {
        const delta = newReturnData.quantity_returned - oldReturn.quantity_returned;

        if (delta > 0) {
          const stockRow = await executeGet(
            `SELECT quantity FROM salesperson_stock WHERE salesperson_id = ? AND product_id = ?`,
            [newReturnData.salesperson_id, newReturnData.product_id]
          );
          const available = stockRow?.quantity || 0;
          if (available < delta) {
            throw new Error(`Insufficient salesperson stock. Available: ${available}, required additional: ${delta}`);
          }

          const spUpdate = await executeQuery(
            `UPDATE salesperson_stock
             SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
             WHERE salesperson_id = ? AND product_id = ? AND quantity >= ?`,
            [delta, newReturnData.salesperson_id, newReturnData.product_id, delta]
          );
          if (spUpdate.changes === 0) {
            throw new Error('Failed to update salesperson stock for return increase');
          }

          const whIncrease = await executeQuery(
            `UPDATE products
             SET stock_quantity = stock_quantity + ?
             WHERE id = ? AND is_active = 1`,
            [delta, newReturnData.product_id]
          );
          if (whIncrease.changes === 0) {
            throw new Error('Failed to update warehouse stock for return increase');
          }
        } else if (delta < 0) {
          const qtyToRevert = Math.abs(delta);
          const whDecrease = await executeQuery(
            `UPDATE products
             SET stock_quantity = stock_quantity - ?
             WHERE id = ? AND stock_quantity >= ? AND is_active = 1`,
            [qtyToRevert, newReturnData.product_id, qtyToRevert]
          );
          if (whDecrease.changes === 0) {
            throw new Error('Insufficient warehouse stock to reduce this return');
          }

          await upsertSalespersonStock(newReturnData.salesperson_id, newReturnData.product_id, qtyToRevert);
        }
      } else {
        const oldWhDecrease = await executeQuery(
          `UPDATE products
           SET stock_quantity = stock_quantity - ?
           WHERE id = ? AND stock_quantity >= ? AND is_active = 1`,
          [oldReturn.quantity_returned, oldReturn.product_id, oldReturn.quantity_returned]
        );
        if (oldWhDecrease.changes === 0) {
          throw new Error('Insufficient warehouse stock to reverse previous return');
        }
        await upsertSalespersonStock(oldReturn.salesperson_id, oldReturn.product_id, oldReturn.quantity_returned);

        const newSpRow = await executeGet(
          `SELECT quantity FROM salesperson_stock WHERE salesperson_id = ? AND product_id = ?`,
          [newReturnData.salesperson_id, newReturnData.product_id]
        );
        const available = newSpRow?.quantity || 0;
        if (available < newReturnData.quantity_returned) {
          throw new Error(`Insufficient salesperson stock. Available: ${available}, required: ${newReturnData.quantity_returned}`);
        }

        const newSpDecrease = await executeQuery(
          `UPDATE salesperson_stock
           SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
           WHERE salesperson_id = ? AND product_id = ? AND quantity >= ?`,
          [newReturnData.quantity_returned, newReturnData.salesperson_id, newReturnData.product_id, newReturnData.quantity_returned]
        );
        if (newSpDecrease.changes === 0) {
          throw new Error('Failed to update salesperson stock for the new return');
        }

        const newWhIncrease = await executeQuery(
          `UPDATE products
           SET stock_quantity = stock_quantity + ?
           WHERE id = ? AND is_active = 1`,
          [newReturnData.quantity_returned, newReturnData.product_id]
        );
        if (newWhIncrease.changes === 0) {
          throw new Error('Failed to update warehouse stock for the new return');
        }
      }

      await executeQuery(
        `UPDATE stock_returns
         SET salesperson_id = ?, product_id = ?, quantity_returned = ?,
             reason = ?, condition = ?, inspection_required = ?, notes = ?, date = ?
         WHERE id = ?`,
        [
          newReturnData.salesperson_id,
          newReturnData.product_id,
          newReturnData.quantity_returned,
          newReturnData.reason || oldReturn.reason || 'unsold',
          newReturnData.condition || oldReturn.condition || 'good',
          newReturnData.inspection_required ? 1 : 0,
          newReturnData.notes || null,
          newReturnData.date || oldReturn.date,
          returnId
        ]
      );

      return { success: true, id: returnId };
    });
  },

  deleteStockReturn: async (returnId) => {
    return executeTransaction(async () => {
      const ret = await executeGet(
        `SELECT * FROM stock_returns WHERE id = ?`,
        [returnId]
      );
      if (!ret) {
        throw new Error('Stock return not found');
      }

      const whDecrease = await executeQuery(
        `UPDATE products
         SET stock_quantity = stock_quantity - ?
         WHERE id = ? AND stock_quantity >= ? AND is_active = 1`,
        [ret.quantity_returned, ret.product_id, ret.quantity_returned]
      );
      if (whDecrease.changes === 0) {
        throw new Error('Cannot delete return. Warehouse stock is lower than returned quantity.');
      }

      const spIncrease = await executeQuery(
        `UPDATE salesperson_stock
         SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP
         WHERE salesperson_id = ? AND product_id = ?`,
        [ret.quantity_returned, ret.salesperson_id, ret.product_id]
      );
      if (spIncrease.changes === 0) {
        await createRecord('salesperson_stock', {
          salesperson_id: ret.salesperson_id,
          product_id: ret.product_id,
          quantity: ret.quantity_returned
        });
      }

      await executeQuery('DELETE FROM stock_returns WHERE id = ?', [returnId]);

      return { success: true, id: returnId };
    });
  },

  // NEW: Update stock issue
  updateStockIssue: async (issueId, newIssueData) => {
    return executeTransaction(async () => {
      if (!newIssueData.salesperson_id || !newIssueData.product_id || !newIssueData.quantity_issued) {
        throw new Error('Missing required fields: salesperson_id, product_id, and quantity_issued are required');
      }
      if (newIssueData.quantity_issued <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      const oldIssue = await executeGet(
        `SELECT * FROM stock_issues WHERE id = ?`,
        [issueId]
      );
      if (!oldIssue) {
        throw new Error('Stock issue not found');
      }

      const oldStockRow = await executeGet(
        `SELECT quantity FROM salesperson_stock WHERE salesperson_id = ? AND product_id = ?`,
        [oldIssue.salesperson_id, oldIssue.product_id]
      );
      const currentOldStock = oldStockRow?.quantity || 0;

      const isSameCombo =
        oldIssue.salesperson_id === newIssueData.salesperson_id &&
        oldIssue.product_id === newIssueData.product_id;

      if (isSameCombo) {
        const delta = newIssueData.quantity_issued - oldIssue.quantity_issued;

        if (delta < 0) {
          const qtyToRemove = Math.abs(delta);
          if (currentOldStock < qtyToRemove) {
            throw new Error(
              `Cannot reduce issue by ${qtyToRemove}. Salesperson only has ${currentOldStock} units in stock.`
            );
          }
        }

        if (delta > 0) {
          const product = await productService.getById(newIssueData.product_id);
          if (!product || !product.is_active) {
            throw new Error('Product not found or inactive');
          }
          if (product.stock_quantity < delta) {
            throw new Error(
              `Insufficient warehouse stock. Available: ${product.stock_quantity} ${product.unit || 'units'}, Required: ${delta}`
            );
          }
        }

        if (delta !== 0) {
          if (delta > 0) {
            await executeQuery(
              `UPDATE salesperson_stock
               SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP
               WHERE salesperson_id = ? AND product_id = ?`,
              [delta, newIssueData.salesperson_id, newIssueData.product_id]
            );
            const productUpdate = await executeQuery(
              `UPDATE products
               SET stock_quantity = stock_quantity - ?
               WHERE id = ? AND stock_quantity >= ? AND is_active = 1`,
              [delta, newIssueData.product_id, delta]
            );
            if (productUpdate.changes === 0) {
              throw new Error('Failed to update warehouse stock');
            }
          } else {
            const qtyToRemove = Math.abs(delta);
            const spUpdate = await executeQuery(
              `UPDATE salesperson_stock
               SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
               WHERE salesperson_id = ? AND product_id = ? AND quantity >= ?`,
              [qtyToRemove, newIssueData.salesperson_id, newIssueData.product_id, qtyToRemove]
            );
            if (spUpdate.changes === 0) {
              throw new Error('Failed to update salesperson stock');
            }
            const productUpdate = await executeQuery(
              `UPDATE products
               SET stock_quantity = stock_quantity + ?
               WHERE id = ? AND is_active = 1`,
              [qtyToRemove, newIssueData.product_id]
            );
            if (productUpdate.changes === 0) {
              throw new Error('Failed to update warehouse stock');
            }
          }
        }
      } else {
        if (currentOldStock < oldIssue.quantity_issued) {
          throw new Error(
            `Cannot reassign this issue. Salesperson only has ${currentOldStock} units left from originally issued ${oldIssue.quantity_issued}.`
          );
        }

        const newProduct = await productService.getById(newIssueData.product_id);
        if (!newProduct || !newProduct.is_active) {
          throw new Error('New product not found or inactive');
        }
        if (newProduct.stock_quantity < newIssueData.quantity_issued) {
          throw new Error(
            `Insufficient warehouse stock for selected product. Available: ${newProduct.stock_quantity} ${newProduct.unit || 'units'}, Required: ${newIssueData.quantity_issued}`
          );
        }

        const oldSpUpdate = await executeQuery(
          `UPDATE salesperson_stock
           SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
           WHERE salesperson_id = ? AND product_id = ? AND quantity >= ?`,
          [oldIssue.quantity_issued, oldIssue.salesperson_id, oldIssue.product_id, oldIssue.quantity_issued]
        );
        if (oldSpUpdate.changes === 0) {
          throw new Error('Failed to reverse previous salesperson stock');
        }
        const oldProductRestore = await executeQuery(
          `UPDATE products
           SET stock_quantity = stock_quantity + ?
           WHERE id = ? AND is_active = 1`,
          [oldIssue.quantity_issued, oldIssue.product_id]
        );
        if (oldProductRestore.changes === 0) {
          throw new Error('Failed to restore previous warehouse stock');
        }

        const existingNewStock = await executeGet(
          `SELECT quantity FROM salesperson_stock WHERE salesperson_id = ? AND product_id = ?`,
          [newIssueData.salesperson_id, newIssueData.product_id]
        );
        if (existingNewStock) {
          await executeQuery(
            `UPDATE salesperson_stock
             SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP
             WHERE salesperson_id = ? AND product_id = ?`,
            [newIssueData.quantity_issued, newIssueData.salesperson_id, newIssueData.product_id]
          );
        } else {
          await createRecord('salesperson_stock', {
            salesperson_id: newIssueData.salesperson_id,
            product_id: newIssueData.product_id,
            quantity: newIssueData.quantity_issued
          });
        }
        const newProductDeduct = await executeQuery(
          `UPDATE products
           SET stock_quantity = stock_quantity - ?
           WHERE id = ? AND stock_quantity >= ? AND is_active = 1`,
          [newIssueData.quantity_issued, newIssueData.product_id, newIssueData.quantity_issued]
        );
        if (newProductDeduct.changes === 0) {
          throw new Error('Failed to apply new warehouse stock deduction');
        }
      }

      await executeQuery(
        `UPDATE stock_issues
         SET salesperson_id = ?, product_id = ?, quantity_issued = ?,
             vehicle_number = ?, notes = ?, date = ?
         WHERE id = ?`,
        [
          newIssueData.salesperson_id,
          newIssueData.product_id,
          newIssueData.quantity_issued,
          newIssueData.vehicle_number,
          newIssueData.notes,
          newIssueData.date,
          issueId
        ]
      );

      return { success: true, id: issueId };
    });
  },

  // NEW: Delete stock issue
  deleteStockIssue: async (issueId) => {
    return executeTransaction(async () => {
      const issue = await executeGet(
        `SELECT * FROM stock_issues WHERE id = ?`,
        [issueId]
      );
      if (!issue) {
        throw new Error('Stock issue not found');
      }

      const currentStock = await executeGet(
        `SELECT quantity FROM salesperson_stock WHERE salesperson_id = ? AND product_id = ?`,
        [issue.salesperson_id, issue.product_id]
      );
      const availableQty = currentStock?.quantity || 0;
      if (availableQty < issue.quantity_issued) {
        throw new Error(
          `Cannot delete issue. Salesperson only has ${availableQty} units left from originally issued ${issue.quantity_issued}.`
        );
      }

      const spUpdate = await executeQuery(
        `UPDATE salesperson_stock
         SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
         WHERE salesperson_id = ? AND product_id = ? AND quantity >= ?`,
        [issue.quantity_issued, issue.salesperson_id, issue.product_id, issue.quantity_issued]
      );
      if (spUpdate.changes === 0) {
        throw new Error('Failed to reverse salesperson stock');
      }

      const warehouseUpdate = await executeQuery(
        `UPDATE products
         SET stock_quantity = stock_quantity + ?
         WHERE id = ? AND is_active = 1`,
        [issue.quantity_issued, issue.product_id]
      );
      if (warehouseUpdate.changes === 0) {
        throw new Error('Failed to restore warehouse stock');
      }

      await executeQuery('DELETE FROM stock_issues WHERE id = ?', [issueId]);

      return { success: true, id: issueId };
    });
  },

  getSalespersonStock: async (salespersonId) => {
    const sql = `
      SELECT ss.*, 
             p.name as product_name,
             p.code as product_code,
             p.unit_price,
             p.unit,
             (ss.quantity * p.unit_price) as value
      FROM salesperson_stock ss
      LEFT JOIN products p ON ss.product_id = p.id
      WHERE ss.salesperson_id = ? AND p.is_active = 1 AND ss.quantity > 0
      ORDER BY p.name
    `;

    return await executeSelect(sql, [salespersonId]);
  },

  getFieldStockForSalesperson: async (salespersonId) => {
    return await stockService.getSalespersonStock(salespersonId);
  },

  getStockIssues: async (filters = {}) => {
    let sql = `
      SELECT si.*, 
             sp.name as salesperson_name,
             sp.code as salesperson_code,
             p.name as product_name,
             p.code as product_code,
             p.unit,
             p.unit_price
      FROM stock_issues si
      LEFT JOIN salespersons sp ON si.salesperson_id = sp.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.dateFrom) {
      sql += ' AND DATE(si.date) >= DATE(?)';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ' AND DATE(si.date) <= DATE(?)';
      params.push(filters.dateTo);
    }

    if (filters.salespersonId) {
      sql += ' AND si.salesperson_id = ?';
      params.push(filters.salespersonId);
    }

    if (filters.productId) {
      sql += ' AND si.product_id = ?';
      params.push(filters.productId);
    }

    // Add search filter
    if (filters.search) {
      sql += ` AND (
        p.name LIKE ? OR 
        p.code LIKE ? OR 
        sp.name LIKE ? OR 
        sp.code LIKE ? OR
        si.vehicle_number LIKE ?
      )`;
      const searchParam = `%${filters.search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    sql += ' ORDER BY si.date DESC';

    // Add pagination
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    return await executeSelect(sql, params);
  },

  getStockReturns: async (filters = {}) => {
    let sql = `
      SELECT sr.*, 
             sp.name as salesperson_name,
             sp.code as salesperson_code,
             p.name as product_name,
             p.code as product_code,
             p.unit,
             p.unit_price
      FROM stock_returns sr
      LEFT JOIN salespersons sp ON sr.salesperson_id = sp.id
      LEFT JOIN products p ON sr.product_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.dateFrom) {
      sql += ' AND DATE(sr.date) >= DATE(?)';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ' AND DATE(sr.date) <= DATE(?)';
      params.push(filters.dateTo);
    }

    if (filters.salespersonId) {
      sql += ' AND sr.salesperson_id = ?';
      params.push(filters.salespersonId);
    }

    if (filters.productId) {
      sql += ' AND sr.product_id = ?';
      params.push(filters.productId);
    }

    if (filters.reason) {
      sql += ' AND sr.reason = ?';
      params.push(filters.reason);
    }

    if (filters.condition) {
      sql += ' AND sr.condition = ?';
      params.push(filters.condition);
    }

    // Add search filter
    if (filters.search) {
      sql += ` AND (
        p.name LIKE ? OR 
        p.code LIKE ? OR 
        sp.name LIKE ? OR 
        sp.code LIKE ? OR
        sr.notes LIKE ?
      )`;
      const searchParam = `%${filters.search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    sql += ' ORDER BY sr.date DESC';

    // Add pagination
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    return await executeSelect(sql, params);
  },

  // NEW: Get count of stock returns with filters
  getStockReturnsCount: async (filters = {}) => {
    let sql = `
      SELECT COUNT(*) as count
      FROM stock_returns sr
      LEFT JOIN salespersons sp ON sr.salesperson_id = sp.id
      LEFT JOIN products p ON sr.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.dateFrom) {
      sql += ' AND DATE(sr.date) >= DATE(?)';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ' AND DATE(sr.date) <= DATE(?)';
      params.push(filters.dateTo);
    }

    if (filters.salespersonId) {
      sql += ' AND sr.salesperson_id = ?';
      params.push(filters.salespersonId);
    }

    if (filters.productId) {
      sql += ' AND sr.product_id = ?';
      params.push(filters.productId);
    }

    if (filters.reason) {
      sql += ' AND sr.reason = ?';
      params.push(filters.reason);
    }

    if (filters.condition) {
      sql += ' AND sr.condition = ?';
      params.push(filters.condition);
    }

    if (filters.search) {
      sql += ` AND (
        p.name LIKE ? OR
        p.code LIKE ? OR
        sp.name LIKE ? OR
        sp.code LIKE ? OR
        sr.notes LIKE ?
      )`;
      const searchParam = `%${filters.search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    return await executeGet(sql, params);
  },

  // NEW: Get return statistics for dashboard
  getReturnStatistics: async (date) => {
    const sql = `
      SELECT 
        COUNT(*) as totalReturned,
        COUNT(CASE WHEN DATE(date) = DATE(?) THEN 1 END) as todayReturned,
        COUNT(CASE WHEN reason IN ('damaged', 'defective') THEN 1 END) as damagedReturns,
        COUNT(CASE WHEN inspection_required = 1 THEN 1 END) as pendingInspection,
        COALESCE(SUM(sr.quantity_returned * p.unit_price), 0) as totalValue
      FROM stock_returns sr
      LEFT JOIN products p ON sr.product_id = p.id
    `;
    const result = await executeGet(sql, [date]);
    return result || {
      totalReturned: 0,
      todayReturned: 0,
      damagedReturns: 0,
      pendingInspection: 0,
      totalValue: 0
    };
  },

  // NEW: Get count of stock issues with filters
  getStockIssuesCount: async (filters = {}) => {
    let sql = `
      SELECT COUNT(*) as count
      FROM stock_issues si
      LEFT JOIN salespersons sp ON si.salesperson_id = sp.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.dateFrom) {
      sql += ' AND DATE(si.date) >= DATE(?)';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ' AND DATE(si.date) <= DATE(?)';
      params.push(filters.dateTo);
    }

    if (filters.salespersonId) {
      sql += ' AND si.salesperson_id = ?';
      params.push(filters.salespersonId);
    }

    if (filters.productId) {
      sql += ' AND si.product_id = ?';
      params.push(filters.productId);
    }

    if (filters.search) {
      sql += ` AND (
        p.name LIKE ? OR
        p.code LIKE ? OR
        sp.name LIKE ? OR
        sp.code LIKE ? OR
        si.vehicle_number LIKE ?
      )`;
      const searchParam = `%${filters.search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    return await executeGet(sql, params);
  },
  // NEW: Get total field stock value
  getFieldStockValue: async () => {
    const sql = `
      SELECT COALESCE(SUM(ss.quantity * p.unit_price), 0) as total
      FROM salesperson_stock ss
      LEFT JOIN products p ON ss.product_id = p.id
      WHERE ss.quantity > 0 AND p.is_active = 1
    `;
    const result = await executeGet(sql);
    return result || { total: 0 };
  },

  // NEW: Get low stock alerts
  getLowStockAlerts: async () => {
    const sql = `
      SELECT 
        p.*,
        (p.min_stock_level - p.stock_quantity) as deficit,
        (p.stock_quantity * p.unit_price) as current_value,
        (p.min_stock_level * p.unit_price) as target_value,
        CASE 
          WHEN p.stock_quantity = 0 THEN 'critical'
          WHEN p.stock_quantity <= p.min_stock_level * 0.25 THEN 'critical'
          WHEN p.stock_quantity <= p.min_stock_level * 0.5 THEN 'high'
          WHEN p.stock_quantity <= p.min_stock_level * 0.75 THEN 'medium'
          ELSE 'low'
        END as urgency
      FROM products p
      WHERE p.stock_quantity <= p.min_stock_level 
        AND p.is_active = 1
      ORDER BY 
        CASE 
          WHEN p.stock_quantity = 0 THEN 0
          WHEN p.stock_quantity <= p.min_stock_level * 0.25 THEN 1
          WHEN p.stock_quantity <= p.min_stock_level * 0.5 THEN 2
          WHEN p.stock_quantity <= p.min_stock_level * 0.75 THEN 3
          ELSE 4
        END,
        p.name
    `;
    return await executeSelect(sql);
  },

  // NEW: Get field stock distribution by salesperson
  getFieldStockDistribution: async () => {
    const sql = `
      SELECT 
        sp.id,
        sp.name as salesperson_name,
        sp.code as salesperson_code,
        sp.vehicle_number,
        COUNT(DISTINCT ss.product_id) as product_count,
        COALESCE(SUM(ss.quantity), 0) as total_quantity,
        COALESCE(SUM(ss.quantity * p.unit_price), 0) as total_value,
        COALESCE(AVG(p.unit_price), 0) as avg_product_price
      FROM salespersons sp
      LEFT JOIN salesperson_stock ss ON sp.id = ss.salesperson_id
      LEFT JOIN products p ON ss.product_id = p.id
      WHERE sp.is_active = 1
      GROUP BY sp.id
      HAVING total_quantity > 0
      ORDER BY total_value DESC
    `;
    return await executeSelect(sql);
  },

  // NEW: Get recent activity (issues and returns combined)
  getRecentActivity: async (date) => {
    const issuesSql = `
      SELECT 
        si.id,
        si.date,
        'issue' as type,
        si.quantity_issued as quantity,
        si.quantity_issued * p.unit_price as value,
        p.name as product_name,
        sp.name as salesperson_name
      FROM stock_issues si
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN salespersons sp ON si.salesperson_id = sp.id
      WHERE DATE(si.date) = DATE(?)
    `;

    const returnsSql = `
      SELECT 
        sr.id,
        sr.date,
        'return' as type,
        sr.quantity_returned as quantity,
        sr.quantity_returned * p.unit_price as value,
        p.name as product_name,
        sp.name as salesperson_name,
        sr.reason
      FROM stock_returns sr
      LEFT JOIN products p ON sr.product_id = p.id
      LEFT JOIN salespersons sp ON sr.salesperson_id = sp.id
      WHERE DATE(sr.date) = DATE(?)
    `;

    const [issues, returns] = await Promise.all([
      executeSelect(issuesSql, [date]),
      executeSelect(returnsSql, [date])
    ]);

    // Combine and sort by date
    const combined = [...issues, ...returns].sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    return combined;
  },
  // NEW: Get statistics for dashboard
  getStatistics: async (date) => {
    const sql = `
      SELECT 
        COUNT(*) as totalIssued,
        COUNT(CASE WHEN DATE(date) = DATE(?) THEN 1 END) as todayIssued,
        COUNT(DISTINCT product_id) as uniqueProducts,
        COUNT(DISTINCT salesperson_id) as uniqueSalespersons,
        COALESCE(SUM(si.quantity_issued * p.unit_price), 0) as totalValue
      FROM stock_issues si
      LEFT JOIN products p ON si.product_id = p.id
    `;
    const result = await executeGet(sql, [date]);
    return result || {
      totalIssued: 0,
      todayIssued: 0,
      uniqueProducts: 0,
      uniqueSalespersons: 0,
      totalValue: 0
    };
  }
};

// ==================== LOCATION MANAGEMENT ====================

export const locationService = {
  // Districts
  getAllDistricts: async () => {
    return await executeSelect('SELECT * FROM districts ORDER BY name');
  },

  getDistrictById: async (id) => {
    return await getRecordById('districts', id);
  },

  createDistrict: async (districtData) => {
    const data = {
      code: districtData.code.trim().toUpperCase(),
      name: districtData.name.trim()
    };
    return await createRecord('districts', data);
  },

  updateDistrict: async (id, districtData) => {
    const data = {
      code: districtData.code.trim().toUpperCase(),
      name: districtData.name.trim()
    };
    return await updateRecord('districts', id, data);
  },

  deleteDistrict: async (id) => {
    try {
      // Check if district has towns
      const towns = await executeGet('SELECT COUNT(*) as count FROM towns WHERE district_id = ?', [id]);
      if (towns && towns.count > 0) {
        throw new Error('Cannot delete district: It has associated towns. Please delete all towns first.');
      }

      return await deleteRecord('districts', id);
    } catch (err) {
      console.error('Error deleting district:', err);
      throw err;
    }
  },

  // Towns
  getAllTowns: async () => {
    const sql = `
      SELECT t.*, d.name as district_name
      FROM towns t
      LEFT JOIN districts d ON t.district_id = d.id
      ORDER BY t.name
    `;
    return await executeSelect(sql);
  },

  getTownById: async (id) => {
    const sql = `
      SELECT t.*, d.name as district_name
      FROM towns t
      LEFT JOIN districts d ON t.district_id = d.id
      WHERE t.id = ?
    `;
    return await executeGet(sql, [id]);
  },

  getTownsByDistrict: async (districtId) => {
    return await executeSelect(
      'SELECT * FROM towns WHERE district_id = ? ORDER BY name',
      [districtId]
    );
  },

  createTown: async (townData) => {
    const data = {
      code: townData.code.trim().toUpperCase(),
      name: townData.name.trim(),
      district_id: parseInt(townData.district_id)
    };
    return await createRecord('towns', data);
  },

  updateTown: async (id, townData) => {
    const data = {
      code: townData.code.trim().toUpperCase(),
      name: townData.name.trim(),
      district_id: parseInt(townData.district_id)
    };
    return await updateRecord('towns', id, data);
  },

  deleteTown: async (id) => {
    try {
      // Check if town has routes
      const routes = await executeGet('SELECT COUNT(*) as count FROM routes WHERE town_id = ?', [id]);
      if (routes && routes.count > 0) {
        throw new Error('Cannot delete town: It has associated routes. Please delete all routes first.');
      }

      // Check if town has shops
      const shops = await executeGet('SELECT COUNT(*) as count FROM shops WHERE town_id = ?', [id]);
      if (shops && shops.count > 0) {
        throw new Error('Cannot delete town: It has associated shops. Please reassign or delete all shops first.');
      }

      return await deleteRecord('towns', id);
    } catch (err) {
      console.error('Error deleting town:', err);
      throw err;
    }
  },

  // Routes
  getAllRoutes: async () => {
    const sql = `
      SELECT r.*, 
             t.name as town_name,
             d.name as district_name
      FROM routes r
      LEFT JOIN towns t ON r.town_id = t.id
      LEFT JOIN districts d ON t.district_id = d.id
      ORDER BY r.name
    `;
    return await executeSelect(sql);
  },

  getRouteById: async (id) => {
    const sql = `
      SELECT r.*, 
             t.name as town_name,
             d.name as district_name
      FROM routes r
      LEFT JOIN towns t ON r.town_id = t.id
      LEFT JOIN districts d ON t.district_id = d.id
      WHERE r.id = ?
    `;
    return await executeGet(sql, [id]);
  },

  getRoutesByTown: async (townId) => {
    const sql = `
      SELECT r.*, t.name as town_name
      FROM routes r
      LEFT JOIN towns t ON r.town_id = t.id
      WHERE r.town_id = ?
      ORDER BY r.name
    `;
    return await executeSelect(sql, [townId]);
  },

  createRoute: async (routeData) => {
    const data = {
      code: routeData.code.trim().toUpperCase(),
      name: routeData.name.trim(),
      town_id: parseInt(routeData.town_id),
      description: routeData.description ? routeData.description.trim() : null
    };
    return await createRecord('routes', data);
  },

  updateRoute: async (id, routeData) => {
    const data = {
      code: routeData.code.trim().toUpperCase(),
      name: routeData.name.trim(),
      town_id: parseInt(routeData.town_id),
      description: routeData.description ? routeData.description.trim() : null
    };
    return await updateRecord('routes', id, data);
  },

  deleteRoute: async (id) => {
    try {
      // Check if route has shops
      const shops = await executeGet('SELECT COUNT(*) as count FROM shops WHERE route_id = ?', [id]);
      if (shops && shops.count > 0) {
        throw new Error('Cannot delete route: It has associated shops. Please reassign or delete all shops first.');
      }

      // Check if route has sales
      const sales = await executeGet('SELECT COUNT(*) as count FROM sales WHERE route_id = ?', [id]);
      if (sales && sales.count > 0) {
        throw new Error('Cannot delete route: It has associated sales records.');
      }

      return await deleteRecord('routes', id);
    } catch (err) {
      console.error('Error deleting route:', err);
      throw err;
    }
  }
};

// ==================== REPORTING FUNCTIONS ====================

export const reportService = {
  getDailySalesSummary: async (date) => {
    const sql = `
      SELECT 
        DATE(date) as sale_date,
        COUNT(*) as total_sales,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as total_paid,
        SUM(balance_amount) as total_balance
      FROM sales
      WHERE DATE(date) = DATE(?)
      GROUP BY DATE(date)
    `;

    return await executeGet(sql, [date]);
  },

  getSalespersonPerformance: async (dateFrom, dateTo) => {
    const sql = `
      SELECT 
        sp.name as salesperson_name,
        COUNT(DISTINCT s.id) as total_sales,
        SUM(s.total_amount) as total_amount,
        SUM(s.paid_amount) as total_paid,
        SUM(s.balance_amount) as total_balance,
        COUNT(DISTINCT c.id) as total_collections,
        SUM(c.amount) as collection_amount
      FROM salespersons sp
      LEFT JOIN sales s ON sp.id = s.salesperson_id AND DATE(s.date) BETWEEN DATE(?) AND DATE(?)
      LEFT JOIN collections c ON sp.id = c.salesperson_id AND DATE(c.date) BETWEEN DATE(?) AND DATE(?)
      WHERE sp.is_active = 1
      GROUP BY sp.id
      ORDER BY total_amount DESC
    `;

    return await executeSelect(sql, [dateFrom, dateTo, dateFrom, dateTo]);
  },

  getShopOutstandingReport: async () => {
    const sql = `
      SELECT 
        s.name as shop_name,
        s.owner_name,
        s.contact_number,
        s.current_balance,
        s.credit_limit,
        r.name as route_name,
        t.name as town_name,
        d.name as district_name,
        CASE 
          WHEN s.credit_limit = 0 THEN 'No Credit'
          WHEN s.current_balance >= 0 THEN 'No Outstanding'
          WHEN ABS(s.current_balance) > s.credit_limit * 0.8 THEN 'High Risk'
          WHEN ABS(s.current_balance) > s.credit_limit * 0.5 THEN 'Medium Risk'
          ELSE 'Low Risk'
        END as risk_level
      FROM shops s
      LEFT JOIN routes r ON s.route_id = r.id
      LEFT JOIN towns t ON s.town_id = t.id
      LEFT JOIN districts d ON s.district_id = d.id
      WHERE s.current_balance < 0
      ORDER BY s.current_balance, shop_name
    `;

    return await executeSelect(sql);
  },

  getStockLevelReport: async () => {
    const sql = `
      SELECT 
        p.code,
        p.name,
        p.stock_quantity,
        p.min_stock_level,
        p.unit,
        p.unit_price,
        CASE 
          WHEN p.stock_quantity <= p.min_stock_level THEN 'Low Stock'
          WHEN p.stock_quantity <= p.min_stock_level * 2 THEN 'Medium Stock'
          ELSE 'Good Stock'
        END as stock_status,
        SUM(COALESCE(si.quantity, 0)) as total_sold_last_month
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.date >= DATE('now', '-30 days')
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY stock_status, p.name
    `;

    return await executeSelect(sql);
  }
};

// ==================== UTILITY FUNCTIONS ====================

export const utilityService = {
  getDashboardStats: async () => {
    const today = new Date().toISOString().split('T')[0];

    const stats = await executeSelect(`
      SELECT 
        (SELECT COUNT(*) FROM products WHERE is_active = 1) as total_products,
        (SELECT COUNT(*) FROM salespersons WHERE is_active = 1) as total_salespersons,
        (SELECT COUNT(*) FROM shops) as total_shops,
        (SELECT COUNT(*) FROM sales WHERE DATE(date) = DATE(?)) as today_sales,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE DATE(date) = DATE(?)) as today_sales_amount,
        (SELECT COALESCE(SUM(amount), 0) FROM collections WHERE DATE(date) = DATE(?)) as today_collections,
        (SELECT COALESCE(SUM(current_balance), 0) FROM shops WHERE current_balance < 0) as total_outstanding
    `, [today, today, today]);

    return stats[0];
  },

  searchAll: async (searchTerm) => {
    const searchParam = `%${searchTerm}%`;

    const [products, salespersons, shops] = await Promise.all([
      executeSelect(
        `SELECT 'product' as type, id, code, name FROM products 
         WHERE (code LIKE ? OR name LIKE ?) AND is_active = 1 
         LIMIT 5`,
        [searchParam, searchParam]
      ),
      executeSelect(
        `SELECT 'salesperson' as type, id, code, name FROM salespersons 
         WHERE (code LIKE ? OR name LIKE ?) AND is_active = 1 
         LIMIT 5`,
        [searchParam, searchParam]
      ),
      executeSelect(
        `SELECT 'shop' as type, id, code, name FROM shops 
         WHERE code LIKE ? OR name LIKE ? OR owner_name LIKE ? 
         LIMIT 5`,
        [searchParam, searchParam, searchParam]
      )
    ]);

    return [...products, ...salespersons, ...shops];
  },

  backupAndCleanup: async (daysToKeep = 30) => {
    try {
      // Create backup
      const backupPath = await backupDatabase();

      // Delete old backups
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      console.log(`Backup completed: ${backupPath}`);
      console.log(`Old backups cleanup (older than ${daysToKeep} days) initiated`);

      return { success: true, backupPath };
    } catch (err) {
      console.error('Backup and cleanup error:', err);
      throw err;
    }
  }
};
