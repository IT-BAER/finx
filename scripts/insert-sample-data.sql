-- Sample Data Insertion Script for FinX
-- All data is marked as is_sample = true for easy removal

-- First, add more sample categories
INSERT INTO categories (user_id, name, is_sample) VALUES 
(1, 'Gesundheit', true),      -- Health
(1, 'Bildung', true),          -- Education
(1, 'Kleidung', true),         -- Clothing
(1, 'Haushalt', true),         -- Household
(1, 'Freizeit', true),         -- Leisure
(1, 'Versicherung', true),     -- Insurance
(1, 'Sparen', true)            -- Savings
ON CONFLICT (user_id, name) DO NOTHING;

-- Add more sample sources (income sources)
INSERT INTO sources (user_id, name, is_sample) VALUES 
(1, 'Freiberuflich', true),    -- Freelance
(1, 'Nebenjob', true),         -- Side job
(1, 'Dividenden', true),       -- Dividends
(1, 'Miete', true),            -- Rent income
(1, 'Geschenk', true)          -- Gift
ON CONFLICT (user_id, name) DO NOTHING;

-- Add more sample targets (expense destinations)
INSERT INTO targets (user_id, name, is_sample) VALUES 
(1, 'Apotheke', true),         -- Pharmacy
(1, 'Arzt', true),             -- Doctor
(1, 'Fitnessstudio', true),    -- Gym
(1, 'Online-Shop', true),      -- Online shop
(1, 'Versicherung', true),     -- Insurance
(1, 'Telefon', true),          -- Phone
(1, 'Internet', true),         -- Internet
(1, 'Miete', true),            -- Rent
(1, 'Sparbuch', true),         -- Savings account
(1, 'Buchhandlung', true),     -- Bookstore
(1, 'Streaming', true),        -- Streaming service
(1, 'Baumarkt', true),         -- Hardware store
(1, 'Möbelhaus', true)         -- Furniture store
ON CONFLICT (user_id, name) DO NOTHING;

-- Now insert many sample transactions spanning the past 12 months
-- Using various categories, amounts, and dates for realistic data

-- Helper: Generate dates across the past 365 days
-- We'll create transactions for each month

-- =============================
-- CURRENT MONTH (last 30 days)
-- =============================

