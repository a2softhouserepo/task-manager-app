/**
 * Asana Webhook Endpoint
 * 
 * Recebe eventos do Asana quando tarefas são alteradas.
 * 
 * Fluxo de segurança do Asana:
 * 1. Handshake: Asana envia X-Hook-Secret, respondemos com o mesmo header
 * 2. Eventos: Asana envia X-Hook-Signature (HMAC-SHA256 do body com o secret)
 * 
 * Eventos suportados:
 * - changed: tarefa foi modificada
 * - added: tarefa adicionada ao projeto
 * - removed: tarefa removida do projeto
 * - deleted: tarefa deletada permanentemente
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import { logAudit, createAuditSnapshot } from '@/lib/audit';

// Store the webhook secret in memory (in production, use Redis or DB)
// This is set during the handshake and used to verify subsequent requests
let webhookSecret: string | null = null;

/**
 * Verify the HMAC-SHA256 signature from Asana
 */
function verifySignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Fetch task details from Asana API
 */
async function fetchAsanaTask(taskGid: string): Promise<any | null> {
  const accessToken = process.env.ASANA_ACCESS_TOKEN;
  if (!accessToken) return null;

  try {
    const response = await fetch(
      `https://app.asana.com/api/1.0/tasks/${taskGid}?opt_fields=name,notes,due_on,start_on,completed,memberships.section.name`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`[ASANA WEBHOOK] Failed to fetch task ${taskGid}:`, response.status);
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`[ASANA WEBHOOK] Error fetching task ${taskGid}:`, error);
    return null;
  }
}

/**
 * Map Asana section name to Task Manager status
 */
function mapSectionToStatus(sectionName: string): string {
  const normalizedName = sectionName.toLowerCase();
  
  if (normalizedName.includes('progress') || normalizedName.includes('andamento') || normalizedName === 'in_progress') {
    return 'in_progress';
  }
  if (normalizedName.includes('complet') || normalizedName.includes('conclu') || normalizedName.includes('done') || normalizedName === 'completed') {
    return 'completed';
  }
  if (normalizedName.includes('cancel') || normalizedName === 'cancelled') {
    return 'cancelled';
  }
  // Default to pending
  return 'pending';
}

/**
 * Process a single Asana event
 */
