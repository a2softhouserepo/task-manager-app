/**
 * Asana API Integration Service
 * 
 * This module provides functions to create and update tasks in Asana
 * using the official Asana REST API.
 * 
 * Benefits over email integration:
 * - Due dates work correctly (due_on field)
 * - Can update existing tasks (no duplicates)
 * - Can set assignees, tags, and custom fields
 * - Returns task GID for reference
 * - Moves tasks between sections (columns) based on status
 * 
 * Required environment variables:
 * - ASANA_ACCESS_TOKEN: Personal Access Token from Asana
 * - ASANA_PROJECT_GID: Project GID where tasks will be created
 * 
 * Optional environment variables for section mapping:
 * - ASANA_SECTION_PENDING: Section GID for "Pendente" column
 * - ASANA_SECTION_IN_PROGRESS: Section GID for "Em Progresso" column
 * - ASANA_SECTION_COMPLETED: Section GID for "Concluída" column
 * - ASANA_SECTION_CANCELLED: Section GID for "Cancelada" column
 */

const ASANA_API_BASE = 'https://app.asana.com/api/1.0';

interface AsanaTaskData {
  title: string;
  description: string;
  clientName: string;
  category: string;
  dueDate?: Date;
  cost: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

interface AsanaResult {
  success: boolean;
  taskGid?: string;
  error?: string;
}

interface AsanaApiResponse {
  data?: {
    gid?: string;
    name?: string;
    [key: string]: any;
  };
  errors?: Array<{ message: string }>;
}

/**
 * Make an authenticated request to the Asana API
 */
async function asanaRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, any>
): Promise<AsanaApiResponse> {
  const accessToken = process.env.ASANA_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('ASANA_ACCESS_TOKEN not configured');
  }
  
  const url = `${ASANA_API_BASE}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify({ data: body });
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    const errorMessage = data.errors?.[0]?.message || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }
  
  return data;
}

/**
 * Format date to YYYY-MM-DD for Asana's due_on field
 */
function formatDateForAsana(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get section GID based on task status
 * Returns null if sections are not configured
 */
function getSectionGidForStatus(status?: string): string | null {
  const sectionMap: Record<string, string | undefined> = {
    'pending': process.env.ASANA_SECTION_PENDING,
    'in_progress': process.env.ASANA_SECTION_IN_PROGRESS,
    'completed': process.env.ASANA_SECTION_COMPLETED,
    'cancelled': process.env.ASANA_SECTION_CANCELLED,
  };
  
  return sectionMap[status || 'pending'] || null;
}

/**
 * Move a task to a specific section (column) in Asana
 */
async function moveTaskToSection(taskGid: string, sectionGid: string): Promise<void> {
  await asanaRequest(`/sections/${sectionGid}/addTask`, 'POST', {
    task: taskGid,
  });
  console.log(`[ASANA] Task moved to section ${sectionGid}`);
}

/**
 * Build the task notes/description - now returns pure description without metadata
 */
function buildTaskNotes(task: AsanaTaskData): string {
  // Return only the description, identical to Task Manager
  return task.description;
}

/**
 * Create a new task in Asana
 * 
 * @param task - Task data to create
 * @returns Result with success status and task GID if created
 */
export async function createAsanaTask(task: AsanaTaskData): Promise<AsanaResult> {
  try {
    const accessToken = process.env.ASANA_ACCESS_TOKEN;
    const projectGid = process.env.ASANA_PROJECT_GID;
    
    if (!accessToken) {
      return { 
        success: false, 
        error: 'Asana API not configured. Set ASANA_ACCESS_TOKEN in environment.' 
      };
    }
    
    if (!projectGid) {
      return { 
        success: false, 
        error: 'ASANA_PROJECT_GID not configured' 
      };
    }
    
    // Build task payload
    const taskData: Record<string, any> = {
      name: task.title,
      notes: buildTaskNotes(task),
      projects: [projectGid],
    };
    
    // Add due date if provided
    if (task.dueDate) {
      taskData.due_on = formatDateForAsana(new Date(task.dueDate));
    }
    
    // Mark as completed if task status is completed or cancelled
    if (task.status === 'completed' || task.status === 'cancelled') {
      taskData.completed = true;
    }
    
    // Create the task
    const result = await asanaRequest('/tasks', 'POST', taskData);
    const createdTask = result.data;
    
    // Move to appropriate section if configured
    if (createdTask?.gid) {
      const sectionGid = getSectionGidForStatus(task.status);
      if (sectionGid) {
        try {
          await moveTaskToSection(createdTask.gid, sectionGid);
        } catch (sectionError) {
          console.warn('[ASANA] Failed to move task to section:', sectionError);
          // Don't fail the whole operation if section move fails
        }
      }
    }
    
    console.log(`[ASANA] Task "${task.title}" created successfully (GID: ${createdTask?.gid}, due: ${taskData.due_on || 'none'})`);
    
    return {
      success: true,
      taskGid: createdTask?.gid,
    };
  } catch (error: any) {
    console.error('[ASANA] Failed to create task:', error);
    
    return {
      success: false,
      error: error.message || 'Unknown error creating Asana task',
    };
  }
}

/**
 * Update an existing task in Asana
 * 
 * @param taskGid - Asana task GID to update
 * @param task - Updated task data
 * @returns Result with success status
 */
export async function updateAsanaTask(taskGid: string, task: AsanaTaskData): Promise<AsanaResult> {
  try {
    const accessToken = process.env.ASANA_ACCESS_TOKEN;
    
    if (!accessToken) {
      return { 
        success: false, 
        error: 'Asana API not configured. Set ASANA_ACCESS_TOKEN in environment.' 
      };
    }
    
    // Build update payload
    const updateData: Record<string, any> = {
      name: task.title,
      notes: buildTaskNotes(task),
    };
    
    // Update due date
    if (task.dueDate) {
      updateData.due_on = formatDateForAsana(new Date(task.dueDate));
    } else {
      // Clear due date if not provided
      updateData.due_on = null;
    }
    
    // Update completion status
    if (task.status === 'completed' || task.status === 'cancelled') {
      updateData.completed = true;
    } else {
      updateData.completed = false;
    }
    
    // Update the task
    await asanaRequest(`/tasks/${taskGid}`, 'PUT', updateData);
    
    // Move to appropriate section if configured
    const sectionGid = getSectionGidForStatus(task.status);
    if (sectionGid) {
      try {
        await moveTaskToSection(taskGid, sectionGid);
      } catch (sectionError) {
        console.warn('[ASANA] Failed to move task to section:', sectionError);
        // Don't fail the whole operation if section move fails
      }
    }
    
    console.log(`[ASANA] Task "${task.title}" updated successfully (GID: ${taskGid})`);
    
    return {
      success: true,
      taskGid,
    };
  } catch (error: any) {
    console.error('[ASANA] Failed to update task:', error);
    
    return {
      success: false,
      error: error.message || 'Unknown error updating Asana task',
    };
  }
}

/**
 * Delete a task in Asana
 * Note: Deleted tasks are moved to trash but can be recovered by Asana workspace admins
 * 
 * @param taskGid - Asana task GID to delete
 * @returns Result with success status
 */
export async function deleteAsanaTask(taskGid: string): Promise<AsanaResult> {
  try {
    const accessToken = process.env.ASANA_ACCESS_TOKEN;
    
    if (!accessToken) {
      return { 
        success: false, 
        error: 'Asana API not configured' 
      };
    }
    
    // Delete the task (moves to trash)
    await asanaRequest(`/tasks/${taskGid}`, 'DELETE');
    
    console.log(`[ASANA] Task deleted (GID: ${taskGid})`);
    
    return { success: true, taskGid };
  } catch (error: any) {
    console.error('[ASANA] Failed to delete task:', error);
    
    return {
      success: false,
      error: error.message || 'Unknown error deleting Asana task',
    };
  }
}

/**
 * Sync task to Asana - creates if new, updates if exists
 * 
 * @param task - Task data
 * @param existingGid - Existing Asana task GID (if updating)
 * @returns Result with success status and task GID
 */
export async function syncTaskToAsana(
  task: AsanaTaskData, 
  existingGid?: string
): Promise<AsanaResult> {
  if (existingGid) {
    return updateAsanaTask(existingGid, task);
  } else {
    return createAsanaTask(task);
  }
}

/**
 * Check if Asana integration is configured
 */
export function isAsanaConfigured(): boolean {
  return !!(process.env.ASANA_ACCESS_TOKEN && process.env.ASANA_PROJECT_GID);
}

/**
 * Get Asana configuration status for debugging
 */
export function getAsanaConfigStatus(): {
  hasAccessToken: boolean;
  hasProjectGid: boolean;
} {
  return {
    hasAccessToken: !!process.env.ASANA_ACCESS_TOKEN,
    hasProjectGid: !!process.env.ASANA_PROJECT_GID,
  };
}

/**
 * Interface for attachment data
 */
export interface AsanaAttachmentData {
  filename: string;
  content: Buffer;
  contentType: string;
}

/**
 * Result of attachment upload operation
 */
export interface AsanaAttachmentResult {
  success: boolean;
  attachmentGid?: string;
  filename?: string;
  error?: string;
}

/**
 * Upload a file attachment to an existing Asana task
 * Uses multipart/form-data as required by Asana Attachments API
 * 
 * @param taskGid - The Asana task GID to attach the file to
 * @param attachment - The attachment data (filename, content buffer, contentType)
 * @returns Result with success status and attachment GID
 */
export async function uploadAsanaAttachment(
  taskGid: string,
  attachment: AsanaAttachmentData
): Promise<AsanaAttachmentResult> {
  try {
    const accessToken = process.env.ASANA_ACCESS_TOKEN;
    
    if (!accessToken) {
      return {
        success: false,
        filename: attachment.filename,
        error: 'Asana API not configured. Set ASANA_ACCESS_TOKEN in environment.',
      };
    }

    if (!taskGid) {
      return {
        success: false,
        filename: attachment.filename,
        error: 'Task GID is required to upload attachment.',
      };
    }

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('parent', taskGid);
    
    // Create a Blob from the buffer with the correct content type
    // Convert Buffer to Uint8Array for proper Blob compatibility
    const uint8Array = new Uint8Array(attachment.content);
    const blob = new Blob([uint8Array], { type: attachment.contentType });
    formData.append('file', blob, attachment.filename);

    const url = `${ASANA_API_BASE}/attachments`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        // Note: Don't set Content-Type header - fetch will set it automatically with boundary for FormData
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.errors?.[0]?.message || `HTTP ${response.status}`;
      console.error(`[ASANA] Failed to upload attachment "${attachment.filename}":`, errorMessage);
      return {
        success: false,
        filename: attachment.filename,
        error: errorMessage,
      };
    }

    console.log(`[ASANA] Attachment "${attachment.filename}" uploaded successfully (GID: ${data.data?.gid})`);
    
    return {
      success: true,
      attachmentGid: data.data?.gid,
      filename: attachment.filename,
    };
  } catch (error: any) {
    console.error(`[ASANA] Error uploading attachment "${attachment.filename}":`, error);
    
    return {
      success: false,
      filename: attachment.filename,
      error: error.message || 'Unknown error uploading attachment',
    };
  }
}

/**
 * Upload multiple attachments to an Asana task sequentially
 * Sequential upload avoids rate limiting issues
 * 
 * @param taskGid - The Asana task GID
 * @param attachments - Array of attachment data
 * @returns Array of results for each attachment
 */
export async function uploadAsanaAttachments(
  taskGid: string,
  attachments: AsanaAttachmentData[]
): Promise<{
  successful: AsanaAttachmentResult[];
  failed: AsanaAttachmentResult[];
  hasErrors: boolean;
}> {
  const successful: AsanaAttachmentResult[] = [];
  const failed: AsanaAttachmentResult[] = [];

  // Upload sequentially to avoid rate limiting
  for (const attachment of attachments) {
    const result = await uploadAsanaAttachment(taskGid, attachment);
    
    if (result.success) {
      successful.push(result);
    } else {
      failed.push(result);
    }
    
    // Small delay between uploads to be nice to Asana API (100ms)
    if (attachments.indexOf(attachment) < attachments.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    successful,
    failed,
    hasErrors: failed.length > 0,
  };
}
