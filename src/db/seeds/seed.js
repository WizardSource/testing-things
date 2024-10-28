const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const templates = [
  {
    name: 'Welcome Email',
    subject: 'Welcome to Our Service!',
    html_content: '<h1>Welcome!</h1><p>We\'re excited to have you on board.</p>'
  },
  {
    name: 'Monthly Newsletter',
    subject: 'Your Monthly Update',
    html_content: '<h1>Monthly Newsletter</h1><p>Here\'s what\'s new this month...</p>'
  },
  {
    name: 'Password Reset',
    subject: 'Reset Your Password',
    html_content: '<h1>Password Reset</h1><p>Click here to reset your password...</p>'
  },
  {
    name: 'Order Confirmation',
    subject: 'Order #{{order_id}} Confirmed',
    html_content: '<h1>Order Confirmed</h1><p>Thank you for your purchase!</p>'
  }
];

const recipients = [
  'john@example.com',
  'sarah@example.com',
  'mike@example.com',
  'lisa@example.com',
  'david@example.com'
];

async function seedDatabase() {
  const client = await pool.connect();
  try {
    // Clear existing data
    await client.query('TRUNCATE templates, sent_emails, email_opens, email_clicks CASCADE');
    
    console.log('Inserting templates...');
    // Insert templates and store their IDs
    const templateIds = [];
    for (const template of templates) {
      const result = await client.query(
        'INSERT INTO templates (name, subject, html_content) VALUES ($1, $2, $3) RETURNING id',
        [template.name, template.subject, template.html_content]
      );
      templateIds.push(result.rows[0].id);
    }

    console.log('Template IDs:', templateIds);
    console.log('Generating sent emails...');
    
    // Generate sent emails for the last 30 days
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Generate 1-10 emails per day
      const emailsToday = Math.floor(Math.random() * 10) + 1;
      
      for (let j = 0; j < emailsToday; j++) {
        // Use actual template IDs
        const templateId = templateIds[Math.floor(Math.random() * templateIds.length)];
        const recipient = recipients[Math.floor(Math.random() * recipients.length)];
        const opens = Math.floor(Math.random() * 5);
        const clicks = Math.floor(Math.random() * (opens + 1));
        
        const result = await client.query(
          `INSERT INTO sent_emails 
           (template_id, recipient, sent_at, status, opens, clicks) 
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [templateId, recipient, date, 'sent', opens, clicks]
        );
        
        const emailId = result.rows[0].id;
        
        // Generate opens
        for (let k = 0; k < opens; k++) {
          const openDate = new Date(date);
          openDate.setHours(date.getHours() + Math.random() * 24);
          await client.query(
            `INSERT INTO email_opens 
             (email_id, opened_at, user_agent, ip_address) 
             VALUES ($1, $2, $3, $4)`,
            [
              emailId, 
              openDate,
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
              '192.168.1.' + Math.floor(Math.random() * 255)
            ]
          );
        }
        
        // Generate clicks
        for (let k = 0; k < clicks; k++) {
          const clickDate = new Date(date);
          clickDate.setHours(date.getHours() + Math.random() * 24);
          await client.query(
            `INSERT INTO email_clicks 
             (email_id, clicked_url, clicked_at, user_agent, ip_address) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              emailId, 
              'http://example.com/link' + (k + 1), 
              clickDate,
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
              '192.168.1.' + Math.floor(Math.random() * 255)
            ]
          );
        }
      }
    }

    console.log('Email seeding completed successfully!');
  } finally {
    client.release();
  }
}

seedDatabase().then(() => {
  console.log('Database seeding completed successfully!');
  pool.end();
}).catch(err => {
  console.error('Error seeding database:', err);
  pool.end();
}); 