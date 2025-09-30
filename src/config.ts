import { MCPTool } from './types';

export const MCP_TOOLS: MCPTool[] = [
  // Test tool (no auth needed)
  {
    name: "test_connection",
    description: "Test the MCP server connection - no authentication required",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "marvin_test_connection",
    description: "Test the connection to Amazing Marvin API",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  // Read Operations (12 Tools)  
  {
    name: "get_daily_productivity_overview",
    description: "Get a comprehensive overview of today's productivity including scheduled tasks, projects, and focus areas",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_tasks",
    description: "Get today's scheduled tasks and items",
    inputSchema: {
      type: "object", 
      properties: {},
      required: []
    }
  },
  {
    name: "get_projects",
    description: "Get all projects in Amazing Marvin",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_categories",
    description: "Get all categories in Amazing Marvin",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_due_items", 
    description: "Get overdue and due items",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_child_tasks",
    description: "Get child tasks (subtasks) of a parent task",
    inputSchema: {
      type: "object",
      properties: {
        parent_id: {
          type: "string",
          description: "The ID of the parent task"
        },
        recursive: {
          type: "boolean", 
          description: "Whether to get all nested subtasks recursively",
          default: false
        }
      },
      required: ["parent_id"]
    }
  },
  {
    name: "get_all_tasks",
    description: "Get all tasks, optionally filtered by label",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "Optional label name to filter tasks by"
        }
      },
      required: []
    }
  },
  {
    name: "get_labels",
    description: "Get all task labels", 
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_goals",
    description: "Get all goals and objectives",
    inputSchema: {
      type: "object", 
      properties: {},
      required: []
    }
  },
  {
    name: "get_account_info",
    description: "Get account information and settings",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_completed_tasks", 
    description: "Get completed tasks for the last 7 days by default",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default: 7)",
          default: 7
        }
      },
      required: []
    }
  },
  {
    name: "get_completed_tasks_for_date",
    description: "Get completed tasks for a specific date",
    inputSchema: {
      type: "object", 
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format"
        }
      },
      required: ["date"]
    }
  },

  // Write Operations (10 Tools) 
  {
    name: "create_task",
    description: "Create a new task in Amazing Marvin",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Task title"
        },
        day: {
          type: "string", 
          description: "Schedule date in YYYY-MM-DD format"
        },
        due_date: {
          type: "string",
          description: "Due date in YYYY-MM-DD format"
        },
        time_estimate: {
          type: "number",
          description: "Time estimate in minutes"
        },
        project_id: {
          type: "string",
          description: "Project ID to assign task to"
        },
        category_id: {
          type: "string", 
          description: "Category ID to assign task to"
        },
        label_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of label IDs"
        },
        parent_id: {
          type: "string",
          description: "Parent task ID for subtasks"
        }
      },
      required: ["title"]
    }
  },
  {
    name: "mark_task_done",
    description: "Mark a task as completed",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string", 
          description: "The ID of the task to mark as done"
        }
      },
      required: ["task_id"]
    }
  },
  {
    name: "create_project",
    description: "Create a new project",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Project title"
        },
        description: {
          type: "string",
          description: "Project description"
        },
        parent_id: {
          type: "string",
          description: "Parent project ID for sub-projects"
        }
      },
      required: ["title"]
    }
  },
  {
    name: "start_time_tracking",
    description: "Start time tracking for a task",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "The ID of the task to track time for"
        }
      },
      required: ["task_id"]
    }
  },
  {
    name: "stop_time_tracking", 
    description: "Stop current time tracking",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "batch_mark_done",
    description: "Mark multiple tasks as completed",
    inputSchema: {
      type: "object",
      properties: {
        task_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of task IDs to mark as done"
        }
      },
      required: ["task_ids"]
    }
  },
  {
    name: "batch_create_tasks",
    description: "Create multiple tasks at once",
    inputSchema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              day: { type: "string" },
              project_id: { type: "string" },
              time_estimate: { type: "number" }
            },
            required: ["title"]
          },
          description: "Array of task objects to create"
        }
      },
      required: ["tasks"]
    }
  },
  {
    name: "create_project_with_tasks",
    description: "Create a project and add tasks to it",
    inputSchema: {
      type: "object",
      properties: {
        project_title: {
          type: "string",
          description: "Title of the project to create"
        },
        project_description: {
          type: "string", 
          description: "Description of the project"
        },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              time_estimate: { type: "number" }
            },
            required: ["title"]
          },
          description: "Array of tasks to create in the project"
        }
      },
      required: ["project_title", "tasks"]
    }
  },
  {
    name: "quick_daily_planning",
    description: "Generate a daily planning overview with prioritized tasks",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_daily_focus",
    description: "Get categorized daily tasks for focused work",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  // Calendar/Event Operations (2 Tools)
  {
    name: "create_event",
    description: "Create a new Event in Amazing Marvin with start time and duration. Supports all-day events and syncs with external calendars",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Event title"
        },
        start: {
          type: "string",
          description: "Start date and time in 'YYYY-MM-DD HH:MM' format (local time)"
        },
        duration_min: {
          type: "number",
          description: "Duration in minutes (ignored for all-day events)"
        },
        all_day: {
          type: "boolean",
          description: "Whether this is an all-day event",
          default: false
        },
        notes: {
          type: "string",
          description: "Optional event notes or description"
        },
        cal_id: {
          type: "string",
          description: "Optional calendar ID for external calendar sync"
        }
      },
      required: ["title", "start"]
    }
  },
  {
    name: "create_time_block",
    description: "Create a Time Block (Planner Item) in Amazing Marvin for focused work sessions. Can sync with external calendars",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Time block title"
        },
        date: {
          type: "string",
          description: "Date in 'YYYY-MM-DD' format"
        },
        time: {
          type: "string",
          description: "Start time in 'HH:MM' format (local time)"
        },
        duration_min: {
          type: "number",
          description: "Duration in minutes"
        },
        notes: {
          type: "string",
          description: "Optional notes for the time block"
        }
      },
      required: ["title", "date", "time", "duration_min"]
    }
  },

  // Analytics Operations (6 Tools)
  {
    name: "get_productivity_summary",
    description: "Get current productivity overview and metrics",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_productivity_summary_for_time_range",
    description: "Get productivity analytics for a specific time range",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format"
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format"
        }
      },
      required: ["start_date", "end_date"]
    }
  },
  {
    name: "get_project_overview",
    description: "Get project completion metrics and overview",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_time_tracking_summary",
    description: "Get time tracking data and summaries",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default: 7)",
          default: 7
        }
      },
      required: []
    }
  },
  {
    name: "get_done_items",
    description: "Alternative method to get completed items with more detail",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default: 7)",
          default: 7
        }
      },
      required: []
    }
  },
  {
    name: "get_time_tracks",
    description: "Get detailed time tracking records",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format"
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format"
        }
      },
      required: []
    }
  }
];

export const AMAZING_MARVIN_BASE_URL = 'https://serv.amazingmarvin.com/api';

export const OAUTH_CONFIG = {
  authorizationUrl: '/auth',
  tokenUrl: '/token',
  userInfoUrl: '/userinfo',
  scope: 'marvin:read marvin:write',
  responseType: 'code',
  grantType: 'authorization_code'
};

export const CACHE_TTL = 600; // 10 minutes in seconds
export const TOKEN_TTL = 3600; // 1 hour in seconds