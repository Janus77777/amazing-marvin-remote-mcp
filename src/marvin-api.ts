import {
  MarvinTask,
  MarvinProject,
  MarvinCategory,
  MarvinLabel,
  MarvinGoal,
  MarvinEvent,
  MarvinTimeBlock,
  CleanTask,
  CleanProject,
  Reference,
  StandardResponse,
  ResponseMetadata,
  ResponseSummary,
  ResponseDebug,
  CloudflareEnv
} from './types';
import { AMAZING_MARVIN_BASE_URL, CACHE_TTL } from './config';

export class MarvinAPIClient {
  private apiKey: string;
  private cache: KVNamespace;
  private baseUrl: string = AMAZING_MARVIN_BASE_URL;

  // CouchDB 連線資訊
  private couchUrl?: string;
  private couchDb?: string;
  private couchUser?: string;
  private couchPassword?: string;

  constructor(apiKey: string, cache: KVNamespace, env?: CloudflareEnv) {
    this.apiKey = apiKey;
    this.cache = cache;

    // 設定 CouchDB 連線資訊（如果有提供）
    if (env) {
      this.couchUrl = env.MARVIN_SYNC_SERVER;
      this.couchDb = env.MARVIN_SYNC_DATABASE;
      this.couchUser = env.MARVIN_SYNC_USER;
      this.couchPassword = env.MARVIN_SYNC_PASSWORD;
    }
  }

  /**
   * Make authenticated request to Amazing Marvin API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-API-Token': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`Marvin API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get cached data or fetch from API
   */
  private async getCachedOrFetch(cacheKey: string, fetchFn: () => Promise<any>, ttl: number = CACHE_TTL): Promise<any> {
    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from API
    const data = await fetchFn();
    
    // Cache the result
    await this.cache.put(cacheKey, JSON.stringify(data), { expirationTtl: ttl });
    
    return data;
  }

  /**
   * Create standardized response
   */
  private createResponse<T>(data: T, message: string, itemCount?: number): StandardResponse<T> {
    return {
      data,
      metadata: {
        source: 'amazing_marvin_api',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID(),
        total_items: itemCount
      },
      summary: {
        message,
        item_count: itemCount,
        status: 'success'
      },
      success: true
    };
  }

  /**
   * Convert Marvin task to clean format
   */
  private convertTask(task: MarvinTask, projects: MarvinProject[] = [], categories: MarvinCategory[] = [], labels: MarvinLabel[] = []): CleanTask {
    const project = task.projectId ? projects.find(p => p._id === task.projectId) : undefined;
    const category = task.categoryId ? categories.find(c => c._id === task.categoryId) : undefined;
    const taskLabels = task.labelIds ? 
      labels.filter(l => task.labelIds?.includes(l._id)).map(l => ({ id: l._id, title: l.title })) : 
      [];

    return {
      id: task._id,
      title: task.title,
      done: task.done,
      day: task.day,
      due_date: task.dueDate,
      priority: task.priority,
      time_estimate: task.timeEstimate,
      project: project ? { id: project._id, title: project.title } : undefined,
      category: category ? { id: category._id, title: category.title } : undefined,
      labels: taskLabels
    };
  }

  /**
   * Convert Marvin project to clean format
   */
  private convertProject(project: MarvinProject, allProjects: MarvinProject[] = [], labels: MarvinLabel[] = []): CleanProject {
    const parentProject = project.parentId ? allProjects.find(p => p._id === project.parentId) : undefined;
    const projectLabels = project.labelIds ? 
      labels.filter(l => project.labelIds?.includes(l._id)).map(l => ({ id: l._id, title: l.title })) : 
      [];

    return {
      id: project._id,
      title: project.title,
      description: project.description,
      parent_project: parentProject ? { id: parentProject._id, title: parentProject.title } : undefined,
      labels: projectLabels
    };
  }

  // ========== READ OPERATIONS ==========

