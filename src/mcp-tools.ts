import { MarvinAPIClient } from './marvin-api';
import { CloudflareEnv, MCPRequest, MCPResponse, StandardResponse } from './types';

export class MCPToolHandler {
  private apiClient: MarvinAPIClient;

  constructor(apiClient: MarvinAPIClient) {
    this.apiClient = apiClient;
  }

  /**
   * Handle MCP tool calls
   */
  async handleToolCall(toolName: string, params: any = {}): Promise<StandardResponse<any>> {
    try {
      switch (toolName) {
        // ========== READ OPERATIONS ==========
        case 'get_daily_productivity_overview':
          return await this.getDailyProductivityOverview();
        
        case 'get_tasks':
          return await this.apiClient.getTasks();
        
        case 'get_projects':
          return await this.apiClient.getProjects();
        
        case 'get_categories':
          return await this.apiClient.getCategories();
        
        case 'get_due_items':
          return await this.apiClient.getDueItems();
        
        case 'get_child_tasks':
          return await this.apiClient.getChildTasks(params.parent_id, params.recursive || false);
        
        case 'get_all_tasks':
          return await this.apiClient.getAllTasks(params.label);
        
        case 'get_labels':
          return await this.apiClient.getLabels();
        
        case 'get_goals':
          return await this.apiClient.getGoals();
        
        case 'get_account_info':
          return await this.apiClient.getAccountInfo();
        
        case 'get_completed_tasks':
          return await this.apiClient.getCompletedTasks(params.days || 7);
        
        case 'get_completed_tasks_for_date':
          return await this.apiClient.getCompletedTasksForDate(params.date);

        // ========== WRITE OPERATIONS ==========
        case 'create_task':
          return await this.apiClient.createTask(params);
        
        case 'mark_task_done':
          return await this.apiClient.markTaskDone(params.task_id);
        
        case 'create_project':
          return await this.apiClient.createProject(params);
        
        case 'start_time_tracking':
          return await this.apiClient.startTimeTracking(params.task_id);
        
        case 'stop_time_tracking':
          return await this.apiClient.stopTimeTracking();
        
        case 'batch_mark_done':
          return await this.apiClient.batchMarkDone(params.task_ids);
        
        case 'batch_create_tasks':
          return await this.apiClient.batchCreateTasks(params.tasks);
        
        case 'create_project_with_tasks':
          return await this.createProjectWithTasks(params);
        
        case 'quick_daily_planning':
          return await this.quickDailyPlanning();
        
        case 'get_daily_focus':
          return await this.getDailyFocus();

        // ========== ANALYTICS OPERATIONS ==========
        case 'get_productivity_summary':
          return await this.getProductivitySummary();
        
        case 'get_productivity_summary_for_time_range':
          return await this.getProductivitySummaryForTimeRange(params.start_date, params.end_date);
        
        case 'get_project_overview':
          return await this.getProjectOverview();
        
        case 'get_time_tracking_summary':
          return await this.apiClient.getTimeTrackingSummary(params.days || 7);
        
        case 'get_done_items':
          return await this.apiClient.getCompletedTasks(params.days || 7);
        
        case 'get_time_tracks':
          return await this.apiClient.getTimeTracks(params.start_date, params.end_date);

        // ========== CALENDAR/EVENT OPERATIONS ==========
        case 'create_event':
          return await this.apiClient.createEvent({
            title: params.title,
            start: params.start,
            durationMin: params.duration_min,
            allDay: params.all_day || false,
            notes: params.notes,
            calId: params.cal_id
          });

        case 'create_time_block':
          return await this.apiClient.createTimeBlock({
            title: params.title,
            date: params.date,
            time: params.time,
            durationMin: params.duration_min,
            notes: params.notes
          });

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        data: null,
        metadata: {
          source: 'amazing_marvin_mcp',
          timestamp: new Date().toISOString(),
          request_id: crypto.randomUUID()
        },
        summary: {
          message: `Error executing tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'error'
        },
        debug: {
          processing_time_ms: 0
        },
        success: false
      };
    }
  }

  // ========== COMPLEX OPERATIONS ==========

  /**
   * Get comprehensive daily productivity overview
   */
  private async getDailyProductivityOverview(): Promise<StandardResponse<any>> {
    const [tasks, dueItems, projects, completedToday] = await Promise.all([
      this.apiClient.getTasks(),
      this.apiClient.getDueItems(),
      this.apiClient.getProjects(),
      this.apiClient.getCompletedTasksForDate(new Date().toISOString().split('T')[0])
    ]);

    const overview = {
      today_scheduled: tasks.data,
      due_overdue: dueItems.data,
      completed_today: completedToday.data,
      active_projects: projects.data.slice(0, 10), // Top 10 projects
      summary: {
        scheduled_count: tasks.data.length,
        due_count: dueItems.data.length,
        completed_count: completedToday.data.length,
        completion_rate: tasks.data.length > 0 ? 
          Math.round((completedToday.data.length / tasks.data.length) * 100) : 0
      }
    };

    return {
      data: overview,
      metadata: {
        source: 'amazing_marvin_mcp',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      },
      summary: {
        message: `Daily overview: ${overview.summary.scheduled_count} scheduled, ${overview.summary.completed_count} completed (${overview.summary.completion_rate}% rate)`,
        status: 'success'
      },
      success: true
    };
  }

  /**
   * Create project with tasks
   */
  private async createProjectWithTasks(params: any): Promise<StandardResponse<any>> {
    // First create the project
    const projectResult = await this.apiClient.createProject({
      title: params.project_title,
      description: params.project_description
    });

    if (!projectResult.success) {
      return projectResult;
    }

    // Then create tasks for the project
    const tasksWithProject = params.tasks.map((task: any) => ({
      ...task,
      project_id: projectResult.data.id
    }));

    const tasksResult = await this.apiClient.batchCreateTasks(tasksWithProject);

    return {
      data: {
        project: projectResult.data,
        tasks: tasksResult.data,
        stats: {
          project_created: true,
          tasks_created: tasksResult.data.length,
          total_requested: params.tasks.length
        }
      },
      metadata: {
        source: 'amazing_marvin_mcp',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      },
      summary: {
        message: `Created project "${projectResult.data.title}" with ${tasksResult.data.length}/${params.tasks.length} tasks`,
        status: 'success'
      },
      success: true
    };
  }

  /**
   * Quick daily planning overview
   */
  private async quickDailyPlanning(): Promise<StandardResponse<any>> {
    const [tasks, dueItems, projects] = await Promise.all([
      this.apiClient.getTasks(),
      this.apiClient.getDueItems(),
      this.apiClient.getProjects()
    ]);

    // Categorize tasks by priority and project
    const highPriorityTasks = tasks.data.filter(t => t.priority === 'high' || t.priority === '1');
    const projectTasks = tasks.data.filter(t => t.project);
    const quickTasks = tasks.data.filter(t => t.time_estimate && t.time_estimate <= 15);

    const planning = {
      focus_areas: {
        urgent_due: dueItems.data.slice(0, 5),
        high_priority: highPriorityTasks.slice(0, 5),
        project_work: projectTasks.slice(0, 5),
        quick_wins: quickTasks.slice(0, 5)
      },
      time_breakdown: {
        total_estimated: tasks.data.reduce((sum, t) => sum + (t.time_estimate || 0), 0),
        high_priority_time: highPriorityTasks.reduce((sum, t) => sum + (t.time_estimate || 0), 0),
        project_time: projectTasks.reduce((sum, t) => sum + (t.time_estimate || 0), 0)
      },
      recommendations: this.generatePlanningRecommendations(tasks.data, dueItems.data)
    };

    return {
      data: planning,
      metadata: {
        source: 'amazing_marvin_mcp',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      },
      summary: {
        message: `Daily planning: ${tasks.data.length} tasks scheduled, ${planning.time_breakdown.total_estimated}min estimated`,
        status: 'success'
      },
      success: true
    };
  }

  /**
   * Get daily focus tasks by category
   */
  private async getDailyFocus(): Promise<StandardResponse<any>> {
    const [tasks, categories] = await Promise.all([
      this.apiClient.getTasks(),
      this.apiClient.getCategories()
    ]);

    const focusAreas = {
      deep_work: tasks.data.filter(t => 
        t.time_estimate && t.time_estimate >= 60 || 
        t.category?.title.toLowerCase().includes('focus') ||
        t.category?.title.toLowerCase().includes('deep')
      ),
      admin: tasks.data.filter(t =>
        t.category?.title.toLowerCase().includes('admin') ||
        t.category?.title.toLowerCase().includes('email') ||
        t.time_estimate && t.time_estimate <= 15
      ),
      creative: tasks.data.filter(t =>
        t.category?.title.toLowerCase().includes('creative') ||
        t.category?.title.toLowerCase().includes('writing') ||
        t.category?.title.toLowerCase().includes('design')
      ),
      meetings: tasks.data.filter(t =>
        t.category?.title.toLowerCase().includes('meeting') ||
        t.title.toLowerCase().includes('call') ||
        t.title.toLowerCase().includes('meeting')
      ),
      learning: tasks.data.filter(t =>
        t.category?.title.toLowerCase().includes('learning') ||
        t.category?.title.toLowerCase().includes('study') ||
        t.title.toLowerCase().includes('learn')
      )
    };

    return {
      data: focusAreas,
      metadata: {
        source: 'amazing_marvin_mcp',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      },
      summary: {
        message: `Daily focus areas: ${Object.values(focusAreas).flat().length} categorized tasks`,
        status: 'success'
      },
      success: true
    };
  }

  /**
   * Get current productivity summary
   */
  private async getProductivitySummary(): Promise<StandardResponse<any>> {
    const today = new Date().toISOString().split('T')[0];
    const [todayTasks, completedToday, dueItems, timeTracking] = await Promise.all([
      this.apiClient.getTasks(),
      this.apiClient.getCompletedTasksForDate(today),
      this.apiClient.getDueItems(),
      this.apiClient.getTimeTrackingSummary(1)
    ]);

    const summary = {
      daily_stats: {
        scheduled: todayTasks.data.length,
        completed: completedToday.data.length,
        completion_rate: todayTasks.data.length > 0 ? 
          Math.round((completedToday.data.length / todayTasks.data.length) * 100) : 0,
        overdue: dueItems.data.length
      },
      time_stats: {
        estimated_total: todayTasks.data.reduce((sum, t) => sum + (t.time_estimate || 0), 0),
        completed_time: completedToday.data.reduce((sum, t) => sum + (t.time_estimate || 0), 0),
        tracked_time: timeTracking.data?.today?.totalTracked || 0
      },
      performance: {
        efficiency: this.calculateEfficiency(completedToday.data, todayTasks.data),
        focus_score: this.calculateFocusScore(timeTracking.data),
        consistency_trend: 'stable' // Would need historical data for real calculation
      }
    };

    return {
      data: summary,
      metadata: {
        source: 'amazing_marvin_mcp',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      },
      summary: {
        message: `Productivity: ${summary.daily_stats.completion_rate}% completion rate, ${summary.time_stats.tracked_time}min tracked`,
        status: 'success'
      },
      success: true
    };
  }

  /**
   * Get productivity summary for time range
   */
  private async getProductivitySummaryForTimeRange(startDate: string, endDate: string): Promise<StandardResponse<any>> {
    // Get completed tasks for the range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const [completedTasks, timeTracking] = await Promise.all([
      this.apiClient.getCompletedTasks(days),
      this.apiClient.getTimeTracks(startDate, endDate)
    ]);

    const summary = {
      period: {
        start_date: startDate,
        end_date: endDate,
        days: days
      },
      totals: {
        completed_tasks: completedTasks.data.length,
        total_time_tracked: timeTracking.data.reduce((sum: number, track: any) => sum + (track.duration || 0), 0),
        avg_tasks_per_day: Math.round(completedTasks.data.length / days),
        avg_time_per_day: Math.round(timeTracking.data.reduce((sum: number, track: any) => sum + (track.duration || 0), 0) / days)
      },
      breakdown: {
        by_project: this.groupTasksByProject(completedTasks.data),
        by_category: this.groupTasksByCategory(completedTasks.data),
        by_day: this.groupTasksByDay(completedTasks.data)
      }
    };

    return {
      data: summary,
      metadata: {
        source: 'amazing_marvin_mcp',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      },
      summary: {
        message: `Period summary: ${summary.totals.completed_tasks} tasks completed over ${days} days`,
        status: 'success'
      },
      success: true
    };
  }

  /**
   * Get project overview with metrics
   */
  private async getProjectOverview(): Promise<StandardResponse<any>> {
    const [projects, allTasks, completedTasks] = await Promise.all([
      this.apiClient.getProjects(),
      this.apiClient.getAllTasks(),
      this.apiClient.getCompletedTasks(30) // Last 30 days
    ]);

    const projectMetrics = projects.data.map(project => {
      const projectTasks = allTasks.data.filter(t => t.project?.id === project.id);
      const projectCompleted = completedTasks.data.filter(t => t.project?.id === project.id);
      
      return {
        ...project,
        metrics: {
          total_tasks: projectTasks.length,
          completed_tasks: projectCompleted.length,
          completion_rate: projectTasks.length > 0 ? 
            Math.round((projectCompleted.length / projectTasks.length) * 100) : 0,
          estimated_time: projectTasks.reduce((sum, t) => sum + (t.time_estimate || 0), 0),
          status: this.getProjectStatus(projectTasks, projectCompleted)
        }
      };
    });

    return {
      data: {
        projects: projectMetrics,
        summary: {
          total_projects: projects.data.length,
          active_projects: projectMetrics.filter(p => p.metrics.status === 'active').length,
          completed_projects: projectMetrics.filter(p => p.metrics.status === 'completed').length,
          avg_completion_rate: Math.round(
            projectMetrics.reduce((sum, p) => sum + p.metrics.completion_rate, 0) / projectMetrics.length
          )
        }
      },
      metadata: {
        source: 'amazing_marvin_mcp',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      },
      summary: {
        message: `Project overview: ${projects.data.length} projects tracked`,
        status: 'success'
      },
      success: true
    };
  }

  // ========== HELPER METHODS ==========

  private generatePlanningRecommendations(tasks: any[], dueItems: any[]): string[] {
    const recommendations = [];

    if (dueItems.length > 0) {
      recommendations.push(`Focus on ${dueItems.length} overdue/due items first`);
    }

    const totalTime = tasks.reduce((sum, t) => sum + (t.time_estimate || 0), 0);
    if (totalTime > 480) { // 8 hours
      recommendations.push('Consider moving some tasks to tomorrow - workload seems heavy');
    }

    const highPriorityTasks = tasks.filter(t => t.priority === 'high' || t.priority === '1');
    if (highPriorityTasks.length > 5) {
      recommendations.push('Too many high priority items - consider reprioritizing');
    }

    if (tasks.length > 15) {
      recommendations.push('Consider batching similar tasks together');
    }

    return recommendations.length > 0 ? recommendations : ['Looks like a well-balanced day!'];
  }

  private calculateEfficiency(completedTasks: any[], allTasks: any[]): number {
    if (allTasks.length === 0) return 0;
    return Math.round((completedTasks.length / allTasks.length) * 100);
  }

  private calculateFocusScore(timeTrackingData: any): number {
    // Simple focus score based on time tracking consistency
    // In a real implementation, this would be more sophisticated
    return Math.round(Math.random() * 40 + 60); // Placeholder
  }

  private groupTasksByProject(tasks: any[]): Record<string, number> {
    return tasks.reduce((acc, task) => {
      const projectName = task.project?.title || 'No Project';
      acc[projectName] = (acc[projectName] || 0) + 1;
      return acc;
    }, {});
  }

  private groupTasksByCategory(tasks: any[]): Record<string, number> {
    return tasks.reduce((acc, task) => {
      const categoryName = task.category?.title || 'No Category';
      acc[categoryName] = (acc[categoryName] || 0) + 1;
      return acc;
    }, {});
  }

  private groupTasksByDay(tasks: any[]): Record<string, number> {
    return tasks.reduce((acc, task) => {
      const day = task.day || 'No Date';
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});
  }

  private getProjectStatus(projectTasks: any[], completedTasks: any[]): string {
    if (projectTasks.length === 0) return 'empty';
    if (completedTasks.length === projectTasks.length) return 'completed';
    if (completedTasks.length > 0) return 'active';
    return 'not_started';
  }
}