import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface TaskEmailData {
  title: string;
  description: string;
  clientName: string;
  category: string;
  dueDate?: Date;
  cost: number;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Creates a nodemailer transporter using environment variables
 */
function createTransporter() {
  const config: EmailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  };

  return nodemailer.createTransport(config);
}

/**
 * Sends a task to Asana via email
 * Asana accepts tasks via email where the subject becomes the task title
 * and the body becomes the description
 * 
 * Asana recognizes due dates in the subject line in YYYY-MM-DD format
 * Example: "My Task 2026-01-28" will set the due date to January 28, 2026
 */
export async function sendTaskToAsana(task: TaskEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const asanaEmail = process.env.ASANA_EMAIL;
    
    if (!asanaEmail) {
      console.warn('[EMAIL] ASANA_EMAIL not configured, skipping Asana integration');
      return { success: false, error: 'ASANA_EMAIL not configured' };
    }

    const transporter = createTransporter();
    
    // Format due date in YYYY-MM-DD for Asana to recognize it as the task due date
    let dueDateForSubject = '';
    if (task.dueDate) {
      const date = new Date(task.dueDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dueDateForSubject = ` ${year}-${month}-${day}`;
    }
    
    // Build email subject with due date appended (Asana will parse it)
    const emailSubject = `${task.title}${dueDateForSubject}`;
    
    // Format the email body with task details
    // Use HTML to preserve line breaks properly in Asana
    const emailBodyText = `
Cliente: ${task.clientName}
Categoria: ${task.category}
Custo: ${task.cost}
${task.dueDate ? `Data de Entrega: ${new Date(task.dueDate).toLocaleDateString('pt-BR')}` : ''}

Descrição:
${task.description}

---
Tarefa criada automaticamente pelo Task Manager
    `.trim();
    
    // HTML version with proper line break preservation
    const emailBodyHtml = `
<div style="font-family: sans-serif; white-space: pre-wrap;">
<p><strong>Cliente:</strong> ${task.clientName}</p>
<p><strong>Categoria:</strong> ${task.category}</p>
<p><strong>Custo:</strong> ${task.cost}</p>
${task.dueDate ? `<p><strong>Data de Entrega:</strong> ${new Date(task.dueDate).toLocaleDateString('pt-BR')}</p>` : ''}

<p><strong>Descrição:</strong></p>
<pre style="font-family: inherit; white-space: pre-wrap; margin: 0;">${task.description}</pre>

<hr>
<p style="color: #666; font-size: 12px;">Tarefa criada automaticamente pelo Task Manager</p>
</div>
    `.trim();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: asanaEmail,
      subject: emailSubject,
      text: emailBodyText,
      html: emailBodyHtml,
      attachments: task.attachments || [],
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`[EMAIL] Task "${task.title}" sent to Asana successfully (due: ${dueDateForSubject.trim() || 'none'})`);
    return { success: true };
  } catch (error: any) {
    console.error('[EMAIL] Failed to send task to Asana:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a generic email
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`[EMAIL] Email sent to ${to} successfully`);
    return { success: true };
  } catch (error: any) {
    console.error('[EMAIL] Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifies SMTP connection is working
 */
export async function verifyEmailConfig(): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('[EMAIL] SMTP connection verified successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[EMAIL] SMTP verification failed:', error);
    return { success: false, error: error.message };
  }
}