  /**
   * Get today's scheduled tasks
   */
  async getTasks(): Promise<StandardResponse<CleanTask[]>> {
    const cacheKey = `tasks:${new Date().toISOString().split('T')[0]}`;
    
    const [tasks, projects, categories, labels] = await Promise.all([
      this.getCachedOrFetch(`${cacheKey}:raw`, () => this.makeRequest('/todayItems')),
      this.getProjects().then(r => r.data),
      this.getCategories().then(r => r.data),
      this.getLabels().then(r => r.data)
    ]);

    const cleanTasks = tasks.map((task: MarvinTask) => 
      this.convertTask(task, projects, categories, labels)
    );

    return this.createResponse(cleanTasks, `Found ${cleanTasks.length} scheduled tasks for today`, cleanTasks.length);
  }

  /**
   * Get due and overdue items
   */
  async getDueItems(): Promise<StandardResponse<CleanTask[]>> {
    const cacheKey = `due_items:${new Date().toISOString().split('T')[0]}`;
    
    const [tasks, projects, categories, labels] = await Promise.all([
      this.getCachedOrFetch(cacheKey, () => this.makeRequest('/dueItems')),
      this.getProjects().then(r => r.data),
      this.getCategories().then(r => r.data),  
      this.getLabels().then(r => r.data)
    ]);

    const cleanTasks = tasks.map((task: MarvinTask) => 
      this.convertTask(task, projects, categories, labels)
    );

    return this.createResponse(cleanTasks, `Found ${cleanTasks.length} due/overdue items`, cleanTasks.length);
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<StandardResponse<CleanProject[]>> {
    const cacheKey = 'projects:all';
    
    const [categories, labels] = await Promise.all([
      this.getCachedOrFetch(cacheKey, () => this.makeRequest('/categories')),
      this.getLabels().then(r => r.data)
    ]);

    // Filter categories to get only projects
    const projects = categories.filter((cat: any) => cat.type === 'project');
    
    const cleanProjects = projects.map((project: MarvinProject) => 
      this.convertProject(project, projects, labels)
    );

    return this.createResponse(cleanProjects, `Found ${cleanProjects.length} projects`, cleanProjects.length);
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<StandardResponse<Reference[]>> {
    const cacheKey = 'categories:all';
    
    const categories = await this.getCachedOrFetch(cacheKey, () => this.makeRequest('/categories'));
    const cleanCategories = categories.map((cat: MarvinCategory) => ({
      id: cat._id,
      title: cat.title
    }));

    return this.createResponse(cleanCategories, `Found ${cleanCategories.length} categories`, cleanCategories.length);
  }

  /**
   * Get all labels
   */
  async getLabels(): Promise<StandardResponse<Reference[]>> {
    const cacheKey = 'labels:all';
    
    const labels = await this.getCachedOrFetch(cacheKey, () => this.makeRequest('/labels'));
    const cleanLabels = labels.map((label: MarvinLabel) => ({
      id: label._id,
      title: label.title
    }));

    return this.createResponse(cleanLabels, `Found ${cleanLabels.length} labels`, cleanLabels.length);
  }

  /**
   * Get all goals
   */
  async getGoals(): Promise<StandardResponse<MarvinGoal[]>> {
    const cacheKey = 'goals:all';
    const goals = await this.getCachedOrFetch(cacheKey, () => this.makeRequest('/goals'));
    
    return this.createResponse(goals, `Found ${goals.length} goals`, goals.length);
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<StandardResponse<any>> {
    const cacheKey = 'account:info';
    const accountInfo = await this.getCachedOrFetch(cacheKey, () => this.makeRequest('/me'), 3600); // Cache for 1 hour
    
    return this.createResponse(accountInfo, 'Retrieved account information');
  }

  /**
   * Get child tasks (subtasks)
   */
  async getChildTasks(parentId: string, recursive: boolean = false): Promise<StandardResponse<CleanTask[]>> {
    const cacheKey = `children:${parentId}:${recursive}`;
    
    const [children, projects, categories, labels] = await Promise.all([
      this.getCachedOrFetch(cacheKey, () => this.makeRequest(`/children/${parentId}`)),
      this.getProjects().then(r => r.data),
      this.getCategories().then(r => r.data),
      this.getLabels().then(r => r.data)
    ]);

    let allChildren = children;

    // If recursive, get all nested children
    if (recursive && children.length > 0) {
      const nestedChildren = await Promise.all(
        children.map(async (child: MarvinTask) => {
          const nested = await this.getChildTasks(child._id, true);
          return nested.data;
        })
      );
      allChildren = [...children, ...nestedChildren.flat()];
    }

    const cleanTasks = allChildren.map((task: MarvinTask) => 
      this.convertTask(task, projects, categories, labels)
    );

    return this.createResponse(cleanTasks, `Found ${cleanTasks.length} child tasks`, cleanTasks.length);
  }

  /**
   * Get completed tasks
   */
  async getCompletedTasks(days: number = 7): Promise<StandardResponse<CleanTask[]>> {
    const cacheKey = `completed:${days}:${new Date().toISOString().split('T')[0]}`;
    
    const [completedTasks, projects, categories, labels] = await Promise.all([
      this.getCachedOrFetch(cacheKey, () => this.makeRequest(`/doneItems?days=${days}`)),
      this.getProjects().then(r => r.data),
      this.getCategories().then(r => r.data),
      this.getLabels().then(r => r.data)
    ]);

    const cleanTasks = completedTasks.map((task: MarvinTask) => 
      this.convertTask(task, projects, categories, labels)
    );

    return this.createResponse(cleanTasks, `Found ${cleanTasks.length} completed tasks in the last ${days} days`, cleanTasks.length);
  }

  /**
   * Get completed tasks for specific date
   */
  async getCompletedTasksForDate(date: string): Promise<StandardResponse<CleanTask[]>> {
    const cacheKey = `completed:${date}`;
    
    const [completedTasks, projects, categories, labels] = await Promise.all([
      this.getCachedOrFetch(cacheKey, () => this.makeRequest(`/doneItems?date=${date}`)),
      this.getProjects().then(r => r.data),
      this.getCategories().then(r => r.data),
      this.getLabels().then(r => r.data)
    ]);

    const cleanTasks = completedTasks.map((task: MarvinTask) => 
      this.convertTask(task, projects, categories, labels)
    );

    return this.createResponse(cleanTasks, `Found ${cleanTasks.length} completed tasks on ${date}`, cleanTasks.length);
  }

  /**
   * Get all tasks, optionally filtered by label
   */
  async getAllTasks(labelFilter?: string): Promise<StandardResponse<CleanTask[]>> {
    const cacheKey = `all_tasks:${labelFilter || 'none'}`;
    
    // Get all tasks from inbox (unassigned/root), today's tasks, and due tasks
    const [inboxTasks, todayTasks, dueTasks, projects, categories, labels] = await Promise.all([
      this.getCachedOrFetch(`${cacheKey}:inbox`, () => this.makeRequest('/children?id=root')),
      this.getCachedOrFetch(`${cacheKey}:today`, () => this.makeRequest('/todayItems')),
      this.getCachedOrFetch(`${cacheKey}:due`, () => this.makeRequest('/dueItems')),
      this.getProjects().then(r => r.data),
      this.getCategories().then(r => r.data),
      this.getLabels().then(r => r.data)
    ]);

    // Combine all tasks and remove duplicates by ID
    const allTasksMap = new Map();
    
    // Add inbox tasks (ensure they're arrays)
    if (Array.isArray(inboxTasks)) {
      inboxTasks.forEach((task: MarvinTask) => {
        allTasksMap.set(task._id, task);
      });
    }
    
    // Add today's tasks  
    if (Array.isArray(todayTasks)) {
      todayTasks.forEach((task: MarvinTask) => {
        allTasksMap.set(task._id, task);
      });
    }
    
    // Add due tasks
    if (Array.isArray(dueTasks)) {
      dueTasks.forEach((task: MarvinTask) => {
        allTasksMap.set(task._id, task);
      });
    }
    
    let filteredTasks = Array.from(allTasksMap.values()) as MarvinTask[];
    
    if (labelFilter) {
      const targetLabel = labels.find((l: Reference) => l.title.toLowerCase() === labelFilter.toLowerCase());
      if (targetLabel) {
        filteredTasks = filteredTasks.filter((task: MarvinTask) => 
          task.labelIds?.includes(targetLabel.id)
        );
      }
    }

    const cleanTasks = filteredTasks.map((task: MarvinTask) => 
      this.convertTask(task, projects, categories, labels)
    );

    const inboxCount = Array.isArray(inboxTasks) ? inboxTasks.length : 0;
    const todayCount = Array.isArray(todayTasks) ? todayTasks.length : 0;
    const dueCount = Array.isArray(dueTasks) ? dueTasks.length : 0;

    return this.createResponse(
      cleanTasks, 
      `Found ${cleanTasks.length} tasks from inbox (${inboxCount}), today (${todayCount}), and due (${dueCount}) items${labelFilter ? ` with label "${labelFilter}"` : ''}`, 
      cleanTasks.length
    );
  }

  // ========== WRITE OPERATIONS ==========

  /**
   * Create a new task
   */
  async createTask(taskData: any): Promise<StandardResponse<CleanTask>> {
    const payload = {
      title: taskData.title,
      day: taskData.day,
      dueDate: taskData.due_date,
      timeEstimate: taskData.time_estimate,
      projectId: taskData.project_id,
      categoryId: taskData.category_id,
      labelIds: taskData.label_ids,
      parentId: taskData.parent_id
    };

    const newTask = await this.makeRequest('/addTask', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Invalidate relevant caches
    await this.invalidateCache(['tasks:', 'all_tasks:']);

    const [projects, categories, labels] = await Promise.all([
      this.getProjects().then(r => r.data),
      this.getCategories().then(r => r.data),
      this.getLabels().then(r => r.data)
    ]);

    const cleanTask = this.convertTask(newTask, projects, categories, labels);
    return this.createResponse(cleanTask, `Created task: ${cleanTask.title}`);
  }

  /**
   * Mark task as done
   */
  async markTaskDone(taskId: string): Promise<StandardResponse<boolean>> {
    await this.makeRequest('/edit', {
      method: 'POST',
      body: JSON.stringify({
        itemId: taskId,
        done: true
      })
    });

    // Invalidate relevant caches
    await this.invalidateCache(['tasks:', 'completed:']);

    return this.createResponse(true, `Marked task ${taskId} as completed`);
  }

  /**
   * Delete task permanently
   */
  async deleteTask(taskId: string): Promise<StandardResponse<boolean>> {
    if (!this.isCouchDBConfigured()) {
      throw new Error('CouchDB not configured. Cannot delete tasks without database access.');
    }

    // CouchDB delete requires the document's _rev
    // Step 1: Get the document to retrieve its _rev
    const docUrl = `${this.couchUrl}/${this.couchDb}/${taskId}`;
    const getResponse = await fetch(docUrl, {
      headers: {
        'Authorization': this.createCouchAuthHeader()
      }
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to get task for deletion: ${getResponse.status} ${getResponse.statusText}`);
    }

    const doc = await getResponse.json();

    // Step 2: Delete the document using its _rev
    const deleteResponse = await fetch(`${docUrl}?rev=${doc._rev}`, {
      method: 'DELETE',
      headers: {
        'Authorization': this.createCouchAuthHeader()
      }
    });

    if (!deleteResponse.ok) {
      throw new Error(`CouchDB delete error: ${deleteResponse.status} ${deleteResponse.statusText}`);
    }

    // Invalidate relevant caches
    await this.invalidateCache(['tasks:', 'all_tasks:', 'completed:']);

    return this.createResponse(true, `Deleted task ${taskId} permanently via CouchDB`);
  }

  /**
   * Create a new project
   */
  async createProject(projectData: any): Promise<StandardResponse<CleanProject>> {
    const payload = {
      title: projectData.title,
      description: projectData.description,
      parentId: projectData.parent_id
    };

    const newProject = await this.makeRequest('/addProject', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Invalidate projects cache
    await this.invalidateCache(['projects:']);

    const [allProjects, labels] = await Promise.all([
      this.getProjects().then(r => r.data),
      this.getLabels().then(r => r.data)
    ]);

    const cleanProject = this.convertProject(newProject, allProjects, labels);
    return this.createResponse(cleanProject, `Created project: ${cleanProject.title}`);
  }

  /**
   * Start time tracking for a task
   */
  async startTimeTracking(taskId: string): Promise<StandardResponse<any>> {
    const result = await this.makeRequest('/startTimeTracking', {
      method: 'POST',
      body: JSON.stringify({ itemId: taskId })
    });

    return this.createResponse(result, `Started time tracking for task ${taskId}`);
  }

  /**
   * Stop time tracking
   */
  async stopTimeTracking(): Promise<StandardResponse<any>> {
    const result = await this.makeRequest('/stopTimeTracking', {
      method: 'POST'
    });

    return this.createResponse(result, 'Stopped time tracking');
  }

  /**
   * Batch mark tasks as done
   */
  async batchMarkDone(taskIds: string[]): Promise<StandardResponse<boolean[]>> {
    const results = await Promise.all(
      taskIds.map(async (id) => {
        try {
          await this.markTaskDone(id);
          return true;
        } catch {
          return false;
        }
      })
    );

    const successCount = results.filter(r => r).length;
    return this.createResponse(results, `Marked ${successCount}/${taskIds.length} tasks as completed`);
  }

  /**
   * Delete multiple tasks in batch
   */
  async batchDeleteTasks(taskIds: string[]): Promise<StandardResponse<{ results: boolean[], deleted: string[], failed: Array<{id: string, error: string}> }>> {
    const results: boolean[] = [];
    const deleted: string[] = [];
    const failed: Array<{id: string, error: string}> = [];

    await Promise.all(
      taskIds.map(async (id) => {
        try {
          await this.deleteTask(id);
          results.push(true);
          deleted.push(id);
        } catch (error) {
          results.push(false);
          failed.push({
            id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );

    const successCount = results.filter(r => r).length;
    const errorSummary = failed.length > 0
      ? `\nErrors: ${failed.slice(0, 3).map(f => `${f.id}: ${f.error}`).join('; ')}${failed.length > 3 ? ` and ${failed.length - 3} more...` : ''}`
      : '';

    return this.createResponse(
      { results, deleted, failed },
      `Deleted ${successCount}/${taskIds.length} tasks permanently.${errorSummary}`,
      successCount
    );
  }

  /**
   * Batch create tasks
   */
  async batchCreateTasks(tasksData: any[]): Promise<StandardResponse<CleanTask[]>> {
    const results = await Promise.all(
      tasksData.map(async (taskData) => {
        try {
          const result = await this.createTask(taskData);
          return result.data;
        } catch (error) {
          return null;
        }
      })
    );

    const successfulTasks = results.filter(t => t !== null) as CleanTask[];
    return this.createResponse(successfulTasks, `Created ${successfulTasks.length}/${tasksData.length} tasks`);
  }

  /**
   * Get time tracking summary
   */
  async getTimeTrackingSummary(days: number = 7): Promise<StandardResponse<any>> {
    const cacheKey = `time_tracking:${days}:${new Date().toISOString().split('T')[0]}`;
    
    const summary = await this.getCachedOrFetch(cacheKey, () => 
      this.makeRequest(`/timeTrackingDailySummary?days=${days}`)
    );

    return this.createResponse(summary, `Retrieved time tracking summary for ${days} days`);
  }

  /**
   * Get time tracks (detailed records)
   */
  async getTimeTracks(startDate?: string, endDate?: string): Promise<StandardResponse<any[]>> {
    let endpoint = '/timeTracks';
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const cacheKey = `time_tracks:${startDate || 'all'}:${endDate || 'all'}`;
    const tracks = await this.getCachedOrFetch(cacheKey, () => this.makeRequest(endpoint));

    return this.createResponse(tracks, `Retrieved ${tracks.length} time tracking records`);
  }

  /**
   * Invalidate cache entries by prefix
   */
  private async invalidateCache(prefixes: string[]): Promise<void> {
    // Note: KV doesn't support listing keys, so we can't easily invalidate by prefix
    // In a real implementation, you might use a different caching strategy
    // For now, we'll just clear specific known cache keys
    const today = new Date().toISOString().split('T')[0];
    const keysToDelete = [
      `tasks:${today}`,
      `tasks:${today}:raw`,
      'projects:all',
      'all_tasks:none',
      `completed:${today}`
    ];

    await Promise.all(
      keysToDelete.map(key => this.cache.delete(key))
    );
  }

  // ==================== CouchDB 操作方法 ====================

  /**
   * 檢查 CouchDB 連線設定是否完整
   */
  private isCouchDBConfigured(): boolean {
    return !!(this.couchUrl && this.couchDb && this.couchUser && this.couchPassword);
  }

  /**
   * 建立 CouchDB 認證標頭
   */
  private createCouchAuthHeader(): string {
    if (!this.couchUser || !this.couchPassword) {
      throw new Error('CouchDB credentials not configured');
    }
    return 'Basic ' + btoa(`${this.couchUser}:${this.couchPassword}`);
  }

  /**
   * 向 CouchDB 寫入文件
   */
  private async postToCouch(doc: any): Promise<any> {
    if (!this.isCouchDBConfigured()) {
      throw new Error('CouchDB not configured. Please set MARVIN_SYNC_* environment variables.');
    }

    const url = `${this.couchUrl}/${this.couchDb}`;
    const headers = {
      'Authorization': this.createCouchAuthHeader(),
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(doc)
    });

    if (!response.ok) {
      throw new Error(`CouchDB error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 將本地時間轉換為 UTC ISO 字串
   */
  private convertToUTCISO(localDateTimeStr: string, timeZone: string = 'Asia/Taipei'): string {
    // 簡化版本：假設輸入是 "YYYY-MM-DD HH:MM" 格式
    const [datePart, timePart] = localDateTimeStr.split(' ');
    const localDateTime = new Date(`${datePart}T${timePart}:00`);

    // 注意：這是簡化版本，實際上可能需要更精確的時區處理
    // 假設台北時間 UTC+8
    const utcDateTime = new Date(localDateTime.getTime() - (8 * 60 * 60 * 1000));
    return utcDateTime.toISOString();
  }

  /**
   * 建立 Event（事件）
   */
  async createEvent(params: {
    title: string;
    start: string; // "YYYY-MM-DD HH:MM" 本地時間
    durationMin?: number;
    allDay?: boolean;
    notes?: string;
    calId?: string;
  }): Promise<StandardResponse<{ id: string }>> {
    const now = Date.now();

    let startISO: string;
    let lengthMs: number;

    if (params.allDay) {
      // 全天事件：設為當地 00:00，長度 24 小時
      const [datePart] = params.start.split(' ');
      startISO = this.convertToUTCISO(`${datePart} 00:00`);
      lengthMs = 24 * 60 * 60 * 1000; // 24 小時
    } else {
      startISO = this.convertToUTCISO(params.start);
      lengthMs = (params.durationMin || 60) * 60 * 1000; // 預設 60 分鐘
    }

    const eventDoc: MarvinEvent = {
      db: "Events",
      title: params.title,
      start: startISO,
      length: lengthMs,
      isAllDay: params.allDay || false,
      notes: params.notes || "",
      createdAt: now,
      updatedAt: now
    };

    if (params.calId) {
      eventDoc.calId = params.calId;
    }

    const result = await this.postToCouch(eventDoc);

    return this.createResponse(
      { id: result.id },
      `Event "${params.title}" created successfully`,
      1
    );
  }

  /**
   * 建立 Time Block（時間區塊）
   */
  async createTimeBlock(params: {
    title: string;
    date: string; // "YYYY-MM-DD"
    time: string; // "HH:MM"
    durationMin: number;
    notes?: string;
  }): Promise<StandardResponse<{ id: string }>> {
    const now = Date.now();

    const timeBlockDoc: MarvinTimeBlock = {
      db: "PlannerItems",
      title: params.title,
      date: params.date,
      time: params.time,
      duration: params.durationMin,
      notes: params.notes || "",
      createdAt: now,
      updatedAt: now
    };

    const result = await this.postToCouch(timeBlockDoc);

    return this.createResponse(
      { id: result.id },
      `Time Block "${params.title}" created successfully`,
      1
    );
  }

  /**
   * Batch create multiple events
   */
  async batchCreateEvents(events: Array<{
    title: string;
    start: string;
    durationMin?: number;
    allDay?: boolean;
    notes?: string;
    calId?: string;
  }>): Promise<StandardResponse<{
    created: string[],
    failed: Array<{title: string, start: string, error: string}>
  }>> {
    const created: string[] = [];
    const failed: Array<{title: string, start: string, error: string}> = [];

    await Promise.all(
      events.map(async (event) => {
        try {
          const result = await this.createEvent(event);
          created.push(result.data.id);
        } catch (error) {
          failed.push({
            title: event.title,
            start: event.start,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );

    const successCount = created.length;
    const errorSummary = failed.length > 0
      ? ` ${failed.length} failed.`
      : '';

    return this.createResponse(
      { created, failed },
      `Created ${successCount}/${events.length} events.${errorSummary}`,
      successCount
    );
  }
}