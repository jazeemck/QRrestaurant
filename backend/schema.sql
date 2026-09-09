-- QR Restaurant Ordering System — PostgreSQL schema

CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE tables (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number INT NOT NULL,
    qr_code_url TEXT, -- e.g. https://yourapp.com/r/1/t/5
    UNIQUE (restaurant_id, table_number)
);

CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT, -- e.g. 'Starters', 'Main Course', 'Beverages'
    image_url TEXT,
    is_available BOOLEAN DEFAULT true, -- the "mark as sold out" toggle
    created_at TIMESTAMP DEFAULT now()
);

-- Groups all orders placed by a table during one sitting
CREATE TABLE table_sessions (
    id SERIAL PRIMARY KEY,
    table_id INT REFERENCES tables(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT now(),
    ended_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES table_sessions(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'placed', -- placed | preparing | ready | delivered
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INT REFERENCES menu_items(id),
    quantity INT DEFAULT 1,
    note TEXT, -- e.g. "no sugar in tea"
    status TEXT DEFAULT 'placed' -- allows per-item tracking if needed later
);

CREATE TABLE staff_calls (
    id SERIAL PRIMARY KEY,
    table_id INT REFERENCES tables(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now(),
    resolved BOOLEAN DEFAULT false
);