-- Income transactions
INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3200.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '1 day', true),
(1, (SELECT id FROM categories WHERE name = 'Freizeit' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Freiberuflich' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 450.00, 'income', 'Freelance Webdesign Projekt', CURRENT_DATE - INTERVAL '5 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Dividenden' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 85.50, 'income', 'Quartalsdividende ETF', CURRENT_DATE - INTERVAL '10 days', true);

-- Expense transactions - Current month
INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 78.45, 'expense', 'Wocheneinkauf Lebensmittel', CURRENT_DATE - INTERVAL '2 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Restaurant' AND user_id = 1), 42.80, 'expense', 'Mittagessen mit Kollegen', CURRENT_DATE - INTERVAL '3 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Tankstelle' AND user_id = 1), 65.00, 'expense', 'Volltanken', CURRENT_DATE - INTERVAL '4 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'ÖPNV' AND user_id = 1), 49.00, 'expense', 'Monatskarte ÖPNV', CURRENT_DATE - INTERVAL '1 day', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Monatsmiete Wohnung', CURRENT_DATE - INTERVAL '1 day', true),
(1, (SELECT id FROM categories WHERE name = 'Versorgung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Energieversorger' AND user_id = 1), 95.00, 'expense', 'Stromrechnung', CURRENT_DATE - INTERVAL '6 days', true),
(1, (SELECT id FROM categories WHERE name = 'Versorgung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Internet' AND user_id = 1), 39.99, 'expense', 'Internet-Anschluss', CURRENT_DATE - INTERVAL '7 days', true),
(1, (SELECT id FROM categories WHERE name = 'Versorgung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Telefon' AND user_id = 1), 29.99, 'expense', 'Handyvertrag', CURRENT_DATE - INTERVAL '7 days', true),
(1, (SELECT id FROM categories WHERE name = 'Unterhaltung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Streaming' AND user_id = 1), 12.99, 'expense', 'Netflix Abo', CURRENT_DATE - INTERVAL '8 days', true),
(1, (SELECT id FROM categories WHERE name = 'Unterhaltung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Kino' AND user_id = 1), 24.00, 'expense', 'Kinobesuch mit Partner', CURRENT_DATE - INTERVAL '9 days', true),
(1, (SELECT id FROM categories WHERE name = 'Gesundheit' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Fitnessstudio' AND user_id = 1), 35.00, 'expense', 'Fitnessstudio Monatsbeitrag', CURRENT_DATE - INTERVAL '1 day', true),
(1, (SELECT id FROM categories WHERE name = 'Gesundheit' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Apotheke' AND user_id = 1), 18.50, 'expense', 'Medikamente', CURRENT_DATE - INTERVAL '12 days', true),
(1, (SELECT id FROM categories WHERE name = 'Einkaufen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Online-Shop' AND user_id = 1), 67.99, 'expense', 'Amazon Bestellung', CURRENT_DATE - INTERVAL '14 days', true),
(1, (SELECT id FROM categories WHERE name = 'Kleidung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Online-Shop' AND user_id = 1), 89.90, 'expense', 'Neue Schuhe', CURRENT_DATE - INTERVAL '16 days', true),
(1, (SELECT id FROM categories WHERE name = 'Versicherung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Versicherung' AND user_id = 1), 125.00, 'expense', 'KFZ-Versicherung', CURRENT_DATE - INTERVAL '15 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 300.00, 'expense', 'Monatliche Spareinlage', CURRENT_DATE - INTERVAL '1 day', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 52.30, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '9 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 61.75, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '16 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 45.20, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '23 days', true);

-- =============================
-- LAST MONTH (30-60 days ago)
-- =============================

INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3200.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '31 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Monatsmiete Wohnung', CURRENT_DATE - INTERVAL '31 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 82.15, 'expense', 'Großeinkauf', CURRENT_DATE - INTERVAL '32 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 56.40, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '38 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 71.25, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '45 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 48.90, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '52 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Restaurant' AND user_id = 1), 38.50, 'expense', 'Abendessen auswärts', CURRENT_DATE - INTERVAL '35 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Tankstelle' AND user_id = 1), 58.00, 'expense', 'Benzin', CURRENT_DATE - INTERVAL '40 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'ÖPNV' AND user_id = 1), 49.00, 'expense', 'Monatskarte', CURRENT_DATE - INTERVAL '31 days', true),
(1, (SELECT id FROM categories WHERE name = 'Versorgung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Energieversorger' AND user_id = 1), 92.00, 'expense', 'Stromrechnung', CURRENT_DATE - INTERVAL '36 days', true),
(1, (SELECT id FROM categories WHERE name = 'Unterhaltung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Streaming' AND user_id = 1), 12.99, 'expense', 'Netflix', CURRENT_DATE - INTERVAL '38 days', true),
(1, (SELECT id FROM categories WHERE name = 'Gesundheit' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Fitnessstudio' AND user_id = 1), 35.00, 'expense', 'Fitnessstudio', CURRENT_DATE - INTERVAL '31 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 300.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '31 days', true),
(1, (SELECT id FROM categories WHERE name = 'Einkaufen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Baumarkt' AND user_id = 1), 127.50, 'expense', 'Werkzeug und Material', CURRENT_DATE - INTERVAL '42 days', true);

-- =============================
-- 2 MONTHS AGO (60-90 days)
-- =============================

INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3200.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '61 days', true),
(1, (SELECT id FROM categories WHERE name = 'Freizeit' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Nebenjob' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 250.00, 'income', 'Nebeneinkommen', CURRENT_DATE - INTERVAL '70 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '61 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 68.30, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '62 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 55.80, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '69 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 72.45, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '76 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 49.90, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '83 days', true),
(1, (SELECT id FROM categories WHERE name = 'Unterhaltung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Veranstaltungsort' AND user_id = 1), 85.00, 'expense', 'Konzertkarten', CURRENT_DATE - INTERVAL '75 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Tankstelle' AND user_id = 1), 62.50, 'expense', 'Benzin', CURRENT_DATE - INTERVAL '72 days', true),
(1, (SELECT id FROM categories WHERE name = 'Versorgung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Energieversorger' AND user_id = 1), 88.00, 'expense', 'Strom', CURRENT_DATE - INTERVAL '66 days', true),
(1, (SELECT id FROM categories WHERE name = 'Gesundheit' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Arzt' AND user_id = 1), 45.00, 'expense', 'Arztbesuch', CURRENT_DATE - INTERVAL '78 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 300.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '61 days', true);

-- =============================
-- 3 MONTHS AGO (90-120 days)
-- =============================

INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3200.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '91 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '91 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 64.20, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '92 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 58.75, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '99 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 76.30, 'expense', 'Großeinkauf', CURRENT_DATE - INTERVAL '106 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 42.15, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '113 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Tankstelle' AND user_id = 1), 55.00, 'expense', 'Benzin', CURRENT_DATE - INTERVAL '100 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'ÖPNV' AND user_id = 1), 49.00, 'expense', 'Monatskarte', CURRENT_DATE - INTERVAL '91 days', true),
(1, (SELECT id FROM categories WHERE name = 'Kleidung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Online-Shop' AND user_id = 1), 149.99, 'expense', 'Winterjacke', CURRENT_DATE - INTERVAL '95 days', true),
(1, (SELECT id FROM categories WHERE name = 'Versicherung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Versicherung' AND user_id = 1), 89.00, 'expense', 'Hausratversicherung', CURRENT_DATE - INTERVAL '105 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 300.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '91 days', true);

-- =============================
-- 4 MONTHS AGO (120-150 days)
-- =============================

INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3200.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '121 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Dividenden' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 92.30, 'income', 'Quartalsdividende', CURRENT_DATE - INTERVAL '130 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '121 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 69.80, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '122 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 53.40, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '129 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 67.25, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '136 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 44.90, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '143 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Tankstelle' AND user_id = 1), 60.00, 'expense', 'Benzin', CURRENT_DATE - INTERVAL '135 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Möbelhaus' AND user_id = 1), 299.00, 'expense', 'Neuer Schreibtischstuhl', CURRENT_DATE - INTERVAL '140 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 300.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '121 days', true);

-- =============================
-- 5 MONTHS AGO (150-180 days)
-- =============================

INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3200.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '151 days', true),
(1, (SELECT id FROM categories WHERE name = 'Freizeit' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Geschenk' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 200.00, 'income', 'Geburtstagsgeschenk', CURRENT_DATE - INTERVAL '160 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '151 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 74.50, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '152 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 61.20, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '159 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 55.80, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '166 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 68.30, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '173 days', true),
(1, (SELECT id FROM categories WHERE name = 'Unterhaltung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Restaurant' AND user_id = 1), 95.00, 'expense', 'Geburtstagsessen', CURRENT_DATE - INTERVAL '160 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Tankstelle' AND user_id = 1), 58.00, 'expense', 'Benzin', CURRENT_DATE - INTERVAL '165 days', true),
(1, (SELECT id FROM categories WHERE name = 'Bildung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Buchhandlung' AND user_id = 1), 45.90, 'expense', 'Fachbücher', CURRENT_DATE - INTERVAL '170 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 300.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '151 days', true);

-- =============================
-- 6 MONTHS AGO (180-210 days)
-- =============================

INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3200.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '181 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '181 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 72.40, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '182 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 58.60, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '189 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 65.20, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '196 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 51.80, 'expense', 'Wocheneinkauf', CURRENT_DATE - INTERVAL '203 days', true),
(1, (SELECT id FROM categories WHERE name = 'Versorgung' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Energieversorger' AND user_id = 1), 105.00, 'expense', 'Strom (Jahresabrechnung)', CURRENT_DATE - INTERVAL '190 days', true),
(1, (SELECT id FROM categories WHERE name = 'Transport' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Tankstelle' AND user_id = 1), 62.00, 'expense', 'Benzin', CURRENT_DATE - INTERVAL '195 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 300.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '181 days', true);

-- =============================
-- OLDER MONTHS (7-12 months ago)
-- =============================

-- 7 months ago
INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3150.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '211 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '211 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 245.00, 'expense', 'Monatsausgaben Lebensmittel', CURRENT_DATE - INTERVAL '220 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 250.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '211 days', true);

-- 8 months ago
INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3150.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '241 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '241 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 238.50, 'expense', 'Monatsausgaben Lebensmittel', CURRENT_DATE - INTERVAL '250 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 250.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '241 days', true),
(1, (SELECT id FROM categories WHERE name = 'Urlaub' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Online-Shop' AND user_id = 1), 450.00, 'expense', 'Urlaubsbuchung', CURRENT_DATE - INTERVAL '255 days', true);

-- Add Urlaub category if it doesn't exist
INSERT INTO categories (user_id, name, is_sample) VALUES (1, 'Urlaub', true) ON CONFLICT (user_id, name) DO NOTHING;

-- 9 months ago
INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3150.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '271 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '271 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 252.30, 'expense', 'Monatsausgaben Lebensmittel', CURRENT_DATE - INTERVAL '280 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 250.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '271 days', true);

-- 10 months ago
INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3100.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '301 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '301 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 231.80, 'expense', 'Monatsausgaben Lebensmittel', CURRENT_DATE - INTERVAL '310 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 200.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '301 days', true);

-- 11 months ago
INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3100.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '331 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '331 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 248.60, 'expense', 'Monatsausgaben Lebensmittel', CURRENT_DATE - INTERVAL '340 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 200.00, 'expense', 'Spareinlage', CURRENT_DATE - INTERVAL '331 days', true);

-- 12 months ago
INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 3100.00, 'income', 'Monatsgehalt', CURRENT_DATE - INTERVAL '361 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Arbeitgeber' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Bank' AND user_id = 1), 1500.00, 'income', 'Weihnachtsgeld', CURRENT_DATE - INTERVAL '361 days', true),
(1, (SELECT id FROM categories WHERE name = 'Haushalt' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Miete' AND user_id = 1), 850.00, 'expense', 'Miete', CURRENT_DATE - INTERVAL '361 days', true),
(1, (SELECT id FROM categories WHERE name = 'Essen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Supermarkt' AND user_id = 1), 289.40, 'expense', 'Monatsausgaben + Weihnachten', CURRENT_DATE - INTERVAL '365 days', true),
(1, (SELECT id FROM categories WHERE name = 'Einkaufen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Online-Shop' AND user_id = 1), 320.00, 'expense', 'Weihnachtsgeschenke', CURRENT_DATE - INTERVAL '358 days', true),
(1, (SELECT id FROM categories WHERE name = 'Sparen' AND user_id = 1), (SELECT id FROM sources WHERE name = 'Bank' AND user_id = 1), (SELECT id FROM targets WHERE name = 'Sparbuch' AND user_id = 1), 500.00, 'expense', 'Jahresend-Spareinlage', CURRENT_DATE - INTERVAL '361 days', true);

-- Summary: This script adds approximately 130+ sample transactions spanning 12 months
-- All marked with is_sample = true for easy removal via the app's "Remove Sample Data" feature
