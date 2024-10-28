-- Drop existing tables if they exist
DROP TABLE IF EXISTS email_clicks CASCADE;
DROP TABLE IF EXISTS email_opens CASCADE;
DROP TABLE IF EXISTS sent_emails CASCADE;
DROP TABLE IF EXISTS templates CASCADE;

-- Create templates table
CREATE TABLE templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sent_emails table
CREATE TABLE sent_emails (
  id SERIAL PRIMARY KEY,
  template_id INTEGER,
  recipient VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'sent',
  opens INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  last_activity_at TIMESTAMP
);

-- Create email_opens table
CREATE TABLE email_opens (
  id SERIAL PRIMARY KEY,
  email_id INTEGER,
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address VARCHAR(45)
);

-- Create email_clicks table
CREATE TABLE email_clicks (
  id SERIAL PRIMARY KEY,
  email_id INTEGER,
  clicked_url TEXT,
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address VARCHAR(45)
);

-- Add foreign key constraints
ALTER TABLE sent_emails
  ADD CONSTRAINT fk_template
  FOREIGN KEY (template_id)
  REFERENCES templates(id)
  ON DELETE CASCADE;

ALTER TABLE email_opens
  ADD CONSTRAINT fk_email_opens
  FOREIGN KEY (email_id)
  REFERENCES sent_emails(id)
  ON DELETE CASCADE;

ALTER TABLE email_clicks
  ADD CONSTRAINT fk_email_clicks
  FOREIGN KEY (email_id)
  REFERENCES sent_emails(id)
  ON DELETE CASCADE;

-- Insert test data
INSERT INTO templates (name, subject, html_content)
VALUES 
  ('Welcome Email', 'Welcome!', '<h1>Welcome to our service!</h1>'),
  ('Newsletter', 'Monthly Update', '<h1>Monthly Newsletter</h1>')
ON CONFLICT DO NOTHING;

INSERT INTO sent_emails (template_id, recipient, sent_at, status, opens, clicks)
VALUES 
  (1, 'test1@example.com', NOW() - INTERVAL '1 day', 'sent', 2, 1),
  (2, 'test2@example.com', NOW() - INTERVAL '2 days', 'sent', 1, 0),
  (1, 'test3@example.com', NOW() - INTERVAL '3 days', 'sent', 0, 0)
ON CONFLICT DO NOTHING; 