async function processEvent(event: any): Promise<void> {
  const { action, resource } = event;
  
  // We only care about task events
  if (resource?.resource_type !== 'task') {
    return;
  }

  const taskGid = resource.gid;
  console.log(`[ASANA WEBHOOK] Processing ${action} event for task ${taskGid}`);

  // Find the task in our database by Asana GID
  await dbConnect();
  const task = await Task.findOne({ asanaTaskGid: taskGid });

  if (!task) {
    console.log(`[ASANA WEBHOOK] Task with Asana GID ${taskGid} not found in database, skipping`);
    return;
  }

  // Handle different event types
  switch (action) {
    case 'changed':
    case 'added': {
      // Fetch the latest task data from Asana
      const asanaTask = await fetchAsanaTask(taskGid);
      if (!asanaTask) {
        console.error(`[ASANA WEBHOOK] Could not fetch task data for ${taskGid}`);
        return;
      }

      const originalTask = createAuditSnapshot(task.toObject());
      const changes: string[] = [];

      // Update title (name)
      if (asanaTask.name && asanaTask.name !== task.title) {
        task.title = asanaTask.name;
        changes.push('title');
      }
      // Update description (notes)
      // Now Asana notes contain only the pure description, identical to Task Manager
      if (asanaTask.notes !== undefined) {
        const newDescription = asanaTask.notes.trim();
        
        // Only update if description actually changed
        if (newDescription && newDescription !== task.description) {
          task.description = newDescription;
          changes.push('description');
        }
      }
      // Update description (notes)
      // Asana notes may contain formatted content, we extract the description part
      if (asanaTask.notes !== undefined) {
        // Extract description from Asana notes (format: Client: X\nCategoria: Y\nCusto: Z\n\nDescription)
        const notesLines = asanaTask.notes.split('\n');
        let descriptionStartIndex = -1;
        
        // Find where the actual description starts (after metadata)
        for (let i = 0; i < notesLines.length; i++) {
          if (notesLines[i].trim() === '' && i > 0) {
            // Empty line after metadata indicates description starts next
            descriptionStartIndex = i + 1;
            break;
          }
        }
        
        // Extract description (everything after the empty line)
        const extractedDescription = descriptionStartIndex > -1
          ? notesLines.slice(descriptionStartIndex).join('\n').trim()
          : asanaTask.notes.trim();
        
        // Only update if description actually changed
        if (extractedDescription && extractedDescription !== task.description) {
          task.description = extractedDescription;
          changes.push('description');
        }
      }

      // Update completion status
      if (asanaTask.completed !== undefined) {
        const newStatus = asanaTask.completed ? 'completed' : task.status;
        if (asanaTask.completed && task.status !== 'completed' && task.status !== 'cancelled') {
          task.status = 'completed';
          changes.push('status');
        }
      }

      // Update status based on section (if available)
      if (asanaTask.memberships && asanaTask.memberships.length > 0) {
        const section = asanaTask.memberships[0]?.section;
        if (section?.name) {
          const newStatus = mapSectionToStatus(section.name) as 'pending' | 'in_progress' | 'completed' | 'cancelled';
          if (task.status !== newStatus) {
            task.status = newStatus;
            changes.push('status');
          }
        }
      }

      // Update due date (deliveryDate)
      if (asanaTask.due_on !== undefined) {
        const newDeliveryDate = asanaTask.due_on ? new Date(asanaTask.due_on) : undefined;
        const currentDeliveryDate = task.deliveryDate ? new Date(task.deliveryDate).toISOString().split('T')[0] : null;
        
        if (asanaTask.due_on !== currentDeliveryDate) {
          task.deliveryDate = newDeliveryDate;
          changes.push('deliveryDate');
        }
      }

      // Update start date (requestDate) - only if Asana has a value (requestDate is required in our system)
      if (asanaTask.start_on) {
        const newRequestDate = new Date(asanaTask.start_on);
        const currentRequestDate = task.requestDate ? new Date(task.requestDate).toISOString().split('T')[0] : null;
        
        if (asanaTask.start_on !== currentRequestDate) {
          task.requestDate = newRequestDate;
          changes.push('requestDate');
        }
      }

      // Only save if there were changes
      if (changes.length > 0) {
        task.updatedAt = new Date();
        // Flag to prevent sync loop back to Asana
        (task as any)._fromWebhook = true;
        await task.save();

        await logAudit({
          action: 'UPDATE',
          resource: 'TASK',
          resourceId: task._id.toString(),
          details: {
            source: 'asana_webhook',
            before: originalTask,
            after: createAuditSnapshot(task.toObject()),
            changes,
          },
        });

        console.log(`[ASANA WEBHOOK] Updated task ${task._id}: ${changes.join(', ')}`);
      } else {
        console.log(`[ASANA WEBHOOK] No changes detected for task ${task._id}`);
      }
      break;
    }

    case 'deleted': {
      // Mark task as cancelled when deleted in Asana
      if (task.status !== 'cancelled') {
        const originalTask = createAuditSnapshot(task.toObject());
        
        task.status = 'cancelled';
        task.updatedAt = new Date();
        // Flag to prevent sync loop back to Asana
        (task as any)._fromWebhook = true;
        await task.save();

        await logAudit({
          action: 'UPDATE',
          resource: 'TASK',
          resourceId: task._id.toString(),
          details: {
            source: 'asana_webhook',
            reason: 'Task deleted in Asana',
            before: originalTask,
            after: createAuditSnapshot(task.toObject()),
            changes: ['status'],
          },
        });

        console.log(`[ASANA WEBHOOK] Marked task ${task._id} as cancelled (deleted in Asana)`);
      }
      break;
    }

    case 'removed': {
      // Task was removed from the project (but not deleted)
      console.log(`[ASANA WEBHOOK] Task ${task._id} was removed from Asana project`);
      break;
    }

    default:
      console.log(`[ASANA WEBHOOK] Unknown action: ${action}`);
  }
}

/**
 * POST handler for Asana webhook events
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Check for handshake (initial webhook registration)
    const hookSecret = request.headers.get('x-hook-secret');
    if (hookSecret) {
      console.log('[ASANA WEBHOOK] Handshake received, storing secret', hookSecret);
      console.log('[ASANA WEBHOOK] 🔐 Secret:', hookSecret);
      console.log('[ASANA WEBHOOK] Add to .env.local: ASANA_WEBHOOK_SECRET=' + hookSecret);
      
      // Store the secret for future signature verification
      webhookSecret = hookSecret;
      
      // Also store in environment for persistence (you might want to use a DB instead)
      // For now, we'll just keep it in memory
      
      // Respond with the same secret to complete handshake
      return new NextResponse(null, {
        status: 200,
        headers: {
          'X-Hook-Secret': hookSecret,
        },
      });
    }

    // Verify signature for regular events
    const signature = request.headers.get('x-hook-signature');
    const storedSecret = webhookSecret || process.env.ASANA_WEBHOOK_SECRET;
    
    if (signature && storedSecret) {
      if (!verifySignature(rawBody, signature, storedSecret)) {
        console.error('[ASANA WEBHOOK] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (!storedSecret) {
      console.warn('[ASANA WEBHOOK] No secret available for signature verification');
      // In development, you might want to allow this
      // In production, you should reject unsigned requests
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 401 });
      }
    }

    // Parse the events
    const body = JSON.parse(rawBody);
    const events = body.events || [];

    console.log(`[ASANA WEBHOOK] Received ${events.length} events`);

    // Process each event
    for (const event of events) {
      try {
        await processEvent(event);
      } catch (eventError) {
        console.error('[ASANA WEBHOOK] Error processing event:', eventError);
        // Continue processing other events
      }
    }

    // Asana expects a 200 response
    return NextResponse.json({ success: true, processed: events.length });
  } catch (error: any) {
    console.error('[ASANA WEBHOOK] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler for health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'Asana webhook endpoint',
    hasSecret: !!webhookSecret || !!process.env.ASANA_WEBHOOK_SECRET,
    secret: webhookSecret || null, // Expose for script to retrieve after registration
  });
}
