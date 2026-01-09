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
 */
export async function sendTaskToAsana(task: TaskEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const asanaEmail = process.env.ASANA_EMAIL;
    
    if (!asanaEmail) {
      console.warn('[EMAIL] ASANA_EMAIL not configured, skipping Asana integration');
      return { success: false, error: 'ASANA_EMAIL not configured' };
    }

    const transporter = createTransporter();
    
    // Format the email body with task details
    const emailBody = `
Cliente: ${task.clientName}
Categoria: ${task.category}
Custo: R$ ${task.cost.toFixed(2)}
${task.dueDate ? `Data de Entrega: ${new Date(task.dueDate).toLocaleDateString('pt-BR')}` : ''}

Descrição:
${task.description}

---
Tarefa criada automaticamente pelo Task Manager
    `.trim();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: asanaEmail,
      subject: task.title,
      text: emailBody,
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`[EMAIL] Task "${task.title}" sent to Asana successfully`);
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
