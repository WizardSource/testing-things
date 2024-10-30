const { Pool } = require("pg");
const { faker } = require("@faker-js/faker"); // Updated import

require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Generate 1000 realistic email addresses
const generateEmails = (count) => {
  const emails = new Set();
  while (emails.size < count) {
    emails.add(faker.internet.email());
  }
  return Array.from(emails);
};

const templates = [
  {
    name: "Welcome Email",
    subject: "Welcome to Our Platform! 🎉",
    html_content: `<div>Welcome aboard!</div>`,
  },
  {
    name: "Monthly Newsletter",
    subject: "📰 Your Monthly Update",
    html_content: `<div>Monthly updates...</div>`,
  },
  {
    name: "Password Reset",
    subject: "Reset Your Password",
    html_content: `<div>Reset your password...</div>`,
  },
  {
    name: "Order Confirmation",
    subject: "Order Confirmed ✅",
    html_content: `<div>Order details...</div>`,
  },
  {
    name: "Webinar Invitation",
    subject: "🎯 Join Our Upcoming Webinar",
    html_content: `<div>Webinar details...</div>`,
  },
  // Add more templates as needed
];

const userAgents = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)",
  "Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X)",
  "Mozilla/5.0 (Android 11; Mobile)",
];

const clickUrls = [
  "http://example.com/signup",
  "http://example.com/pricing",
  "http://example.com/features",
  "http://example.com/blog",
  "http://example.com/contact",
];

async function seedDatabase(shouldEndPool = true) {
  const client = await pool.connect();
  try {
    console.log("Starting database seed...");

    // Clear existing data
    await client.query(
      "TRUNCATE templates, sent_emails, email_opens, email_clicks CASCADE"
    );

    // Insert templates
    console.log("Inserting templates...");
    const templateIds = [];
    for (const template of templates) {
      const result = await client.query(
        "INSERT INTO templates (name, subject, html_content) VALUES ($1, $2, $3) RETURNING id",
        [template.name, template.subject, template.html_content]
      );
      templateIds.push(result.rows[0].id);
    }

    // Generate recipients
    const recipients = generateEmails(1000);
    console.log("Generated", recipients.length, "unique email addresses");

    // Generate sent emails for the last 90 days
    console.log("Generating sent emails for the last 90 days...");
    const now = new Date();
    const totalEmails = 10000; // Adjust this number for more/less data
    const batchSize = 100;

    for (let i = 0; i < totalEmails; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize; j++) {
        const daysAgo = Math.floor(Math.random() * 90);
        const hoursAgo = Math.floor(Math.random() * 24);
        const minutesAgo = Math.floor(Math.random() * 60);

        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);
        date.setHours(date.getHours() - hoursAgo);
        date.setMinutes(date.getMinutes() - minutesAgo);

        const templateId =
          templateIds[Math.floor(Math.random() * templateIds.length)];
        const recipient =
          recipients[Math.floor(Math.random() * recipients.length)];
        const opens = Math.floor(Math.random() * 8); // 0-7 opens
        const clicks = Math.floor(Math.random() * (opens + 1)); // clicks <= opens

        batch.push({
          templateId,
          recipient,
          date,
          opens,
          clicks,
        });
      }

      // Insert batch of sent emails
      for (const email of batch) {
        const result = await client.query(
          `INSERT INTO sent_emails 
           (template_id, recipient, sent_at, status, opens, clicks) 
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            email.templateId,
            email.recipient,
            email.date,
            "sent",
            email.opens,
            email.clicks,
          ]
        );

        const emailId = result.rows[0].id;

        // Generate opens
        for (let k = 0; k < email.opens; k++) {
          const openDate = new Date(email.date);
          openDate.setMinutes(
            openDate.getMinutes() + Math.floor(Math.random() * 60 * 24)
          ); // Within 24 hours
          await client.query(
            `INSERT INTO email_opens 
             (email_id, opened_at, user_agent, ip_address) 
             VALUES ($1, $2, $3, $4)`,
            [
              emailId,
              openDate,
              userAgents[Math.floor(Math.random() * userAgents.length)],
              `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(
                Math.random() * 255
              )}`,
            ]
          );
        }

        // Generate clicks
        for (let k = 0; k < email.clicks; k++) {
          const clickDate = new Date(email.date);
          clickDate.setMinutes(
            clickDate.getMinutes() + Math.floor(Math.random() * 60 * 24)
          ); // Within 24 hours
          await client.query(
            `INSERT INTO email_clicks 
             (email_id, clicked_url, clicked_at, user_agent, ip_address) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              emailId,
              clickUrls[Math.floor(Math.random() * clickUrls.length)],
              clickDate,
              userAgents[Math.floor(Math.random() * userAgents.length)],
              `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(
                Math.random() * 255
              )}`,
            ]
          );
        }
      }

      console.log(`Processed ${i + batchSize}/${totalEmails} emails`);
    }

    // Log final statistics
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM templates) as template_count,
        (SELECT COUNT(*) FROM sent_emails) as email_count,
        (SELECT COUNT(*) FROM email_opens) as opens_count,
        (SELECT COUNT(*) FROM email_clicks) as clicks_count
    `);

    console.log("\nSeed completed successfully!");
    console.log("Statistics:", stats.rows[0]);
  } catch (err) {
    console.error("Error seeding database:", err);
    throw err;
  } finally {
    client.release();
    if (shouldEndPool) {
      await pool.end();
    }
  }
}

// When running directly (not as module)
if (require.main === module) {
  seedDatabase(true).catch(console.error);
}

module.exports = seedDatabase;
