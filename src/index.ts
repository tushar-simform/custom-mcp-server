import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// Mock API for users
const USERS_API_BASE = "https://689aeb03e727e9657f630916.mockapi.io/trypto";

// Create server instance
const server = new McpServer({
  name: "weather",
  version: "1.0.0",
});

// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

// Format alert data
function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

// User interface for Mock API
interface User {
  createdAt: string;
  name: string;
  phone: string;
  city: string;
  id: string;
}

// Helper function for making Users API requests
async function makeUsersRequest<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making Users API request:", error);
    return null;
  }
}

// Format user data
function formatUser(user: User): string {
  return [
    `ID: ${user.id}`,
    `Name: ${user.name}`,
    `Phone: ${user.phone}`,
    `City: ${user.city}`,
    `Created At: ${user.createdAt}`,
    "---",
  ].join("\n");
}

// Register weather tools

server.registerTool(
  "get_alerts",
  {
    description: "Get weather alerts for a state",
    inputSchema: {
      state: z
        .string()
        .length(2)
        .describe("Two-letter state code (e.g. CA, NY)"),
    },
  },
  async ({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

    if (!alertsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve alerts data",
          },
        ],
      };
    }

    const features = alertsData.features || [];
    if (features.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No active alerts for ${stateCode}`,
          },
        ],
      };
    }

    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: alertsText,
        },
      ],
    };
  },
);

server.registerTool(
  "get_forecast",
  {
    description: "Get weather forecast for a location",
    inputSchema: {
      latitude: z
        .number()
        .min(-90)
        .max(90)
        .describe("Latitude of the location"),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .describe("Longitude of the location"),
    },
  },
  async ({ latitude, longitude }) => {
    // Get grid point data
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    if (!pointsData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
          },
        ],
      };
    }

    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to get forecast URL from grid point data",
          },
        ],
      };
    }

    // Get forecast data
    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
    if (!forecastData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve forecast data",
          },
        ],
      };
    }

    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No forecast periods available",
          },
        ],
      };
    }

    // Format forecast periods
    const formattedForecast = periods.map((period: ForecastPeriod) =>
      [
        `${period.name || "Unknown"}:`,
        `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
        `${period.shortForecast || "No forecast available"}`,
        "---",
      ].join("\n"),
    );

    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: forecastText,
        },
      ],
    };
  },
);

// ========== USER TOOLS ==========

// Tool: Get all users
server.registerTool(
  "get_users",
  {
    description: "Get all users from the database",
    inputSchema: {},
  },
  async () => {
    const usersUrl = `${USERS_API_BASE}/users`;
    const usersData = await makeUsersRequest<User[]>(usersUrl);

    if (!usersData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve users data",
          },
        ],
      };
    }

    if (usersData.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No users found",
          },
        ],
      };
    }

    const formattedUsers = usersData.map(formatUser);
    const usersText = `Total users: ${usersData.length}\n\n${formattedUsers.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: usersText,
        },
      ],
    };
  },
);

// Tool: Get users count
server.registerTool(
  "get_users_count",
  {
    description: "Get the total count of users in the database",
    inputSchema: {},
  },
  async () => {
    const usersUrl = `${USERS_API_BASE}/users`;
    const usersData = await makeUsersRequest<User[]>(usersUrl);

    if (!usersData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve users data",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Total number of users: ${usersData.length}`,
        },
      ],
    };
  },
);

// Tool: Search user by name, city, or id
server.registerTool(
  "search_user",
  {
    description: "Search for a user by name, city, or id",
    inputSchema: {
      query: z.string().describe("Search query (name, city, or id)"),
      searchBy: z
        .enum(["name", "city", "id"])
        .optional()
        .describe(
          "Field to search by (name, city, or id). Defaults to searching all fields.",
        ),
    },
  },
  async ({ query, searchBy }) => {
    const usersUrl = `${USERS_API_BASE}/users`;
    const usersData = await makeUsersRequest<User[]>(usersUrl);

    if (!usersData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve users data",
          },
        ],
      };
    }

    const lowerQuery = query.toLowerCase();

    const matchedUsers = usersData.filter((user) => {
      if (searchBy === "name") {
        return user.name.toLowerCase().includes(lowerQuery);
      } else if (searchBy === "city") {
        return user.city.toLowerCase().includes(lowerQuery);
      } else if (searchBy === "id") {
        return user.id === query;
      } else {
        // Search all fields
        return (
          user.name.toLowerCase().includes(lowerQuery) ||
          user.city.toLowerCase().includes(lowerQuery) ||
          user.id === query
        );
      }
    });

    if (matchedUsers.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No users found matching "${query}"`,
          },
        ],
      };
    }

    const formattedUsers = matchedUsers.map(formatUser);
    const usersText = `Found ${matchedUsers.length} user(s) matching "${query}":\n\n${formattedUsers.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: usersText,
        },
      ],
    };
  },
);

// ========== MATH TOOLS ==========

// Tool: Add two numbers
server.registerTool(
  "add_numbers",
  {
    description: "Add two numbers together",
    inputSchema: {
      a: z.number().describe("First number to add"),
      b: z.number().describe("Second number to add"),
    },
  },
  async ({ a, b }) => {
    const result = a * b;

    return {
      content: [
        {
          type: "text",
          text: `${a} + ${b} = ${result}`,
        },
      ],
    };
  },
);

server.registerTool(
  "multiply_numbers",
  {
    description: "Multiply two numbers",
    inputSchema: {
      a: z.number().describe("First number to multiply"),
      b: z.number().describe("Second number to multiply"),
    },
  },
  async ({ a, b }) => {
    const result = a * b;

    return {
      content: [
        {
          type: "text",
          text: `${a} * ${b} = ${result}`,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
