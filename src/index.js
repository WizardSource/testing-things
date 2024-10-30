require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const { ServerClient } = require("postmark");
// Import seed function
const seedDatabase = require("./db/seeds/seed");

console.log("Starting server...");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || "wave",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "email_service",
  password: process.env.DB_PASSWORD || "",
  port: process.env.DB_PORT || 5432,
});

// Initialize Postmark client
const postmarkClient = new ServerClient(process.env.POSTMARK_API_KEY);

// Template endpoints
app.get("/templates", async (req, res) => {
  try {
    console.log("Fetching templates from database...");
    const result = await pool.query(
      "SELECT * FROM templates ORDER BY created_at DESC"
    );
    console.log("Templates found:", result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/templates", async (req, res) => {
  try {
    const { name, subject, html_content } = req.body;
    console.log("Creating template:", { name, subject, html_content });

    const result = await pool.query(
      "INSERT INTO templates (name, subject, html_content) VALUES ($1, $2, $3) RETURNING *",
      [name, subject, html_content]
    );

    console.log("Template created:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Send email endpoint
app.post("/send-email", async (req, res) => {
  const client = await pool.connect();
  try {
    const { template_id, to_email } = req.body;
    console.log("Received request to send email:", { template_id, to_email });

    // Check if Postmark API key exists
    if (!process.env.POSTMARK_API_KEY) {
      throw new Error("POSTMARK_API_KEY is not configured");
    }

    // Check if FROM_EMAIL exists
    if (!process.env.FROM_EMAIL) {
      throw new Error("FROM_EMAIL is not configured");
    }

    // Get template
    console.log("Fetching template...");
    const templateResult = await client.query(
      "SELECT * FROM templates WHERE id = $1",
      [template_id]
    );

    if (templateResult.rows.length === 0) {
      throw new Error(`Template with ID ${template_id} not found`);
    }

    const template = templateResult.rows[0];
    console.log("Found template:", template);

    // Send email via Postmark
    console.log("Attempting to send email via Postmark...");
    try {
      const emailResult = await postmarkClient.sendEmail({
        From: process.env.FROM_EMAIL,
        To: to_email,
        Subject: template.subject,
        HtmlBody: template.html_content,
        MessageStream: "outbound",
        TrackOpens: true,
        TrackLinks: "HtmlAndText",
      });
      console.log("Postmark response:", emailResult);
    } catch (postmarkError) {
      console.error("Postmark error:", postmarkError);
      throw new Error(`Postmark error: ${postmarkError.message}`);
    }

    // Record the sent email
    console.log("Recording sent email in database...");
    const sentEmailResult = await client.query(
      `INSERT INTO sent_emails 
       (template_id, recipient, status) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [template_id, to_email, "sent"]
    );

    await client.query("COMMIT");
    console.log("Email sent and recorded successfully");

    res.json({
      success: true,
      message: "Email sent successfully",
      emailId: sentEmailResult.rows[0].id,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Detailed error:", {
      message: err.message,
      stack: err.stack,
      details: err.details || "No additional details",
    });

    res.status(500).json({
      error: "Failed to send email",
      details: err.message,
      type: err.constructor.name,
    });
  } finally {
    client.release();
  }
});

// Analytics endpoints
app.get("/analytics/opens", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.name as template_name,
        s.recipient,
        COUNT(o.id) as open_count,
        MIN(o.opened_at) as first_opened_at
      FROM templates t
      JOIN sent_emails s ON s.template_id = t.id
      LEFT JOIN email_opens o ON o.email_id = s.id
      GROUP BY t.name, s.recipient
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching opens:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/analytics/clicks", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.name as template_name,
        s.recipient,
        COUNT(c.id) as click_count,
        MIN(c.clicked_at) as first_clicked_at
      FROM templates t
      JOIN sent_emails s ON s.template_id = t.id
      LEFT JOIN email_clicks c ON c.email_id = s.id
      GROUP BY t.name, s.recipient
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching clicks:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add these endpoints
app.put("/templates/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { name, subject, html_content } = req.body;

    // First check if template exists
    const templateCheck = await client.query(
      "SELECT id FROM templates WHERE id = $1",
      [id]
    );

    if (templateCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Template not found",
      });
    }

    // Update the template
    const result = await client.query(
      `UPDATE templates 
       SET name = $1, 
           subject = $2, 
           html_content = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 
       RETURNING *`,
      [name, subject, html_content, id]
    );

    await client.query("COMMIT");

    console.log(`Template ${id} updated successfully`);
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating template:", err);
    res.status(500).json({
      error: "Failed to update template",
      details: err.message,
    });
  } finally {
    client.release();
  }
});

app.delete("/templates/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First check if template exists
    const templateCheck = await client.query(
      "SELECT id FROM templates WHERE id = $1",
      [req.params.id]
    );

    if (templateCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Template not found",
      });
    }

    // Delete related sent_emails first (due to foreign key constraint)
    await client.query("DELETE FROM sent_emails WHERE template_id = $1", [
      req.params.id,
    ]);

    // Then delete the template
    const result = await client.query(
      "DELETE FROM templates WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Template deleted successfully",
      deletedTemplate: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error in delete template:", err);
    res.status(500).json({
      error: "Failed to delete template",
      details: err.message,
    });
  } finally {
    client.release();
  }
});

// Add this new endpoint
app.get("/sent-emails", async (req, res) => {
  console.log("GET /sent-emails - Starting request");
  const client = await pool.connect();
  try {
    console.log("Executing query...");
    const result = await client.query(`
      SELECT 
        se.id,
        t.name as template_name,
        se.recipient,
        se.sent_at,
        se.status,
        se.opens,
        se.clicks,
        se.last_activity_at
      FROM sent_emails se
      LEFT JOIN templates t ON t.id = se.template_id
      ORDER BY se.sent_at DESC
    `);

    console.log(`Found ${result.rows.length} emails`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /sent-emails:", err);
    res.status(500).json({
      error: "Failed to fetch sent emails",
      details: DEBUG ? err.message : undefined,
    });
  } finally {
    client.release();
  }
});

// Add these endpoints for Postmark webhooks
app.post("/webhooks/open", async (req, res) => {
  const client = await pool.connect();
  try {
    const { MessageID, Recipient, ReceivedAt, UserAgent, IP } = req.body;

    console.log("Email opened:", { MessageID, Recipient });

    // Record the open event
    await client.query(
      `INSERT INTO email_opens 
       (email_id, opened_at, user_agent, ip_address)
       VALUES (
         (SELECT id FROM sent_emails WHERE message_id = $1),
         $2,
         $3,
         $4
       )`,
      [MessageID, ReceivedAt, UserAgent, IP]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error recording email open:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post("/webhooks/click", async (req, res) => {
  const client = await pool.connect();
  try {
    const { MessageID, Recipient, ReceivedAt, UserAgent, IP, OriginalLink } =
      req.body;

    console.log("Email link clicked:", { MessageID, Recipient, OriginalLink });

    // Record the click event
    await client.query(
      `INSERT INTO email_clicks 
       (email_id, clicked_url, clicked_at, user_agent, ip_address)
       VALUES (
         (SELECT id FROM sent_emails WHERE message_id = $1),
         $2,
         $3,
         $4,
         $5
       )`,
      [MessageID, OriginalLink, ReceivedAt, UserAgent, IP]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error recording email click:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Add these new routes for the dashboard
app.get("/stats", async (req, res) => {
  console.log(new Date().toISOString(), "- GET /stats");
  const client = await pool.connect();
  try {
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_emails,
        COALESCE(
          ROUND(
            COUNT(CASE WHEN opens > 0 THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100,
            1
          ),
          0
        ) as open_rate,
        COALESCE(
          ROUND(
            COUNT(CASE WHEN clicks > 0 THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100,
            1
          ),
          0
        ) as click_rate,
        (SELECT COUNT(*) FROM templates) as templates
      FROM sent_emails
    `);

    const recentEmails = await client.query(`
      SELECT 
        t.name as template,
        se.recipient,
        se.sent_at,
        se.status
      FROM sent_emails se
      JOIN templates t ON t.id = se.template_id
      ORDER BY se.sent_at DESC
      LIMIT 5
    `);

    res.json({
      totalEmails: parseInt(stats.rows[0].total_emails),
      openRate: parseFloat(stats.rows[0].open_rate),
      clickRate: parseFloat(stats.rows[0].click_rate),
      templates: parseInt(stats.rows[0].templates),
      recentEmails: recentEmails.rows,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  } finally {
    client.release();
  }
});

app.get("/activities", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        'email_sent' as type,
        recipient as description,
        sent_at as timestamp
      FROM sent_emails
      ORDER BY sent_at DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching activities:", err);
    res.status(500).json({ error: "Failed to fetch activities" });
  } finally {
    client.release();
  }
});

// Initialize database with seed data if needed
const initializeDatabase = async () => {
  try {
    // Check if database is empty
    const result = await pool.query(`
      SELECT COUNT(*) FROM templates
    `);

    if (parseInt(result.rows[0].count) === 0) {
      console.log("Database is empty, running seed...");
      await seedDatabase(false); // Pass false to prevent pool ending
    } else {
      console.log("Database already contains data, skipping seed");
    }
  } catch (err) {
    if (err.code === "42P01") {
      // Table doesn't exist
      console.log("Tables do not exist, running migrations...");
      // Run migrations first
      const fs = require("fs");
      const path = require("path");
      const migration = fs.readFileSync(
        path.join(__dirname, "db/migrations/initial_schema.sql"),
        "utf8"
      );
      await pool.query(migration);
      console.log("Running seed...");
      await seedDatabase(false); // Pass false to prevent pool ending
    } else {
      console.error("Error checking database:", err);
      throw err;
    }
  }
};

// Start server only after database is ready
const startServer = async () => {
  try {
    await initializeDatabase();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    await pool.end(); // End pool on error
    process.exit(1);
  }
};

startServer();

// Handle shutdown gracefully
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await pool.end();
  process.exit(0);
});

// Add this test route
app.get("/test-db", async (req, res) => {
  console.log("Testing database connection...");
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT NOW()");
    res.json({
      success: true,
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    console.error("Database test error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Error handling
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
